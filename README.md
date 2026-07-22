# GoPark

GoPark helps drivers in Singapore find parking, users search where they're going and GoPark shows nearby carparks with their rates, how many lots are free right now, and how far they'd walk from the carpark to the destination. There's a live map, real-time availability, and the weather at the destination so user know if that extra 100m walk is worth it.

Most parking apps only cover HDB carparks. We wanted one app that pulls government data, commercial carparks, and rates scraped from the web into one place.

## Features

- Search any address or place name in Singapore and see the closest carparks ranked by walking distance
- Compare rates, available lots, and walking time side by side
- Leaflet map with clustered markers so 3,500+ carparks don't become a mess of pins
- Multiple map styles OneMap, OSM, Google Roads, Google Hybrid, and a 3D buildings layer from Overpass API
- Live lot counts refreshed every couple minutes
- User accounts with email verification, password reset, and account lockout after failed attempts
- Save favorite carparks to user account
- Estimated parking cost based on how long users plan to stay

## Architecture

Docker Compose with four containers in production:

**Frontend** - React 19, TypeScript, Tailwind v4, Vite, Leaflet via react-leaflet. 3D buildings use OSMBuildings reading Overpass tiles.

**Backend** - Node 22, Express 5, TypeScript. Serves the API and runs cron jobs:
- Availability refresh every 2 minutes (Gov, DataMall, Parkaholic)
- Full multi-source carpark merge every 6 hours
- Web scraper crawl every 30 days

**Database** - PostgreSQL 15 with PostGIS, managed through Prisma. Stores carparks, parsed rates, live availability, user accounts, favorites, password history, and scraper cache.

**nginx** reverse proxies everything. In prod, a Cloudflare Tunnel exposes it without opening host ports.

The data engine merges carparks from 6+ sources and deduplicates by coordinates. It parses messy rate strings like "$1.20 per half hour, $2 entry after 6pm" into structured json records to be inserted in the db. An AI scraper handles carparks whose rates aren't in any public dataset it searches the web via DuckDuckGo and uses an LLM to extract rates from the pages it finds.

The LLM backend is swappable use ZhipuAI's cloud API (no GPU needed) or run a local vLLM container with an NVIDIA card.

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
| `GOOGLE_MAPS_KEY` | No | Google map tiles |
| `URA_ACCESS_KEY` | No | URA live car park lots overlay |
| `ZHIPUAI_API_KEY` | No | Cloud LLM for rate scraping |
| `JWT_SECRET` | Yes | Auth token signing |
| `EMAIL_USER` / `EMAIL_APP_PASSWORD` | Yes | Sending OTP verification emails |
| `TURNSTILE_SECRET_KEY` | Yes (prod) | Cloudflare Turnstile captcha |

Without the optional keys the app still works  you just lose Google tile styles, and without an LLM the scraper only uses public datasets.

## Data sources

| Source | ~Count | What it gives us |
|--------|--------|------------------|
| data.gov.sg (mapping) | 2,000 | HDB locations, addresses, carpark type |
| data.gov.sg (availability) | 2,000 | Live lot counts by vehicle type |
| LTA DataMall | 500 | Malls and private developments |
| Parkaholic | 4,700 | Locations, availability, rate text |
| SGCarMart | 1,100 | Weekday/Saturday/Sunday rates |
| OneMotoring, GetGo, SgBikes | varies | Official, CBD, and motorcycle rates (AI-scraped) |