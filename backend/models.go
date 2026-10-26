package main

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ---------- Events ----------

type Tier struct {
	Name      string `bson:"name" json:"name"` // regular | vip | vvip
	Price     int    `bson:"price" json:"price"`
	Capacity  int    `bson:"capacity" json:"capacity"`
	Available int    `bson:"available" json:"available"`
	Perks     string `bson:"perks" json:"perks"`
}

type Event struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	Category    string             `bson:"category" json:"category"`
	Venue       string             `bson:"venue" json:"venue"`
	City        string             `bson:"city" json:"city"`
	StartsAt    time.Time          `bson:"startsAt" json:"startsAt"`
	EndsAt      time.Time          `bson:"endsAt" json:"endsAt"`
	Cover       string             `bson:"cover" json:"cover"`
	Gallery     []string           `bson:"gallery" json:"gallery"`
	Tiers       []Tier             `bson:"tiers" json:"tiers"`
	CheckedIn   int                `bson:"checkedIn" json:"checkedIn"` // people who have entered
	Override    string             `bson:"override" json:"override"`   // "", "live", "ended"
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	Status      string             `bson:"-" json:"status"` // upcoming | live | past (computed)
}

type EventBrief struct {
	ID       primitive.ObjectID `json:"id"`
	Title    string             `json:"title"`
	Cover    string             `json:"cover"`
	Venue    string             `json:"venue"`
	City     string             `json:"city"`
	StartsAt time.Time          `json:"startsAt"`
	EndsAt   time.Time          `json:"endsAt"`
	Status   string             `json:"status"`
}

func eventStatus(e *Event, now time.Time) string {
	switch e.Override {
	case "live":
		return "live"
	case "ended":
		return "past"
	}
	if now.Before(e.StartsAt) {
		return "upcoming"
	}
	if now.After(e.EndsAt) {
		return "past"
	}
	return "live"
}

func (e *Event) normalize(now time.Time) {
	if e.Gallery == nil {
		e.Gallery = []string{}
	}
	if e.Tiers == nil {
		e.Tiers = []Tier{}
	}
	e.Status = eventStatus(e, now)
}

func (e *Event) brief() *EventBrief {
	return &EventBrief{ID: e.ID, Title: e.Title, Cover: e.Cover, Venue: e.Venue, City: e.City,
		StartsAt: e.StartsAt, EndsAt: e.EndsAt, Status: e.Status}
}

// ---------- Orders & tickets ----------

type OrderItem struct {
	Tier      string `bson:"tier" json:"tier"`
	Qty       int    `bson:"qty" json:"qty"`
	UnitPrice int    `bson:"unitPrice" json:"unitPrice"`
}

type Proof struct {
	ImageURL string `bson:"imageUrl" json:"imageUrl"`
	SMSText  string `bson:"smsText" json:"smsText"`
}

type Order struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Code         string             `bson:"code" json:"code"`
	EventID      primitive.ObjectID `bson:"eventId" json:"eventId"`
	EventTitle   string             `bson:"eventTitle" json:"eventTitle"`
	Name         string             `bson:"name" json:"name"`
	Phone        string             `bson:"phone" json:"phone"`
	Method       string             `bson:"method" json:"method"` // telebirr | cbe | abyssinia
	Items        []OrderItem        `bson:"items" json:"items"`
	TotalTickets int                `bson:"totalTickets" json:"totalTickets"`
	Total        int                `bson:"total" json:"total"`
	Proof        Proof              `bson:"proof" json:"proof"`
	Status       string             `bson:"status" json:"status"` // pending | approved | rejected
	RejectReason string             `bson:"rejectReason" json:"rejectReason"`
	CreatedAt    time.Time          `bson:"createdAt" json:"createdAt"`
	DecidedAt    *time.Time         `bson:"decidedAt,omitempty" json:"decidedAt"`
}

type Ticket struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Token       string             `bson:"token" json:"token"`
	OrderID     primitive.ObjectID `bson:"orderId" json:"orderId"`
	OrderCode   string             `bson:"orderCode" json:"orderCode"`
	EventID     primitive.ObjectID `bson:"eventId" json:"eventId"`
	EventTitle  string             `bson:"eventTitle" json:"eventTitle"`
	Name        string             `bson:"name" json:"name"`
	Phone       string             `bson:"phone" json:"phone"`
	Tier        string             `bson:"tier" json:"tier"`
	Price       int                `bson:"price" json:"price"`
	Seq         int                `bson:"seq" json:"seq"`
	OfTotal     int                `bson:"ofTotal" json:"ofTotal"`
	CheckedIn   bool               `bson:"checkedIn" json:"checkedIn"`
	CheckedInAt *time.Time         `bson:"checkedInAt,omitempty" json:"checkedInAt"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
}

// OrderView is what the websites receive: the order, its tickets and a short event card.
type OrderView struct {
	Order
	Tickets []Ticket    `json:"tickets"`
	Event   *EventBrief `json:"event,omitempty"`
}

// ---------- Settings ----------

type PayMethod struct {
	Key           string `bson:"key" json:"key"` // telebirr | cbe | abyssinia
	Label         string `bson:"label" json:"label"`
	AccountName   string `bson:"accountName" json:"accountName"`
	AccountNumber string `bson:"accountNumber" json:"accountNumber"`
	Note          string `bson:"note" json:"note"`
	Enabled       bool   `bson:"enabled" json:"enabled"`
}

type PaymentSettings struct {
	ID      string      `bson:"_id" json:"-"`
	Methods []PayMethod `bson:"methods" json:"methods"`
}

func defaultPayMethods() []PayMethod {
	return []PayMethod{
		{Key: "telebirr", Label: "Telebirr", AccountName: "Tikit Events PLC", AccountNumber: "0911 000 000",
			Note: "Send the exact amount to this Telebirr number.", Enabled: true},
		{Key: "cbe", Label: "Commercial Bank of Ethiopia", AccountName: "Tikit Events PLC", AccountNumber: "1000 0000 00000",
			Note: "Transfer from CBE Birr, mobile banking or any branch.", Enabled: true},
		{Key: "abyssinia", Label: "Bank of Abyssinia", AccountName: "Tikit Events PLC", AccountNumber: "0000 0000 0000",
			Note: "Transfer from BoA mobile banking or any branch.", Enabled: true},
	}
}
