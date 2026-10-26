package main

import (
	"context"
	"fmt"
	"hash/fnv"
	"html"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// seedDemo fills an empty database with a few demo events so the websites look alive
// on first run. Turn it off with SEED_DEMO=false.
func (a *App) seedDemo() {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	if n, err := a.events.CountDocuments(ctx, bson.M{}); err != nil || n > 0 {
		return
	}

	now := time.Now()
	day := 24 * time.Hour
	at := func(offsetDays int, hour int) time.Time {
		d := now.Add(time.Duration(offsetDays) * day)
		return time.Date(d.Year(), d.Month(), d.Day(), hour, 0, 0, 0, d.Location()).UTC()
	}

	type seed struct {
		title, desc, category, venue, city string
		start, end                         time.Time
		hueA, hueB                         int
		tiers                              []Tier
		checkedIn                          int
	}
	tiers := func(r, v, vv int, cr, cv, cvv int) []Tier {
		return []Tier{
			{Name: "regular", Price: r, Capacity: cr, Available: cr, Perks: "General entry"},
			{Name: "vip", Price: v, Capacity: cv, Available: cv, Perks: "Front stage zone + welcome drink"},
			{Name: "vvip", Price: vv, Capacity: cvv, Available: cvv, Perks: "Private lounge, table service, meet & greet"},
		}
	}

	seeds := []seed{
		{"Addis Neon Nights", "A full night of electronic sound, laser light and rooftop energy. Three stages, twelve artists, one skyline. Doors open at 7 PM and the lights stay on until sunrise.",
			"Music", "Skyline Terrace", "Addis Ababa", at(9, 19), at(10, 3), 265, 320, tiers(800, 2000, 5000, 400, 120, 30), 0},
		{"Future Fest: Tech & Creators", "Talks, live demos and a creators' market for builders, designers and dreamers. Meet the people shaping the next decade of African tech.",
			"Conference", "Innovation Hall", "Addis Ababa", at(16, 9), at(16, 18), 190, 230, tiers(500, 1500, 3500, 600, 150, 40), 0},
		{"Gojo Comedy Live", "The funniest voices in the country on one stage. Two hours of stand-up, sketches and surprise guests.",
			"Comedy", "Theatre Garden", "Addis Ababa", at(23, 18), at(23, 22), 25, 350, tiers(450, 1200, 2800, 250, 80, 20), 0},
		{"Promo Night Live", "Our biggest promo night of the season is happening right now. Live DJs, performances and giveaways until late. Show your ticket QR at the gate.",
			"Party", "Club Aurora", "Addis Ababa", now.Add(-2 * time.Hour).UTC(), now.Add(5 * time.Hour).UTC(), 330, 20, tiers(600, 1800, 4500, 500, 100, 25), 214},
		{"Timket Beats Festival", "A sold-out celebration of rhythm, colour and tradition. Thousands joined us for two days of live music.",
			"Festival", "Meskel Square", "Addis Ababa", at(-60, 14), at(-59, 2), 150, 40, tiers(400, 1000, 2500, 2000, 300, 60), 1840},
		{"Rooftop Sessions Vol. 3", "Acoustic sunsets, craft drinks and city views. Volume 3 was our most intimate one yet.",
			"Music", "Skyline Terrace", "Addis Ababa", at(-24, 17), at(-24, 23), 20, 300, tiers(600, 1400, 3000, 300, 80, 20), 620},
	}

	for _, s := range seeds {
		slug := strings.ToLower(strings.Join(strings.FieldsFunc(s.title, func(r rune) bool {
			return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9')
		}), "-"))
		dir := filepath.Join(a.cfg.UploadDir, "seed")
		_ = os.MkdirAll(dir, 0o755)
		var gallery []string
		cover := ""
		for v := 0; v < 4; v++ {
			file := fmt.Sprintf("%s-%d.svg", slug, v)
			svg := posterSVG(s.title, s.category, s.hueA, s.hueB, v)
			if err := os.WriteFile(filepath.Join(dir, file), []byte(svg), 0o644); err != nil {
				log.Printf("seed image: %v", err)
				continue
			}
			url := "/uploads/seed/" + file
			if v == 0 {
				cover = url
			} else {
				gallery = append(gallery, url)
			}
		}
		ev := Event{
			ID: primitive.NewObjectID(), Title: s.title, Description: s.desc, Category: s.category,
			Venue: s.venue, City: s.city, StartsAt: s.start, EndsAt: s.end, Cover: cover, Gallery: gallery,
			Tiers: s.tiers, CheckedIn: s.checkedIn, CreatedAt: now,
		}
		if _, err := a.events.InsertOne(ctx, ev); err != nil {
			log.Printf("seed event: %v", err)
		}
	}
	log.Println("Seeded demo events (set SEED_DEMO=false to disable)")
}

// posterSVG draws an abstract, colourful poster. Real events use uploaded photos instead.
func posterSVG(title, category string, hueA, hueB, variant int) string {
	h := fnv.New64a()
	_, _ = h.Write([]byte(fmt.Sprintf("%s-%d", title, variant)))
	rng := rand.New(rand.NewSource(int64(h.Sum64())))

	w, hgt := 1200, 800
	var b strings.Builder
	fmt.Fprintf(&b, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d">`, w, hgt, w, hgt)
	fmt.Fprintf(&b, `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(%d,85%%,52%%)"/><stop offset="1" stop-color="hsl(%d,90%%,22%%)"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="46"/></filter></defs>`,
		(hueA+variant*28)%360, (hueB+variant*28)%360)
	fmt.Fprintf(&b, `<rect width="%d" height="%d" fill="url(#g)"/>`, w, hgt)
	for i := 0; i < 7; i++ {
		hue := (hueA + rng.Intn(120)) % 360
		fmt.Fprintf(&b, `<circle cx="%d" cy="%d" r="%d" fill="hsl(%d,95%%,62%%)" opacity="0.%d" filter="url(#b)"/>`,
			rng.Intn(w), rng.Intn(hgt), 90+rng.Intn(220), hue, 3+rng.Intn(4))
	}
	switch variant % 3 {
	case 0:
		for i := 0; i < 14; i++ {
			x := 40 + i*86
			bh := 60 + rng.Intn(360)
			fmt.Fprintf(&b, `<rect x="%d" y="%d" width="38" height="%d" rx="19" fill="white" opacity="0.%d"/>`, x, hgt-bh-60, bh, 1+rng.Intn(3))
		}
	case 1:
		for i := 0; i < 9; i++ {
			fmt.Fprintf(&b, `<circle cx="%d" cy="%d" r="%d" fill="none" stroke="white" stroke-width="2" opacity="0.%d"/>`,
				w/2, hgt/2, 60+i*55, 1+rng.Intn(3))
		}
	default:
		for i := 0; i < 26; i++ {
			fmt.Fprintf(&b, `<line x1="%d" y1="0" x2="%d" y2="%d" stroke="white" stroke-width="1.5" opacity="0.12"/>`, i*50, i*50-260, hgt)
		}
	}
	// title, wrapped to ~14 characters per line
	var lines []string
	cur := ""
	for _, word := range strings.Fields(title) {
		if len(cur)+len(word) > 14 && cur != "" {
			lines = append(lines, cur)
			cur = word
		} else if cur == "" {
			cur = word
		} else {
			cur += " " + word
		}
	}
	if cur != "" {
		lines = append(lines, cur)
	}
	if len(lines) > 3 {
		lines = lines[:3]
	}
	y := 330 - (len(lines)-1)*50
	if variant == 0 {
		for _, l := range lines {
			fmt.Fprintf(&b, `<text x="70" y="%d" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="104" fill="white">%s</text>`, y, html.EscapeString(l))
			y += 104
		}
		fmt.Fprintf(&b, `<text x="72" y="130" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="28" letter-spacing="8" fill="white" opacity="0.85">%s</text>`, html.EscapeString(strings.ToUpper(category)))
	} else {
		fmt.Fprintf(&b, `<text x="70" y="%d" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="46" letter-spacing="6" fill="white" opacity="0.8">%s</text>`, hgt-70, html.EscapeString(strings.ToUpper(title)))
	}
	b.WriteString(`</svg>`)
	return b.String()
}
