package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

const maxPerOrder = 50

// ---------- events ----------

func (a *App) listEvents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	cur, err := a.events.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "startsAt", Value: 1}}))
	if err != nil {
		writeError(w, 500, "Could not load events")
		return
	}
	var all []Event
	if err := cur.All(ctx, &all); err != nil {
		writeError(w, 500, "Could not load events")
		return
	}
	want := r.URL.Query().Get("status")
	now := time.Now()
	out := make([]Event, 0, len(all))
	for i := range all {
		all[i].normalize(now)
		if want == "" || want == all[i].Status {
			out = append(out, all[i])
		}
	}
	if want == "past" { // most recent first
		sort.Slice(out, func(i, j int) bool { return out[i].StartsAt.After(out[j].StartsAt) })
	}
	writeJSON(w, 200, out)
}

func (a *App) loadEvent(ctx context.Context, id primitive.ObjectID) (*Event, error) {
	var ev Event
	if err := a.events.FindOne(ctx, bson.M{"_id": id}).Decode(&ev); err != nil {
		return nil, err
	}
	ev.normalize(time.Now())
	return &ev, nil
}

func (a *App) getEvent(w http.ResponseWriter, r *http.Request) {
	id, ok := oid(r.PathValue("id"))
	if !ok {
		writeError(w, 404, "Event not found")
		return
	}
	ev, err := a.loadEvent(r.Context(), id)
	if err != nil {
		writeError(w, 404, "Event not found")
		return
	}
	writeJSON(w, 200, ev)
}

// ---------- payment methods ----------

func (a *App) loadPayMethods(ctx context.Context) []PayMethod {
	var s PaymentSettings
	if err := a.settings.FindOne(ctx, bson.M{"_id": "payment"}).Decode(&s); err != nil || len(s.Methods) == 0 {
		return defaultPayMethods()
	}
	return s.Methods
}

func (a *App) paymentMethods(w http.ResponseWriter, r *http.Request) {
	all := a.loadPayMethods(r.Context())
	out := make([]PayMethod, 0, len(all))
	for _, m := range all {
		if m.Enabled {
			out = append(out, m)
		}
	}
	writeJSON(w, 200, map[string]any{"methods": out})
}

// ---------- orders ----------

type itemReq struct {
	Tier string `json:"tier"`
	Qty  int    `json:"qty"`
}

func (a *App) reserve(ctx context.Context, eventID primitive.ObjectID, tier string, qty int) error {
	res, err := a.events.UpdateOne(ctx,
		bson.M{"_id": eventID, "tiers": bson.M{"$elemMatch": bson.M{"name": tier, "available": bson.M{"$gte": qty}}}},
		bson.M{"$inc": bson.M{"tiers.$.available": -qty}})
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return fmt.Errorf("Not enough %s tickets left", strings.ToUpper(tier))
	}
	return nil
}

func (a *App) release(ctx context.Context, eventID primitive.ObjectID, tier string, qty int) {
	_, err := a.events.UpdateOne(ctx,
		bson.M{"_id": eventID, "tiers.name": tier},
		bson.M{"$inc": bson.M{"tiers.$.available": qty}})
	if err != nil {
		fmt.Fprintf(os.Stderr, "release failed for %s/%s: %v\n", eventID.Hex(), tier, err)
	}
}

