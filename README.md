# Field Officer Location Tracker

One link for field officers to submit their **photo, name, mobile number and location**, and a
manager dashboard to see everyone on a map and **search who is near any location**.

Runs entirely on Cloudflare — Workers + D1 + R2. Free tier covers normal use.

---

## What it does

### `/` — the field officer link

The only link you share with your team.

- Selfie capture (opens the phone camera; the image is resized and compressed in the browser before upload)
- Officer picks their name from a searchable dropdown, which auto-fills mobile, designation and branch
- **WhatsApp-style location picker** — the map opens on the officer's GPS position, the pin stays fixed
  in the centre while they drag the map to fine-tune it, there is a search box for landmarks, and a
  crosshair button to re-centre on GPS. The street address is read back live at the bottom.
- **Home location** — a separate one-time pin, saved against the officer so managers can see their base area
- Optional remarks field

### `/manager` — the dashboard

Passcode protected.

- **Radius search** — pick or search any point, set a radius from 1 to 100 km, and get every officer
  inside it sorted nearest-first with name, photo, mobile and exact distance
- **Map** with photo pins (blue = current location, orange = home). Click a pin for a card with
  tap-to-call, WhatsApp and Google Maps directions
- **Table** with Excel / CSV / Copy export
- **Analytics** — officers by city, check-in trend over the last 30 days
- Filters for city, officer, and location type, plus latest-per-officer vs full history

### `/admin` — officer master list

Passcode protected. Add officers one at a time, or paste your existing list straight from a
spreadsheet — it reads the header row, matches the Name / Mobile / Designation / Branch columns
automatically, and de-duplicates by mobile number so re-importing updates instead of duplicating.

---

## Setup

You need a free [Cloudflare account](https://dash.cloudflare.com/sign-up) and a GitHub account.

### 1. Put this on GitHub

```bash
unzip field-officer-tracker.zip
cd field-officer-tracker

git init
git add .
git commit -m "Field officer location tracker"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/field-officer-tracker.git
git push -u origin main
```

### 2. Create the database and the photo bucket

```bash
npm install

npx wrangler login          # opens your browser once

npx wrangler d1 create field-officers
npx wrangler r2 bucket create field-officer-photos
```

The `d1 create` command prints a `database_id`. Open **`wrangler.toml`** and paste it in, and put
your email in `CONTACT_EMAIL` while you are there:

```toml
[[d1_databases]]
binding       = "DB"
database_name = "field-officers"
database_id   = "abc12345-...."     # <- paste here

[vars]
ORG_NAME      = "SKD Health"
CONTACT_EMAIL = "you@yourcompany.com"
```

Commit that change:

```bash
git add wrangler.toml && git commit -m "Add D1 database id" && git push
```

### 3. Add your GitHub secrets

Go to your repo → **Settings → Secrets and variables → Actions → New repository secret**, and add:

| Secret name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → **My Profile → API Tokens → Create Token → Edit Cloudflare Workers** template. Make sure the token also has **D1 Edit** and **Workers R2 Storage Edit** permissions. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → **Workers & Pages** → the Account ID shown in the right sidebar |
| `MANAGER_PASS` | The passcode your managers will type at `/manager` |
| `ADMIN_PASS` | The passcode for `/admin` |
| `LOCATIONIQ_KEY` | Leave blank unless you are using LocationIQ (see *Geocoding* below) |

### 4. Deploy

Push anything to `main` — or open the **Actions** tab and run **Deploy to Cloudflare** manually.
The workflow applies the database migrations and deploys the Worker.

### 5. Confirm and share

Open **`https://field-officer-tracker.<your-subdomain>.workers.dev/setup`** once. It checks every
binding and confirms the tables exist.

Then:

1. Open `/admin`, paste in your officer list
2. Share the base URL with your field officers
3. Keep `/manager` for yourself

---

## Deploying without GitHub Actions

Everything works from your own machine too:

```bash
npx wrangler secret put MANAGER_PASS
npx wrangler secret put ADMIN_PASS

npm run db:migrate     # create the tables
npm run deploy
```

## Local development

```bash
cp .dev.vars.example .dev.vars     # then edit the passcodes
npm run db:migrate:local
npm run dev                        # http://localhost:8787
```

---

## Project layout

```
field-officer-tracker/
├─ src/
│  ├─ index.js            Worker entry point — routing, API, D1 queries, R2, auth, geocoding
│  └─ ui/
│     ├─ page.js          Assembles the HTML document
│     ├─ styles.js        All CSS
│     └─ client.js        The browser app (React 18 + JSX, compiled in-browser by Babel)
├─ migrations/
│  └─ 0001_init.sql       Database schema
├─ .github/workflows/
│  └─ deploy.yml          Push to main → migrate + deploy
├─ wrangler.toml          Bindings and variables
└─ .dev.vars.example      Local secrets template
```

There is **no build step**. The browser app is served as JSX and compiled on the fly by Babel
Standalone, so `wrangler deploy` ships the source directly.

---

## Geocoding

Street addresses come from **OpenStreetMap Nominatim**, which is free and needs no API key. Every
lookup is cached for 7 days at the Cloudflare edge and the map is debounced by 700 ms, which keeps
you comfortably inside their usage policy for a normal field team.

Two things worth knowing:

- Set `CONTACT_EMAIL` in `wrangler.toml`. OpenStreetMap asks for a contact address in the request,
  and traffic without one is more likely to be rate-limited.
- Address detail is good in Indian cities and thinner in rural areas. **Coordinates are always
  exact regardless** — only the street-name text varies.

If you outgrow it, sign up for [LocationIQ](https://locationiq.com) (5,000 requests/day free), add
the key as the `LOCATIONIQ_KEY` secret, and the Worker switches over automatically. No code change.

---

## Data model

**`officers`** — one row per officer, keyed by mobile number. Holds name, designation, branch, home
location and the latest photo. Created automatically the first time someone checks in, or in bulk
from `/admin`.

**`checkins`** — one row per submission, never overwritten, so you keep the full movement history.
Photos live in R2 under `photos/<mobile>-<timestamp>.jpg` and are served through `/photo/<key>` with
a one-year cache header. The bucket itself stays private — images are only reachable through the Worker.

Query it any time:

```bash
npm run db:console
```

---

## Security notes

- `/manager` and `/admin` are passcode-gated; the passcode is sent with every API call and validated
  server-side with a constant-time comparison.
- The officer check-in endpoint is intentionally open — field staff should not need a login. If you
  want it locked down too, put [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/)
  in front of the Worker.
- Never commit `.dev.vars` or put passcodes in `wrangler.toml`. Secrets belong in
  `wrangler secret put` or GitHub repository secrets.

---

## Costs

| | Free tier | This app |
| --- | --- | --- |
| Workers | 100,000 requests/day | A 50-officer team uses a few hundred |
| D1 | 5 GB, 5M reads/day | Thousands of check-ins is a few MB |
| R2 | 10 GB storage | ~80 KB per photo after compression |

Practically, a field team of this size runs at no cost.
