package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// The white-label settings (brand, colours, texts, ...) are stored as one JSON document.
// The backend does not need to understand them: the websites merge them over their built-in
// defaults, so new options can be added later without touching the Go code.

const maxSiteBytes = 200 << 10

type siteDoc struct {
	ID        string    `bson:"_id"`
	JSON      string    `bson:"json"`
	UpdatedAt time.Time `bson:"updatedAt"`
}

func (a *App) loadSiteJSON(ctx context.Context) string {
	var d siteDoc
	if err := a.settings.FindOne(ctx, bson.M{"_id": "site"}).Decode(&d); err != nil || d.JSON == "" {
		return "{}"
	}
	return d.JSON
}

func (a *App) getSite(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = io.WriteString(w, a.loadSiteJSON(r.Context()))
}

func checkSiteValue(v any, depth int) bool {
	if depth > 8 {
		return false
	}
	switch t := v.(type) {
	case string:
		return utf8.RuneCountInString(t) <= 4000
	case map[string]any:
		if len(t) > 200 {
			return false
		}
		for k, x := range t {
			if len(k) > 80 || !checkSiteValue(x, depth+1) {
				return false
			}
		}
	case []any:
		if len(t) > 200 {
			return false
		}
		for _, x := range t {
			if !checkSiteValue(x, depth+1) {
				return false
			}
		}
	}
	return true
}

func (a *App) adminSaveSite(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxSiteBytes)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, 400, "The settings are too large")
		return
	}
	var obj map[string]any
	if err := json.Unmarshal(raw, &obj); err != nil || obj == nil || !checkSiteValue(obj, 0) {
		writeError(w, 400, "Invalid settings")
		return
	}
	clean, _ := json.Marshal(obj)
	_, err = a.settings.UpdateOne(r.Context(), bson.M{"_id": "site"},
		bson.M{"$set": bson.M{"json": string(clean), "updatedAt": time.Now()}},
		options.Update().SetUpsert(true))
	if err != nil {
		writeError(w, 500, "Could not save the settings")
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, _ = w.Write(clean)
}

// maxPerTier reads tickets.maxPerTier from the site settings (default 10, range 1-50).
func (a *App) maxPerTier(ctx context.Context) int {
	var c struct {
		Tickets struct {
			MaxPerTier int `json:"maxPerTier"`
		} `json:"tickets"`
	}
	if json.Unmarshal([]byte(a.loadSiteJSON(ctx)), &c) != nil || c.Tickets.MaxPerTier < 1 {
		return 10
	}
	if c.Tickets.MaxPerTier > 50 {
		return 50
	}
	return c.Tickets.MaxPerTier
}

// ---------- admin PIN ----------

func hashPin(salt []byte, pin string) []byte {
	h := sha256.New()
	h.Write(salt)
	h.Write([]byte(pin))
	return h.Sum(nil)
}

func (a *App) loadPin() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var d struct {
		Hash []byte `bson:"hash"`
		Salt []byte `bson:"salt"`
	}
	if err := a.settings.FindOne(ctx, bson.M{"_id": "admin"}).Decode(&d); err == nil && len(d.Hash) > 0 {
		a.pinMu.Lock()
		a.pinHash, a.pinSalt = d.Hash, d.Salt
		a.pinMu.Unlock()
	}
}

// checkPin accepts the PIN saved from the customizer, or the ADMIN_PIN env value until one is saved.
func (a *App) checkPin(got string) bool {
	got = strings.TrimSpace(got)
	a.pinMu.RLock()
	h, s := a.pinHash, a.pinSalt
	a.pinMu.RUnlock()
	if len(h) > 0 {
		return subtle.ConstantTimeCompare(hashPin(s, got), h) == 1
	}
	if a.cfg.AdminPin == "" {
		return true
	}
	return subtle.ConstantTimeCompare([]byte(got), []byte(a.cfg.AdminPin)) == 1
}

func (a *App) adminChangePin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		New string `json:"new"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	pin := strings.TrimSpace(body.New)
	if n := utf8.RuneCountInString(pin); n < 4 || n > 32 {
		writeError(w, 400, "The PIN must be 4 to 32 characters")
		return
	}
	salt := make([]byte, 16)
	_, _ = rand.Read(salt)
	hash := hashPin(salt, pin)
	_, err := a.settings.UpdateOne(r.Context(), bson.M{"_id": "admin"},
		bson.M{"$set": bson.M{"hash": hash, "salt": salt}}, options.Update().SetUpsert(true))
	if err != nil {
		writeError(w, 500, "Could not save the new PIN")
		return
	}
	a.pinMu.Lock()
	a.pinHash, a.pinSalt = hash, salt
	a.pinMu.Unlock()
	writeJSON(w, 200, map[string]bool{"ok": true})
}