func (a *App) createOrder(w http.ResponseWriter, r *http.Request) {
	if !a.orderLimit.allow(clientIP(r, a.cfg.TrustProxy), 12, 10*time.Minute) {
		writeError(w, 429, "Too many orders from this device. Please wait a few minutes.")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 12<<20)
	if err := r.ParseMultipartForm(12 << 20); err != nil {
		writeError(w, 400, "Could not read your order. Is the screenshot smaller than 10 MB?")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	ctx := r.Context()

	// --- validate input ---
	eventID, ok := oid(r.FormValue("eventId"))
	if !ok {
		writeError(w, 400, "Unknown event")
		return
	}
	name := strings.Join(strings.Fields(strings.ReplaceAll(r.FormValue("name"), "|", " ")), " ")
	if n := utf8.RuneCountInString(name); n < 2 || n > 80 {
		writeError(w, 400, "Please enter your full name")
		return
	}
	phone, ok := cleanPhone(r.FormValue("phone"))
	if !ok {
		writeError(w, 400, "Please enter a valid phone number")
		return
	}
	method := r.FormValue("method")
	methodOK := false
	for _, m := range a.loadPayMethods(ctx) {
		if m.Key == method && m.Enabled {
			methodOK = true
		}
	}
	if !methodOK {
		writeError(w, 400, "Please choose a payment method")
		return
	}
	var reqItems []itemReq
	if err := json.Unmarshal([]byte(r.FormValue("items")), &reqItems); err != nil || len(reqItems) == 0 {
		writeError(w, 400, "Please choose at least one ticket")
		return
	}
	sms := strings.TrimSpace(r.FormValue("sms"))
	if utf8.RuneCountInString(sms) > 1500 {
		writeError(w, 400, "The SMS text is too long")
		return
	}
	file, _, fileErr := r.FormFile("proof")
	if fileErr == nil {
		defer file.Close()
	}
	if fileErr != nil && utf8.RuneCountInString(sms) < 10 {
		writeError(w, 400, "Please attach your payment screenshot or paste the bank SMS")
		return
	}

	maxPerTier := a.maxPerTier(ctx)
	ev, err := a.loadEvent(ctx, eventID)
	if err != nil {
		writeError(w, 404, "Event not found")
		return
	}
	if ev.Status == "past" {
		writeError(w, 400, "This event has already ended")
		return
	}

	// merge duplicate tiers, price everything on the server
	qtyByTier := map[string]int{}
	order := []string{}
	for _, it := range reqItems {
		if it.Qty < 1 {
			continue
		}
		if _, seen := qtyByTier[it.Tier]; !seen {
			order = append(order, it.Tier)
		}
		qtyByTier[it.Tier] += it.Qty
	}
	var items []OrderItem
	total, count := 0, 0
	for _, tierName := range order {
		qty := qtyByTier[tierName]
		var tier *Tier
		for i := range ev.Tiers {
			if ev.Tiers[i].Name == tierName {
				tier = &ev.Tiers[i]
			}
		}
		if tier == nil {
			writeError(w, 400, "Unknown ticket type")
			return
		}
		if qty > maxPerTier {
			writeError(w, 400, fmt.Sprintf("You can buy up to %d %s tickets at once", maxPerTier, strings.ToUpper(tierName)))
			return
		}
		items = append(items, OrderItem{Tier: tierName, Qty: qty, UnitPrice: tier.Price})
		total += tier.Price * qty
		count += qty
	}
	if count == 0 || count > maxPerOrder {
		writeError(w, 400, fmt.Sprintf("You can buy 1 to %d tickets per order", maxPerOrder))
		return
	}

	// --- store the proof image (if any) before touching stock ---
	proof := Proof{SMSText: sms}
	proofPath := ""
	if fileErr == nil {
		name, err := saveImage(file, filepath.Join(a.cfg.UploadDir, "proofs"), false)
		if err != nil {
			writeError(w, 400, err.Error())
			return
		}
		proof.ImageURL = "/uploads/proofs/" + name
		proofPath = filepath.Join(a.cfg.UploadDir, "proofs", name)
	}
	cleanup := func() {
		if proofPath != "" {
			_ = os.Remove(proofPath)
		}
	}

	// --- hold the tickets (so nobody else can take them while we verify payment) ---
	var held []OrderItem
	for _, it := range items {
		if err := a.reserve(ctx, eventID, it.Tier, it.Qty); err != nil {
			for _, h := range held {
				a.release(ctx, eventID, h.Tier, h.Qty)
			}
			cleanup()
			var me mongo.CommandError
			if errors.As(err, &me) {
				writeError(w, 500, "Could not reserve tickets")
			} else {
				writeError(w, 409, err.Error())
			}
			return
		}
		held = append(held, it)
	}

	now := time.Now()
	ord := Order{
		EventID: eventID, EventTitle: ev.Title, Name: name, Phone: phone, Method: method,
		Items: items, TotalTickets: count, Total: total, Proof: proof, Status: "pending", CreatedAt: now,
	}
	var insertErr error
	for attempt := 0; attempt < 5; attempt++ {
		ord.ID = primitive.NewObjectID()
		ord.Code = orderCode()
		_, insertErr = a.orders.InsertOne(ctx, ord)
		if insertErr == nil || !mongo.IsDuplicateKeyError(insertErr) {
			break
		}
	}
	if insertErr != nil {
		for _, h := range held {
			a.release(ctx, eventID, h.Tier, h.Qty)
		}
		cleanup()
		writeError(w, 500, "Could not save your order, please try again")
		return
	}
	writeJSON(w, 201, publicView(&OrderView{Order: ord, Tickets: []Ticket{}, Event: ev.brief()}))
}

// publicView hides the payment proof from the customer-facing API.
func publicView(v *OrderView) *OrderView {
	v.Proof = Proof{}
	return v
}

func (a *App) orderView(ctx context.Context, ord Order) OrderView {
	v := OrderView{Order: ord, Tickets: []Ticket{}}
	if ev, err := a.loadEvent(ctx, ord.EventID); err == nil {
		v.Event = ev.brief()
	}
	if ord.Status == "approved" {
		cur, err := a.tickets.Find(ctx, bson.M{"orderId": ord.ID}, options.Find().SetSort(bson.D{{Key: "seq", Value: 1}}))
		if err == nil {
			var ts []Ticket
			if cur.All(ctx, &ts) == nil && ts != nil {
				v.Tickets = ts
			}
		}
	}
	return v
}

func (a *App) getOrder(w http.ResponseWriter, r *http.Request) {
	id, ok := oid(r.PathValue("id"))
	if !ok {
		writeError(w, 404, "Order not found")
		return
	}
	var ord Order
	if err := a.orders.FindOne(r.Context(), bson.M{"_id": id}).Decode(&ord); err != nil {
		writeError(w, 404, "Order not found")
		return
	}
	v := a.orderView(r.Context(), ord)
	writeJSON(w, 200, publicView(&v))
}

// batchOrders powers "My tickets": the browser remembers its order ids.
func (a *App) batchOrders(w http.ResponseWriter, r *http.Request) {
	var ids []primitive.ObjectID
	for _, s := range strings.Split(r.URL.Query().Get("ids"), ",") {
		if id, ok := oid(strings.TrimSpace(s)); ok {
			ids = append(ids, id)
		}
		if len(ids) >= 40 {
			break
		}
	}
	out := []OrderView{}
	if len(ids) > 0 {
		cur, err := a.orders.Find(r.Context(), bson.M{"_id": bson.M{"$in": ids}},
			options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
		if err != nil {
			writeError(w, 500, "Could not load orders")
			return
		}
		var orders []Order
		if err := cur.All(r.Context(), &orders); err != nil {
			writeError(w, 500, "Could not load orders")
			return
		}
		for _, o := range orders {
			v := a.orderView(r.Context(), o)
			out = append(out, *publicView(&v))
		}
	}
	writeJSON(w, 200, out)
}

// lookupOrder lets a customer find an order on a new device with order code + phone.
func (a *App) lookupOrder(w http.ResponseWriter, r *http.Request) {
	if !a.lookupLim.allow(clientIP(r, a.cfg.TrustProxy), 20, 10*time.Minute) {
		writeError(w, 429, "Too many searches, please wait a few minutes")
		return
	}
	code := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("code")))
	phone := lastDigits(r.URL.Query().Get("phone"), 9)
	if code == "" || len(phone) < 9 {
		writeError(w, 400, "Enter your order code and phone number")
		return
	}
	var ord Order
	if err := a.orders.FindOne(r.Context(), bson.M{"code": code}).Decode(&ord); err != nil || lastDigits(ord.Phone, 9) != phone {
		writeError(w, 404, "No order matches that code and phone number")
		return
	}
	v := a.orderView(r.Context(), ord)
	writeJSON(w, 200, publicView(&v))
}
