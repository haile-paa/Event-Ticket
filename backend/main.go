package main

import (
	"context"
	"crypto/subtle"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type App struct {
	cfg        Config
	db         *mongo.Database
	events     *mongo.Collection
	orders     *mongo.Collection
	tickets    *mongo.Collection
	settings   *mongo.Collection
	orderLimit *limiter
	lookupLim  *limiter
	loginFails *limiter

	pinMu   sync.RWMutex
	pinHash []byte // set when the owner changed the PIN from the customizer
	pinSalt []byte
}

func main() {
	cfg := loadConfig()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURI))
	if err != nil {
		log.Fatalf("mongo connect: %v", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("Cannot reach MongoDB at %s\n  -> start MongoDB first (docker compose up -d mongo), or put your MongoDB Atlas link in backend/.env as MONGO_URI=...\n  -> details: %v", redactURI(cfg.MongoURI), err)
	}
	cancel()

	db := client.Database(cfg.DBName)
	app := &App{
		cfg:        cfg,
		db:         db,
		events:     db.Collection("events"),
		orders:     db.Collection("orders"),
		tickets:    db.Collection("tickets"),
		settings:   db.Collection("settings"),
		orderLimit: newLimiter(),
		lookupLim:  newLimiter(),
		loginFails: newLimiter(),
	}

	if err := os.MkdirAll(filepath.Join(cfg.UploadDir, "proofs"), 0o755); err != nil {
		log.Fatalf("create upload dir: %v", err)
	}
	app.ensureIndexes()
	app.ensureSettings()
	app.loadPin()
	if cfg.SeedDemo {
		app.seedDemo()
	}
	if cfg.DevKey == "" {
		log.Println("Studio (customizer) is OFF: set DEV_KEY in backend/.env to switch it on")
	}
	if cfg.AdminPin == "" {
		log.Println("WARNING: ADMIN_PIN is empty - the admin API is completely open")
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           app.routes(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       60 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Printf("Tikit API listening on http://localhost:%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()
	_ = srv.Shutdown(shutdownCtx)
	_ = client.Disconnect(shutdownCtx)
}

func (a *App) ensureIndexes() {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	mk := func(c *mongo.Collection, models ...mongo.IndexModel) {
		if _, err := c.Indexes().CreateMany(ctx, models); err != nil {
			log.Printf("index warning on %s: %v", c.Name(), err)
		}
	}
	mk(a.orders,
		mongo.IndexModel{Keys: bson.D{{Key: "code", Value: 1}}, Options: options.Index().SetUnique(true)},
		mongo.IndexModel{Keys: bson.D{{Key: "status", Value: 1}, {Key: "createdAt", Value: -1}}},
		mongo.IndexModel{Keys: bson.D{{Key: "eventId", Value: 1}}},
	)
	mk(a.tickets,
		mongo.IndexModel{Keys: bson.D{{Key: "token", Value: 1}}, Options: options.Index().SetUnique(true)},
		mongo.IndexModel{Keys: bson.D{{Key: "eventId", Value: 1}, {Key: "checkedIn", Value: 1}}},
		mongo.IndexModel{Keys: bson.D{{Key: "orderId", Value: 1}}},
	)
	mk(a.events, mongo.IndexModel{Keys: bson.D{{Key: "startsAt", Value: 1}}})
}

func (a *App) ensureSettings() {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, err := a.settings.UpdateOne(ctx,
		bson.M{"_id": "payment"},
		bson.M{"$setOnInsert": bson.M{"methods": defaultPayMethods()}},
		options.Update().SetUpsert(true))
	if err != nil {
		log.Printf("settings warning: %v", err)
	}
}

// ---------- routing ----------

func (a *App) routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok", "app": "tikit"})
	})

	// public (customer website)
	mux.HandleFunc("GET /api/events", a.listEvents)
	mux.HandleFunc("GET /api/events/{id}", a.getEvent)
	mux.HandleFunc("GET /api/payment-methods", a.paymentMethods)
	mux.HandleFunc("GET /api/site", a.getSite)
	mux.HandleFunc("POST /api/orders", a.createOrder)
	mux.HandleFunc("GET /api/orders", a.batchOrders)
	mux.HandleFunc("GET /api/orders/lookup", a.lookupOrder)
	mux.HandleFunc("GET /api/orders/{id}", a.getOrder)

	// admin (owner website)
	admin := func(h http.HandlerFunc) http.HandlerFunc { return a.requireAdmin(h) }
	mux.HandleFunc("POST /api/admin/login", a.adminLogin)
	mux.HandleFunc("GET /api/admin/stats", admin(a.adminStats))
	mux.HandleFunc("GET /api/admin/orders", admin(a.adminOrders))
	mux.HandleFunc("POST /api/admin/orders/{id}/approve", admin(a.adminApprove))
	mux.HandleFunc("POST /api/admin/orders/{id}/reject", admin(a.adminReject))
	mux.HandleFunc("GET /api/admin/events", admin(a.listEvents))
	mux.HandleFunc("POST /api/admin/events", admin(a.adminCreateEvent))
	mux.HandleFunc("PUT /api/admin/events/{id}", admin(a.adminUpdateEvent))
	mux.HandleFunc("DELETE /api/admin/events/{id}", admin(a.adminDeleteEvent))
	mux.HandleFunc("POST /api/admin/events/{id}/status", admin(a.adminEventStatus))
	mux.HandleFunc("GET /api/admin/events/{id}/attendees", admin(a.adminAttendees))
	mux.HandleFunc("POST /api/admin/upload", admin(a.adminUpload))
	mux.HandleFunc("POST /api/admin/checkin", admin(a.adminCheckin))
	mux.HandleFunc("POST /api/admin/tickets/{id}/undo", admin(a.adminUndoCheckin))

	// developer Studio (the white-label customizer). Needs the secret DEV_KEY, which the
	// organizers never get - they only have the admin PIN.
	dev := func(h http.HandlerFunc) http.HandlerFunc { return a.requireDev(h) }
	mux.HandleFunc("POST /api/studio/login", dev(func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]bool{"ok": true})
	}))
	mux.HandleFunc("GET /api/studio/payment-methods", dev(a.adminGetPaymentMethods))
	mux.HandleFunc("PUT /api/studio/payment-methods", dev(a.adminSavePaymentMethods))
	mux.HandleFunc("PUT /api/studio/site", dev(a.adminSaveSite))
	mux.HandleFunc("PUT /api/studio/pin", dev(a.adminChangePin))
	mux.HandleFunc("POST /api/studio/upload", dev(a.adminUpload))

	// uploaded files (event images + payment proofs). Names are random, directories are not listable.
	files := http.StripPrefix("/uploads/", http.FileServer(noListFS{http.Dir(a.cfg.UploadDir)}))
	mux.HandleFunc("GET /uploads/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		// uploaded SVGs must never be able to run scripts if someone opens them directly
		w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox")
		w.Header().Set("Cross-Origin-Resource-Policy", "cross-origin")
		files.ServeHTTP(w, r)
	})

	return a.recoverer(a.securityHeaders(a.cors(mux)))
}

