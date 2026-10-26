package main

import (
	"log"
	"os"
	"strings"
	"unicode/utf16"
)

// Config holds everything that can be changed through environment variables.
type Config struct {
	Port        string
	MongoURI    string
	DBName      string
	AdminPin    string   // empty = admin API is open (dev only!)
	DevKey      string   // secret key of the developer Studio (customizer). Empty = Studio is switched off
	UploadDir   string   // where event images and payment proofs are stored
	CORSOrigins []string // "*" allows everything
	TrustProxy  bool     // read client IP from X-Forwarded-For
	SeedDemo    bool     // insert demo events when the database is empty
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

// loadDotEnv reads KEY=value lines from a .env file in the folder you run the API from.
// Real environment variables always win over the file. It understands Windows line endings
// and the UTF-16 files that PowerShell's `echo ... > .env` creates.
func loadDotEnv(path string) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return
	}
	text := string(raw)
	if len(raw) >= 2 && raw[0] == 0xFF && raw[1] == 0xFE { // UTF-16 little endian
		u := make([]uint16, 0, len(raw)/2)
		for i := 2; i+1 < len(raw); i += 2 {
			u = append(u, uint16(raw[i])|uint16(raw[i+1])<<8)
		}
		text = string(utf16.Decode(u))
	}
	text = strings.TrimPrefix(text, "\ufeff")
	loaded := 0
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		line = strings.TrimSpace(strings.TrimPrefix(line, "export "))
		i := strings.Index(line, "=")
		if i <= 0 {
			continue
		}
		key := strings.TrimSpace(line[:i])
		val := strings.TrimSpace(line[i+1:])
		if len(val) >= 2 && (val[0] == '"' || val[0] == '\'') && val[len(val)-1] == val[0] {
			val = val[1 : len(val)-1]
		} else if j := strings.Index(val, " #"); j >= 0 {
			val = strings.TrimSpace(val[:j])
		}
		if _, exists := os.LookupEnv(key); !exists {
			_ = os.Setenv(key, val)
			loaded++
		}
	}
	log.Printf("Loaded %d setting(s) from %s", loaded, path)
}

func loadConfig() Config {
	loadDotEnv(".env")
	origins := strings.Split(env("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3002"), ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}
	return Config{
		Port:        env("PORT", "8080"),
		MongoURI:    env("MONGO_URI", "mongodb://localhost:27017"),
		DBName:      env("MONGO_DB", "tikit"),
		AdminPin:    env("ADMIN_PIN", "2468"),
		DevKey:      env("DEV_KEY", ""),
		UploadDir:   env("UPLOAD_DIR", "./uploads"),
		CORSOrigins: origins,
		TrustProxy:  env("TRUST_PROXY", "false") == "true",
		SeedDemo:    env("SEED_DEMO", "true") == "true",
	}
}
