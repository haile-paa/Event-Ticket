package main

import (
	"crypto/rand"
	"encoding/base32"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return false
	}
	return true
}

func oid(s string) (primitive.ObjectID, bool) {
	id, err := primitive.ObjectIDFromHex(s)
	return id, err == nil
}

var b32 = base32.StdEncoding.WithPadding(base32.NoPadding)

// randToken returns a lowercase, URL-safe random string (n bytes of entropy).
func randToken(n int) string {
	buf := make([]byte, n)
	_, _ = rand.Read(buf)
	return strings.ToLower(b32.EncodeToString(buf))
}

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// orderCode makes a short human-friendly code such as TK-7H2QMX.
func orderCode() string {
	buf := make([]byte, 6)
	_, _ = rand.Read(buf)
	out := make([]byte, 6)
	for i, b := range buf {
		out[i] = codeAlphabet[int(b)%len(codeAlphabet)]
	}
	return "TK-" + string(out)
}

var phoneRe = regexp.MustCompile(`^\+?\d{9,15}$`)

func cleanPhone(s string) (string, bool) {
	r := strings.NewReplacer(" ", "", "-", "", "(", "", ")", "")
	p := r.Replace(strings.TrimSpace(s))
	return p, phoneRe.MatchString(p)
}

func lastDigits(s string, n int) string {
	var d []rune
	for _, c := range s {
		if c >= '0' && c <= '9' {
			d = append(d, c)
		}
	}
	if len(d) > n {
		d = d[len(d)-n:]
	}
	return string(d)
}

// tokenFromPayload accepts either a raw ticket token or the full QR text
// "TIKIT|<token>|<name>|<tier>|<amount>|<order code>".
func tokenFromPayload(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(strings.ToUpper(s), "TIKIT|") {
		parts := strings.Split(s, "|")
		if len(parts) >= 2 {
			return strings.ToLower(strings.TrimSpace(parts[1]))
		}
	}
	return strings.ToLower(s)
}

func clientIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			return strings.TrimSpace(strings.Split(xff, ",")[0])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// ---------- tiny in-memory rate limiter ----------

type limiter struct {
	mu   sync.Mutex
	hits map[string][]time.Time
}

func newLimiter() *limiter { return &limiter{hits: map[string][]time.Time{}} }

func (l *limiter) prune(key string, window time.Duration, now time.Time) []time.Time {
	cutoff := now.Add(-window)
	kept := l.hits[key][:0]
	for _, t := range l.hits[key] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) == 0 {
		delete(l.hits, key)
		return nil
	}
	l.hits[key] = kept
	return kept
}

// allow records a hit and reports whether the caller is still under the limit.
func (l *limiter) allow(key string, max int, window time.Duration) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	if len(l.prune(key, window, now)) >= max {
		return false
	}
	l.hits[key] = append(l.hits[key], now)
	return true
}

func (l *limiter) count(key string, window time.Duration) int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.prune(key, window, time.Now()))
}

func (l *limiter) add(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.hits[key] = append(l.hits[key], time.Now())
}

// ---------- image upload ----------

var allowedImages = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// saveImage validates the real content type (not the file name) and stores the file
// under an unguessable random name. It returns the stored file name.
func saveImage(src io.Reader, dir string, allowSVG bool) (string, error) {
	head := make([]byte, 512)
	n, err := io.ReadFull(src, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return "", err
	}
	head = head[:n]
	ct := http.DetectContentType(head)
	ext, ok := allowedImages[ct]
	if !ok && allowSVG && (strings.HasPrefix(ct, "text/xml") || strings.HasPrefix(ct, "text/plain")) &&
		strings.Contains(strings.ToLower(string(head)), "<svg") {
		ext, ok = ".svg", true
	}
	if !ok {
		return "", errors.New("unsupported image type, please use JPG, PNG, WEBP or GIF")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	name := randToken(16) + ext
	f, err := os.OpenFile(filepath.Join(dir, name), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", err
	}
	defer f.Close()
	if _, err := f.Write(head); err != nil {
		return "", err
	}
	if _, err := io.Copy(f, src); err != nil {
		_ = os.Remove(filepath.Join(dir, name))
		return "", err
	}
	return name, nil
}

// noListFS stops http.FileServer from listing directories.
type noListFS struct{ fs http.FileSystem }

func (n noListFS) Open(name string) (http.File, error) {
	f, err := n.fs.Open(name)
	if err != nil {
		return nil, err
	}
	st, err := f.Stat()
	if err != nil {
		_ = f.Close()
		return nil, err
	}
	if st.IsDir() {
		_ = f.Close()
		return nil, os.ErrNotExist
	}
	return f, nil
}
