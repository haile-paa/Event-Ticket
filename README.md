# tikit. — event ticketing you can white-label

Three parts in one repo:

| Part | Folder | Port | What it is |
|---|---|---|---|
| Customer website | `apps/customer` | 3000 | Next.js · Tailwind · Three.js. Browse upcoming / live / past events, buy tickets, pay, get the QR receipt |
| Owner console | `apps/admin` | 3001 | Approve payments, manage events, scan tickets, live attendance (for the organizer) |
| **Developer Studio** (secret) | `apps/studio` | 3002 | The white-label **Customizer**. Only for you, the developer. Protected by `DEV_KEY`; connects to any client's server |
| API | `backend` | 8080 | Go + MongoDB |

Logo files: `LOGO.svg` (full), `packages/shared/logo-mark.svg` (app icon).

## Run it

```bash
# 1. database + API
docker compose up -d mongo          # or use your own MongoDB
cd backend && go mod tidy && go run .   # first run seeds 6 demo events

# 2. websites (new terminals, from the repo root)
npm install
npm run dev:customer                # http://localhost:3000
npm run dev:admin                   # http://localhost:3001   (PIN 2468)
npm run dev:studio                  # http://localhost:3002   (developer only, needs DEV_KEY)
```

Each app reads `NEXT_PUBLIC_API_URL` (copy `.env.example` to `.env.local`). The API reads a **file** named `backend/.env` (copy `backend/.env.example` to `backend/.env`; it is loaded automatically). It needs MongoDB running first, and must be started with `go run .` from the `backend` folder.

## How a sale works

1. Customer picks Regular / VIP / VVIP (several tickets allowed), enters name + phone (no account).
2. Chooses Telebirr, CBE or Bank of Abyssinia → sees the account to pay → uploads a screenshot **or** pastes the bank SMS.
3. Order is **Pending**. It appears in *Admin → Orders* with name, phone, proof and amount. Admin taps **Approve** or **Reject**.
4. The customer's page flips from Pending to Approved with an animation + confetti and shows one QR ticket per person (download as PNG or screenshot). Tickets are held while pending and released on reject.
5. At the gate, *Admin → Scanner* scans the QR: shows name, phone, section, amount and **Accepted / Already scanned / Wrong event / Invalid**. Each accepted scan adds one to the event's attendance.
6. Customers see only the attendance **number** (live events show "X inside now"); admins see the full list with name, phone and section.

## The Customizer (selling to companies)

The **Developer Studio** (`apps/studio`, never deployed to the client) changes everything without code, with a live preview:

- **Brand**: name, tagline, logo, favicon, contact buttons, browser title
- **Colors & fonts**: 7 presets + custom colors, font pairs (incl. Amharic font)
- **Homepage**: hero text, 3D ticket text or your own image, scrolling banner, sections, footer
- **All texts**: ~70 labels (checkout, order status, receipt…) — translate the whole site to Amharic
- **Tickets**: currency, tickets-per-order limit, rename Regular/VIP/VVIP and set their colors
- **Payments**: account names/numbers for Telebirr, CBE, BoA, switch each on/off
- **Security**: set / reset the organizer's admin PIN
- **Client packs**: export one JSON file with a client's whole setup; import it into a fresh install

### Suggested workflow per client
1. Deploy a fresh copy (own database name `MONGO_DB=clientname`, `SEED_DEMO=false`, own `ADMIN_PIN`, and your own secret `DEV_KEY`). Give the organizer only the customer site, the admin site and the admin PIN. Keep the Studio and the `DEV_KEY` to yourself.
2. Open the Studio (http://localhost:3002), add the client's API address + `DEV_KEY`, set the brand, colors, texts, payment accounts, upload logo.
3. Export the pack and keep it as that client's backup.

## Production notes
- Camera scanning requires **HTTPS** (or localhost).
- Set `CORS_ORIGINS` to your two real website URLs and `NEXT_PUBLIC_API_URL` to the public API URL.
- Back up the database. Event photos, logos and payment proofs are stored inside MongoDB too (collection `files`), so one database backup covers everything. Atlas free tier has 512 MB, so tell clients to upload reasonably sized photos.
- Run behind a reverse proxy and set `TRUST_PROXY=true` so rate limits see real IPs.
- Payments are confirmed by a person comparing proof with the account; there is no bank API.
