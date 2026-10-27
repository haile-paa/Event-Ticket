package main

import (
	"errors"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ---------- login ----------

func (a *App) adminLogin(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r, a.cfg.TrustProxy)
	if a.loginFails.count(ip, 10*time.Minute) >= 15 {
		writeError(w, 429, "Too many wrong PIN attempts. Try again in a few minutes.")
		return
	}
	var body struct {
		Pin string `json:"pin"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if !a.checkPin(body.Pin) {
		a.loginFails.add(ip)
		writeError(w, 401, "Wrong PIN")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ---------- orders ----------

func (a *App) adminOrders(w http.ResponseWriter, r *http.Request) {
	filter := bson.M{}
	switch s := r.URL.Query().Get("status"); s {
	case "pending", "approved", "rejected":
		filter["status"] = s
	}
	if id, ok := oid(r.URL.Query().Get("eventId")); ok {
		filter["eventId"] = id
	}
	cur, err := a.orders.Find(r.Context(), filter,
		options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}).SetLimit(500))
	if err != nil {
		writeError(w, 500, "Could not load orders")
		return
	}
	orders := []Order{}
	if err := cur.All(r.Context(), &orders); err != nil {
		writeError(w, 500, "Could not load orders")
		return
	}
	writeJSON(w, 200, orders)
}

func (a *App) adminApprove(w http.ResponseWriter, r *http.Request) {
	id, ok := oid(r.PathValue("id"))
	if !ok {
		writeError(w, 404, "Order not found")
		return
	}
	ctx := r.Context()
	now := time.Now()
	var ord Order
	err := a.orders.FindOneAndUpdate(ctx,
		bson.M{"_id": id, "status": "pending"},
		bson.M{"$set": bson.M{"status": "approved", "decidedAt": now, "rejectReason": ""}},
		options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&ord)
	if errors.Is(err, mongo.ErrNoDocuments) {
		writeError(w, 409, "This order was already approved or rejected")
		return
	}
	if err != nil {
		writeError(w, 500, "Could not approve the order")
		return
	}

	var docs []any
	seq := 0
	for _, it := range ord.Items {
		for i := 0; i < it.Qty; i++ {
			seq++
			docs = append(docs, Ticket{
				Token: randToken(12), OrderID: ord.ID, OrderCode: ord.Code, EventID: ord.EventID,
				EventTitle: ord.EventTitle, Name: ord.Name, Phone: ord.Phone, Tier: it.Tier,
				Price: it.UnitPrice, Seq: seq, OfTotal: ord.TotalTickets, CreatedAt: now,
			})
		}
	}
	if _, err := a.tickets.InsertMany(ctx, docs); err != nil {
		// put the order back so the admin can retry
		_, _ = a.orders.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"status": "pending"}, "$unset": bson.M{"decidedAt": ""}})
		writeError(w, 500, "Could not create the tickets, please try again")
		return
	}
	writeJSON(w, 200, a.orderView(ctx, ord))
}

func (a *App) adminReject(w http.ResponseWriter, r *http.Request) {
	id, ok := oid(r.PathValue("id"))
	if !ok {
		writeError(w, 404, "Order not found")
		return
	}
	var body struct {
		Reason string `json:"reason"`
	}
	if r.ContentLength != 0 && !decodeJSON(w, r, &body) {
		return
	}
	reason := strings.TrimSpace(body.Reason)
	if reason == "" {
		reason = "We could not confirm your payment."
	}
	if utf8.RuneCountInString(reason) > 300 {
		reason = string([]rune(reason)[:300])
	}
	ctx := r.Context()
	var ord Order
	err := a.orders.FindOneAndUpdate(ctx,
		bson.M{"_id": id, "status": "pending"},
		bson.M{"$set": bson.M{"status": "rejected", "decidedAt": time.Now(), "rejectReason": reason}},
		options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&ord)
	if errors.Is(err, mongo.ErrNoDocuments) {
		writeError(w, 409, "This order was already approved or rejected")
		return
	}
	if err != nil {
		writeError(w, 500, "Could not reject the order")
		return
	}
	for _, it := range ord.Items { // give the held tickets back
		a.release(ctx, ord.EventID, it.Tier, it.Qty)
	}
	writeJSON(w, 200, a.orderView(ctx, ord))
}

// ---------- events ----------

type tierInput struct {
	Name     string `json:"name"`
	Price    int    `json:"price"`
	Capacity int    `json:"capacity"`
	Perks    string `json:"perks"`
}

type eventInput struct {
	Title       string      `json:"title"`
	Description string      `json:"description"`
	Category    string      `json:"category"`
	Venue       string      `json:"venue"`
	City        string      `json:"city"`
	StartsAt    time.Time   `json:"startsAt"`
	EndsAt      time.Time   `json:"endsAt"`
	Cover       string      `json:"cover"`
	Gallery     []string    `json:"gallery"`
	Tiers       []tierInput `json:"tiers"`
}

func okImageRef(s string) bool {
	return strings.HasPrefix(s, "/uploads/") || strings.HasPrefix(s, "https://") || strings.HasPrefix(s, "http://")
}

func (in *eventInput) validate() string {
	in.Title = strings.TrimSpace(in.Title)
	in.Description = strings.TrimSpace(in.Description)
	in.Category = strings.TrimSpace(in.Category)
	in.Venue = strings.TrimSpace(in.Venue)
	in.City = strings.TrimSpace(in.City)
	if in.Title == "" || utf8.RuneCountInString(in.Title) > 120 {
		return "Give the event a title (max 120 characters)"
	}
	if in.Venue == "" {
		return "Add a venue"
	}
	if in.Category == "" {
		in.Category = "Event"
	}
	if in.StartsAt.IsZero() || in.EndsAt.IsZero() || !in.EndsAt.After(in.StartsAt) {
		return "The end time must be after the start time"
	}
	if in.Cover != "" && !okImageRef(in.Cover) {
		return "Invalid cover image"
	}
	gallery := []string{}
	for _, g := range in.Gallery {
		if okImageRef(g) {
			gallery = append(gallery, g)
		}
	}
	in.Gallery = gallery
	if len(in.Tiers) == 0 {
		return "Add at least one ticket type"
	}
	seen := map[string]bool{}
	for i := range in.Tiers {
		t := &in.Tiers[i]
		t.Name = strings.ToLower(strings.TrimSpace(t.Name))
		if t.Name != "regular" && t.Name != "vip" && t.Name != "vvip" {
			return "Ticket types must be regular, vip or vvip"
		}
		if seen[t.Name] {
			return "Each ticket type can only be added once"
		}
		seen[t.Name] = true
		if t.Price < 0 || t.Capacity < 0 || t.Price > 10_000_000 || t.Capacity > 1_000_000 {
			return "Check the ticket prices and capacities"
		}
		t.Perks = strings.TrimSpace(t.Perks)
	}
	return ""
}

func (a *App) adminCreateEvent(w http.ResponseWriter, r *http.Request) {
	var in eventInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if msg := in.validate(); msg != "" {
		writeError(w, 400, msg)
		return
	}
	ev := Event{
		ID: primitive.NewObjectID(), Title: in.Title, Description: in.Description, Category: in.Category,
		Venue: in.Venue, City: in.City, StartsAt: in.StartsAt.UTC(), EndsAt: in.EndsAt.UTC(),
		Cover: in.Cover, Gallery: in.Gallery, CreatedAt: time.Now(),
	}
	for _, t := range in.Tiers {
		ev.Tiers = append(ev.Tiers, Tier{Name: t.Name, Price: t.Price, Capacity: t.Capacity, Available: t.Capacity, Perks: t.Perks})
	}
	if _, err := a.events.InsertOne(r.Context(), ev); err != nil {
		writeError(w, 500, "Could not create the event")
		return
	}
	ev.normalize(time.Now())
	writeJSON(w, 201, ev)
}

func (a *App) adminUpdateEvent(w http.ResponseWriter, r *http.Request) {
	id, ok := oid(r.PathValue("id"))
	if !ok {
		writeError(w, 404, "Event not found")
		return
	}
	var in eventInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if msg := in.validate(); msg != "" {
		writeError(w, 400, msg)
		return
	}
	ctx := r.Context()
	old, err := a.loadEvent(ctx, id)
	if err != nil {
		writeError(w, 404, "Event not found")
		return
	}
	prev := map[string]Tier{}
	for _, t := range old.Tiers {
		prev[t.Name] = t
	}
	tiers := []Tier{}
	for _, t := range in.Tiers {
		sold := 0
		if p, ok := prev[t.Name]; ok {
			sold = p.Capacity - p.Available
		}
		avail := t.Capacity - sold
		if avail < 0 {
			avail = 0
		}
		tiers = append(tiers, Tier{Name: t.Name, Price: t.Price, Capacity: t.Capacity, Available: avail, Perks: t.Perks})
	}
	_, err = a.events.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{
		"title": in.Title, "description": in.Description, "category": in.Category, "venue": in.Venue,
		"city": in.City, "startsAt": in.StartsAt.UTC(), "endsAt": in.EndsAt.UTC(), "cover": in.Cover,
		"gallery": in.Gallery, "tiers": tiers,
	}})
	if err != nil {
		writeError(w, 500, "Could not save the event")
		return
	}
	ev, _ := a.loadEvent(ctx, id)
	writeJSON(w, 200, ev)
}

func (a *App) adminDeleteEvent(w http.ResponseWriter, r *http.Request) {
	id, ok := oid(r.PathValue("id"))
	if !ok {
		writeError(w, 404, "Event not found")
		return
	}
	n, err := a.orders.CountDocuments(r.Context(), bson.M{"eventId": id})
	if err != nil {
		writeError(w, 500, "Could not delete the event")
		return
	}
	if n > 0 {
		writeError(w, 409, "This event already has orders, so it can't be deleted. End the event instead.")
		return
	}
	if _, err := a.events.DeleteOne(r.Context(), bson.M{"_id": id}); err != nil {
		writeError(w, 500, "Could not delete the event")
		return
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// adminEventStatus lets the owner open the doors early ("live"), close the event ("ended")
// or go back to automatic timing ("auto").
func (a *App) adminEventStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := oid(r.PathValue("id"))
	if !ok {
		writeError(w, 404, "Event not found")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	override := ""
	switch body.Status {
	case "live", "ended":
		override = body.Status
	case "auto":
	default:
		writeError(w, 400, "Status must be live, ended or auto")
		return
	}
	res, err := a.events.UpdateOne(r.Context(), bson.M{"_id": id}, bson.M{"$set": bson.M{"override": override}})
	if err != nil || res.MatchedCount == 0 {
		writeError(w, 404, "Event not found")
		return
	}
	ev, _ := a.loadEvent(r.Context(), id)
	writeJSON(w, 200, ev)
}

func (a *App) adminUpload(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 12<<20)
	if err := r.ParseMultipartForm(12 << 20); err != nil {
		writeError(w, 400, "The image is too large (max 10 MB)")
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, 400, "No file received")
		return
	}
	defer file.Close()
	id, err := a.storeImage(r.Context(), file, "", true)
	if err != nil {
		writeError(w, 400, err.Error())
		return
	}
	writeJSON(w, 201, map[string]string{"url": "/uploads/" + id})
}

// ---------- attendance & check-in ----------

func (a *App) adminAttendees(w http.ResponseWriter, r *http.Request) {
	id, ok := oid(r.PathValue("id"))
	if !ok {
		writeError(w, 404, "Event not found")
		return
	}
	ctx := r.Context()
	ev, err := a.loadEvent(ctx, id)
	if err != nil {
		writeError(w, 404, "Event not found")
		return
	}
	cur, err := a.tickets.Find(ctx, bson.M{"eventId": id}, options.Find().SetSort(bson.D{{Key: "name", Value: 1}, {Key: "seq", Value: 1}}))
	if err != nil {
		writeError(w, 500, "Could not load attendees")
		return
	}
	tickets := []Ticket{}
	if err := cur.All(ctx, &tickets); err != nil {
		writeError(w, 500, "Could not load attendees")
		return
	}
	writeJSON(w, 200, map[string]any{
		"event": ev, "tickets": tickets, "total": len(tickets), "checkedIn": ev.CheckedIn,
	})
}

type checkinResp struct {
	Result     string  `json:"result"` // accepted | already | wrong_event | invalid
	Message    string  `json:"message"`
	Ticket     *Ticket `json:"ticket,omitempty"`
	Attendance int     `json:"attendance"`
	Total      int     `json:"total"`
}

func (a *App) counts(r *http.Request, eventID primitive.ObjectID) (int, int) {
	var ev Event
	attendance := 0
	if err := a.events.FindOne(r.Context(), bson.M{"_id": eventID}).Decode(&ev); err == nil {
		attendance = ev.CheckedIn
	}
	total, _ := a.tickets.CountDocuments(r.Context(), bson.M{"eventId": eventID})
	return attendance, int(total)
}

func (a *App) adminCheckin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token   string `json:"token"`
		EventID string `json:"eventId"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	ctx := r.Context()
	tok := tokenFromPayload(req.Token)
	var t Ticket
	if tok == "" || a.tickets.FindOne(ctx, bson.M{"token": tok}).Decode(&t) != nil {
		writeJSON(w, 200, checkinResp{Result: "invalid", Message: "This QR code is not a valid Tikit ticket."})
		return
	}
	attendance, total := a.counts(r, t.EventID)

	if want, ok := oid(req.EventID); ok && want != t.EventID {
		writeJSON(w, 200, checkinResp{Result: "wrong_event", Ticket: &t, Attendance: attendance, Total: total,
			Message: "This ticket is for a different event: " + t.EventTitle})
		return
	}

	now := time.Now()
	res, err := a.tickets.UpdateOne(ctx, bson.M{"_id": t.ID, "checkedIn": false},
		bson.M{"$set": bson.M{"checkedIn": true, "checkedInAt": now}})
	if err != nil {
		writeError(w, 500, "Could not check this ticket in, please scan again")
		return
	}
	if res.ModifiedCount == 0 { // somebody already used it
		_ = a.tickets.FindOne(ctx, bson.M{"_id": t.ID}).Decode(&t)
		writeJSON(w, 200, checkinResp{Result: "already", Ticket: &t, Attendance: attendance, Total: total,
			Message: "This ticket was already scanned."})
		return
	}
	_, _ = a.events.UpdateOne(ctx, bson.M{"_id": t.EventID}, bson.M{"$inc": bson.M{"checkedIn": 1}})
	t.CheckedIn, t.CheckedInAt = true, &now
	writeJSON(w, 200, checkinResp{Result: "accepted", Ticket: &t, Attendance: attendance + 1, Total: total,
		Message: "Welcome in!"})
}

// adminUndoCheckin reverses a scan made by mistake.
func (a *App) adminUndoCheckin(w http.ResponseWriter, r *http.Request) {
	id, ok := oid(r.PathValue("id"))
	if !ok {
		writeError(w, 404, "Ticket not found")
		return
	}
	ctx := r.Context()
	var t Ticket
	if err := a.tickets.FindOne(ctx, bson.M{"_id": id}).Decode(&t); err != nil {
		writeError(w, 404, "Ticket not found")
		return
	}
	res, err := a.tickets.UpdateOne(ctx, bson.M{"_id": id, "checkedIn": true},
		bson.M{"$set": bson.M{"checkedIn": false}, "$unset": bson.M{"checkedInAt": ""}})
	if err != nil {
		writeError(w, 500, "Could not undo the check-in")
		return
	}
	if res.ModifiedCount == 1 {
		_, _ = a.events.UpdateOne(ctx, bson.M{"_id": t.EventID}, bson.M{"$inc": bson.M{"checkedIn": -1}})
	}
	writeJSON(w, 200, map[string]bool{"ok": true})
}

// ---------- stats ----------

type EventStat struct {
	ID        primitive.ObjectID `json:"id"`
	Title     string             `json:"title"`
	Status    string             `json:"status"`
	Revenue   int                `json:"revenue"`
	Sold      int                `json:"sold"`
	Capacity  int                `json:"capacity"`
	CheckedIn int                `json:"checkedIn"`
	Pending   int                `json:"pending"`
	ByTier    map[string]int     `json:"byTier"`
}

type Stats struct {
	Revenue     int         `json:"revenue"`
	TicketsSold int         `json:"ticketsSold"`
	Pending     int         `json:"pending"`
	Approved    int         `json:"approved"`
	Rejected    int         `json:"rejected"`
	CheckedIn   int         `json:"checkedIn"`
	Events      []EventStat `json:"events"`
}

func (a *App) adminStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	cur, err := a.events.Find(ctx, bson.M{}, options.Find().SetSort(bson.D{{Key: "startsAt", Value: -1}}))
	if err != nil {
		writeError(w, 500, "Could not load stats")
		return
	}
	var events []Event
	if err := cur.All(ctx, &events); err != nil {
		writeError(w, 500, "Could not load stats")
		return
	}

	stat := Stats{Events: []EventStat{}}
	idx := map[primitive.ObjectID]int{}
	now := time.Now()
	for i := range events {
		e := &events[i]
		e.normalize(now)
		capacity := 0
		for _, t := range e.Tiers {
			capacity += t.Capacity
		}
		idx[e.ID] = len(stat.Events)
		stat.Events = append(stat.Events, EventStat{ID: e.ID, Title: e.Title, Status: e.Status,
			Capacity: capacity, CheckedIn: e.CheckedIn, ByTier: map[string]int{}})
		stat.CheckedIn += e.CheckedIn
	}

	type orderAgg struct {
		ID struct {
			EventID primitive.ObjectID `bson:"eventId"`
			Status  string             `bson:"status"`
		} `bson:"_id"`
		Count int `bson:"count"`
		Sum   int `bson:"sum"`
	}
	oc, err := a.orders.Aggregate(ctx, bson.A{bson.M{"$group": bson.M{
		"_id":   bson.M{"eventId": "$eventId", "status": "$status"},
		"count": bson.M{"$sum": 1},
		"sum":   bson.M{"$sum": "$total"},
	}}})
	if err == nil {
		var rows []orderAgg
		if oc.All(ctx, &rows) == nil {
			for _, row := range rows {
				switch row.ID.Status {
				case "pending":
					stat.Pending += row.Count
				case "rejected":
					stat.Rejected += row.Count
				case "approved":
					stat.Approved += row.Count
					stat.Revenue += row.Sum
				}
				if i, ok := idx[row.ID.EventID]; ok {
					switch row.ID.Status {
					case "approved":
						stat.Events[i].Revenue += row.Sum
					case "pending":
						stat.Events[i].Pending += row.Count
					}
				}
			}
		}
	}

	type ticketAgg struct {
		ID struct {
			EventID primitive.ObjectID `bson:"eventId"`
			Tier    string             `bson:"tier"`
		} `bson:"_id"`
		Count int `bson:"count"`
	}
	tc, err := a.tickets.Aggregate(ctx, bson.A{bson.M{"$group": bson.M{
		"_id":   bson.M{"eventId": "$eventId", "tier": "$tier"},
		"count": bson.M{"$sum": 1},
	}}})
	if err == nil {
		var rows []ticketAgg
		if tc.All(ctx, &rows) == nil {
			for _, row := range rows {
				stat.TicketsSold += row.Count
				if i, ok := idx[row.ID.EventID]; ok {
					stat.Events[i].Sold += row.Count
					stat.Events[i].ByTier[row.ID.Tier] += row.Count
				}
			}
		}
	}
	writeJSON(w, 200, stat)
}

