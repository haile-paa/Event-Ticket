package main

import (
	"crypto/rand"
	"encoding/base32"
	"encoding/json"
	"net"
	"net/http"
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