func (a *App) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				log.Printf("panic: %v", rec)
				writeError(w, 500, "Something went wrong")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func (a *App) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func (a *App) cors(next http.Handler) http.Handler {
	allowAll := false
	allowed := map[string]bool{}
	for _, o := range a.cfg.CORSOrigins {
		if o == "*" {
			allowAll = true
		}
		allowed[o] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (allowAll || allowed[origin]) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Admin-Pin, X-Dev-Key")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *App) pinOK(r *http.Request) bool {
	return a.checkPin(r.Header.Get("X-Admin-Pin"))
}

func (a *App) requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := clientIP(r, a.cfg.TrustProxy)
		if a.loginFails.count(ip, 10*time.Minute) >= 15 {
			writeError(w, 429, "Too many wrong PIN attempts. Try again in a few minutes.")
			return
		}
		if !a.pinOK(r) {
			a.loginFails.add(ip)
			writeError(w, 401, "Wrong or missing admin PIN")
			return
		}
		next(w, r)
	}
}

func (a *App) requireDev(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if a.cfg.DevKey == "" {
			writeError(w, 403, "The developer Studio is switched off on this server (DEV_KEY is not set)")
			return
		}
		ip := clientIP(r, a.cfg.TrustProxy)
		if a.loginFails.count(ip, 10*time.Minute) >= 15 {
			writeError(w, 429, "Too many wrong keys. Try again in a few minutes.")
			return
		}
		got := strings.TrimSpace(r.Header.Get("X-Dev-Key"))
		if subtle.ConstantTimeCompare([]byte(got), []byte(a.cfg.DevKey)) != 1 {
			a.loginFails.add(ip)
			writeError(w, 401, "Wrong developer key")
			return
		}
		next(w, r)
	}
}

// redactURI hides the user:password part of a connection string before it is printed.
func redactURI(uri string) string {
	at := strings.LastIndex(uri, "@")
	sch := strings.Index(uri, "://")
	if at < 0 || sch < 0 || at < sch {
		return uri
	}
	return uri[:sch+3] + "***@" + uri[at+1:]
}
