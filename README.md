# GoPark

GoPark helps drivers in Singapore figure out where to park. You type in where you're headed, and it shows you the carparks nearby - what they charge, how many lots are free right now, and how far you'd have to walk once you've parked. There's a live map, real-time availability, and even the current weather at your destination so you know whether that extra 200m walk is worth it.

We built it for NUS Orbital 2026. Parking apps already exist, but most of them either only cover HDB carparks or hide the pricing until you're already circling the block. We wanted one place that pulls everything together - government data, commercial carparks, and rate information scraped from across the web - and just answers the question "where should I park?"

## What it does

- **Search any destination.** Type an address or place name and we geocode it, then surface the closest carparks around it.
- **Compare at a glance.** Each carpark shows its weekday/weekend rate, available lots, rate type, and walking time, so you can weigh "cheap but far" against "pricey but right there."
- **A real map.** Leaflet-based, with clustered pins so 3,500+ carparks don't turn into a wall of markers. Tap a pin for details, and the camera flies you to your search or your location.
- **Switch how the map looks.** OneMap, OpenStreetMap, Google Roads, Google Hybrid, plus a 3D buildings view rendered from OpenStreetMap data via the Overpass API.
- **Live availability.** Lot counts refresh every couple of minutes from the sources that publish them.
- **Weather where you're going.** A two-hour forecast from data.gov.sg, pinned to your destination - or to your precise location if you share it.
- **Knows where you are.** If you've already granted location access, it quietly drops a blue dot on the map and flies you there on load. No nagging pop-ups.

## How it's put together

It's a Docker Compose setup with a few moving parts.

**Frontend** - React 19 + TypeScript, Tailwind CSS v4, Vite for the build, and Leaflet (via react-leaflet) for the map. The 3D buildings come from OSMBuildings reading Overpass tiles.

**Backend** - Node 22 with Express 5 and TypeScript. It serves the API the frontend talks to, plus a set of cron jobs that keep the data fresh:

- availability counts refresh every 2 minutes (Gov, DataMall, Parkaholic)
- a full multi-source merge runs every 6 hours
- the scraper does a deeper web crawl every 30 days

**The data engine** is the part we're most proud of. Carpark info is scattered - HDB has one dataset, LTA's DataMall has another, and a lot of the actual *pricing* only exists as free text on commercial carpark websites. So the backend:

- merges carparks from 6+ sources and de-duplicates them by matching coordinates (anything within ~111m is treated as the same carpark)
- parses messy rate strings like "$1.20 per half hour, $2 entry after 6pm" into structured entries with amounts, durations, time windows, and vehicle types
- flags rates that show up in more than one source as more trustworthy
- runs an **AI scraper** for the carparks whose rates aren't in any public dataset: it searches the web (via DuckDuckGo, not a hardcoded URL list) and uses an LLM to pull the rates out

The LLM backend is swappable - set a Z.AI GLM key and it uses their cloud API (no GPU needed), or run a local vLLM container if you've got an NVIDIA card.

**Database** - PostgreSQL 15 with Prisma. Carparks, parsed rates, live availability, and the scraper's page cache each get their own table.

**nginx** sits in front as a reverse proxy, and in production a Cloudflare Tunnel exposes it without opening any host ports.

## Running it

You'll need Docker and Docker Compose, and a few API keys (see below).

```bash
git clone https://github.com/sharylkwang/gopark.git
cd gopark

cp .env.example .env
# fill in your keys

docker compose up --build
```

Then open **http://localhost**.

If you have an NVIDIA GPU and want to run the scraper's LLM locally instead of using the cloud API:

```bash
docker compose --profile gpu up --build
```

There's a full command reference in [COMMANDS.md](COMMANDS.md).

## API keys

| Key | Required? | What it's for |
|-----|-----------|----------------|
| `GEOAPIFY_KEY` | Yes | Turning your search into coordinates |
| `DATAGOVSG_KEY` | Yes | HDB carpark locations + live availability |
| `DATAMALL_API` | Yes | Commercial / URA carparks |
| `GOOGLE_MAPS_KEY` | Optional | Google map tiles and routing |
| `ZHIPUAI_API_KEY` | Optional | Cloud LLM for the rate scraper |

Without the optional keys the app still runs - you just lose the Google tile styles, and without an LLM the scraper falls back to the public datasets.

## Where the data comes from

| Source | Roughly | What it gives us |
|--------|---------|-------------------|
| data.gov.sg (mapping) | ~2,000 | HDB locations, addresses, carpark type |
| data.gov.sg (availability) | ~2,000 | Live lot counts by vehicle type |
| LTA DataMall | ~500 | Malls and private developments |
| Parkaholic | ~4,700 | Locations, availability, rate text |
| SGCarMart | ~1,100 | Weekday/Saturday/Sunday rates |
| OneMotoring, GetGo, SgBikes | varies | Official + CBD + motorcycle rates (AI-scraped) |

## What's done and what isn't

This is our Milestone 1 build, so a few things are intentionally still rough: the login screen is UI-only for now (no real accounts yet), favorites live in your browser session rather than on a server, and a proper cost calculator is on the roadmap for the next milestone. The core - search, the map, live availability, multi-source pricing - all works end to end.

## Team

NUS Orbital 2026
