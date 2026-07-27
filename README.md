# GoPark

GoPark helps drivers in Singapore find parking, users search where they're going and GoPark shows nearby carparks with their rates, how many lots are free right now, and how far they'd walk from the carpark to the destination. There's a live map, real-time availability, and the weather at the destination so user know if that extra 100m walk is worth it.

Most parking apps only cover HDB carparks. We wanted one app that pulls government data, commercial carparks, and rates scraped from the web into one place.

## Features

- Search any address, place name, or 6-digit postal code in Singapore and see nearby carparks ranked by cost and walking distance
- Compare rates, available lots, and walking time side by side, with the actual total price for your stay computed from your arrival time
- Leaflet map with clustered markers so 3,500+ carparks don't become a mess of pins
- Multiple map styles: OneMap, Roads, Satellite, dark basemap, a 3D buildings layer from Overpass API, and a full 3D view
- Live lot counts refreshed every minute, with a URA feed covering 183 roadside and coupon carparks
- Popular times graph per carpark built from hourly occupancy history, Google-style with the current hour highlighted
- Live traffic ticker from LTA with roadworks, accidents and heavy traffic near your route
- Car and motorcycle modes, each with its own lots, rates and ranking
- User accounts with email verification, password reset, and account lockout after failed attempts
- Save favorite carparks to user account
- Dark mode, and a proper mobile layout with a draggable bottom sheet instead of a shrunk desktop site

## Architecture

Docker Compose with four containers in production:

**Frontend** - React 19, TypeScript, Tailwind v4, Vite, Leaflet via react-leaflet. 3D buildings use OSMBuildings reading Overpass tiles.

**Backend** - Node 22, Express 5, TypeScript. Serves the API and runs cron jobs:
- Availability refresh every minute (Gov, DataMall, Parkaholic, JustPark)
- Full multi-source carpark merge every 6 hours
- Occupancy snapshot every hour, popular-times profiles computed at midnight
- Web scraper sweep every 7 days, each page rechecked monthly

**Database** - PostgreSQL 15 with PostGIS, managed through Prisma. Stores carparks, parsed rates, live availability, hourly snapshots, popular-times trends, user accounts, favorites, password history, and scraper cache.

**nginx** reverse proxies everything. In prod, a Cloudflare Tunnel exposes it without opening host ports.

The data engine merges carparks from 7 sources onto one shared ID per carpark, deduplicating by source ID, coordinates and name so two feeds never produce two pins. It parses messy rate strings like "$1.20 per half hour, $2 entry after 6pm" into structured json records to be inserted in the db. An AI scraper handles carparks whose rates aren't in any public dataset: it searches the web via DuckDuckGo and uses an LLM to extract rates from the pages it finds.

The LLM backend is swappable, use ZhipuAI's cloud API (no GPU needed) or run a local vLLM container with an NVIDIA card.

## Setup

Need Docker, Docker Compose, and a few API keys.

```bash
git clone https://github.com/sharylkwang/gopark.git
cd gopark
cp .env.example .env   # fill in your keys
docker compose up --build
```

Open http://localhost.

For local LLM with GPU:
```bash
docker compose --profile gpu up --build
```

## API keys

| Key | Required | What for |
|-----|----------|----------|
| `GEOAPIFY_KEY` | Yes | Geocoding search queries |
| `DATAGOVSG_KEY` | Yes | HDB carpark data + live availability |
| `DATAMALL_API` | Yes | Commercial / URA carparks |
| `GOOGLE_MAPS_KEY` | No | Google map tiles, routes and 3D view |
| `URA_ACCESS_KEY` | No | URA live lots, rates and season carparks |
| `ONEMAP_EMAIL` / `ONEMAP_EMAIL_PASSWORD` | Yes | Postal code search and walking routes |
| `ZHIPUAI_API_KEY` | No | Cloud LLM for rate scraping |
| `JWT_SECRET` | Yes | Auth token signing |
| `EMAIL_USER` / `EMAIL_APP_PASSWORD` | Yes | Sending OTP verification emails |
| `TURNSTILE_SECRET_KEY` | Yes (prod) | Cloudflare Turnstile captcha |

Without the optional keys the app still works, you just lose Google tile styles and URA roadside live lots, and without an LLM the scraper only uses public datasets.

## Data sources

| Source | ~Count | What it gives us |
|--------|--------|------------------|
| data.gov.sg (mapping) | 2,000 | HDB locations, addresses, carpark type |
| data.gov.sg (availability) | 2,000 | Live lot counts by vehicle type |
| LTA DataMall | 500 | Malls, private developments, traffic incidents |
| URA Data Service | 183 | Roadside and coupon carparks, live lots, rates |
| Parkaholic | 4,000 | Locations, availability, rate text |
| CapitaLand JustPark | 90 | Mall rates and live lot balance |
| SGCarMart | 1,100 | Weekday/Saturday/Sunday rates |
| OneMotoring, GetGo, SgBikes | varies | Official, CBD, and motorcycle rates (AI-scraped) |

## How we keep the code sane

Some examples of the engineering principles we follow, with the actual code.

**One job per function.** `estimateCost` only does parking math. It doesnt fetch anything, doesnt touch the UI, you give it rates and a duration and it gives you back a price. That's why we can use the exact same function for ranking carparks, the detail panel, and the mobile view without them drifting apart (thats the DRY part too).

```ts
export function estimateCost(rates: CarparkRate[], hours: number, vehicleType: string, startAt?: Date): number | null
```

**Merge only what you actually know.** Early on a source that only publishes capacity kept wiping out live counts from another source. So the merge is field by field now, each source only updates the fields it really has:

```ts
function mergeAvailability(cp: MergedCarpark, avail: Record<string, AvailabilityEntry>) {
  for (const [lt, e] of Object.entries(avail)) {
    const cur = cp.availability[lt];
    if (!cur) {
      cp.availability[lt] = { ...e };
    } else {
      if (e.available != null) cur.available = e.available;
      if (e.total != null) cur.total = e.total;
    }
  }
}
```

There are regression tests pinning this down so it cannot quietly come back.

**Auth in one place.** Every private route goes through the same `requireAuth` middleware, it accepts the token from the Authorization header or the HttpOnly cookie and nothing else. Routes never do their own token checking.

```ts
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const cookieToken = req.cookies?.gopark_token;
  ...
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
```

**Shared types instead of guessing shapes.** The frontend and the ranking and the map all pass around the same `CarparkSummary`, so if the shape changes the build breaks instead of the app breaking at runtime:

```ts
export interface CarparkSummary {
  id: string;
  name: string;
  lat: number;
  lng: number;
  availability: Record<string, CarparkAvailability>;
  distance?: number;
  estimatedCost?: number | null;
}
```

**Expect the outside world to fail.** All 7 carpark feeds are fetched with `Promise.allSettled`, one source going down just means we merge without it that cycle instead of the whole refresh dying:

```ts
const [govR, dmR, pkR, jpR, uraR] = await Promise.allSettled([fetchAvailability(), fetchDatamall(), fetchDump(), fetchJustparkAvailability(), fetchUraLive()]);
```

Same idea in the UI, if a route fetch fails we just clear the route line instead of crashing the map.

## Team
NUS Orbital 2026