// ---------- payment settings ----------

func (a *App) adminGetPaymentMethods(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, map[string]any{"methods": a.loadPayMethods(r.Context())})
}

func (a *App) adminSavePaymentMethods(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Methods []PayMethod `json:"methods"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	defaults := map[string]PayMethod{}
	for _, d := range defaultPayMethods() {
		defaults[d.Key] = d
	}
	out := []PayMethod{}
	seen := map[string]bool{}
	for _, m := range body.Methods {
		d, known := defaults[m.Key]
		if !known || seen[m.Key] {
			continue
		}
		seen[m.Key] = true
		m.Label = strings.TrimSpace(m.Label)
		if m.Label == "" || utf8.RuneCountInString(m.Label) > 60 {
			m.Label = d.Label
		}
		m.AccountName = strings.TrimSpace(m.AccountName)
		m.AccountNumber = strings.TrimSpace(m.AccountNumber)
		m.Note = strings.TrimSpace(m.Note)
		if m.Enabled && (m.AccountName == "" || m.AccountNumber == "") {
			writeError(w, 400, d.Label+": add the account name and number, or switch it off")
			return
		}
		out = append(out, m)
	}
	for _, d := range defaultPayMethods() { // keep all three entries
		if !seen[d.Key] {
			d.Enabled = false
			out = append(out, d)
		}
	}
	_, err := a.settings.UpdateOne(r.Context(), bson.M{"_id": "payment"},
		bson.M{"$set": bson.M{"methods": out}}, options.Update().SetUpsert(true))
	if err != nil {
		writeError(w, 500, "Could not save payment settings")
		return
	}
	writeJSON(w, 200, map[string]any{"methods": out})
}
