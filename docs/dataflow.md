# GoPark — Data Flow

How parking data moves from external sources into the app. Renders natively on GitHub.

```mermaid
flowchart TD
    subgraph sources["External Sources"]
        gov["data.gov.sg<br/>HDB carparks + availability"]
        dm["LTA DataMall<br/>LTA / URA carparks"]
        pk["Parkaholic<br/>locations + rates"]
        sgc["SGCarMart<br/>carpark details"]
        web["Web pages<br/>onemotoring, getgo, ..."]
    end

    subgraph providers["Providers (src/cron/providers)"]
        govP["govsg.ts<br/>fetchMapping / fetchAvailability"]
        dmP["datamall.ts<br/>fetchDatamall"]
        pkP["parkaholic.ts<br/>fetchLocations / fetchDump / fetchRates"]
        sgcP["sgcarmart.ts<br/>fetchSgcarmart"]
    end

    subgraph scraper["Scraper (src/cron/scraper)"]
        search["search.ts<br/>searchWeb / fetchPage"]
        llm["llm.ts<br/>LLM extraction"]
        apply["apply.ts<br/>applyScraped<br/>geocode + active/scrapeMisses"]
    end

    subgraph pipeline["Pipeline (src/cron)"]
        merge["pipeline/merge.ts<br/>mergeAll<br/>dedupe by id/proximity/name"]
        rates["pipeline/rates.ts<br/>parse rate text"]
        upsert["index.ts<br/>upsert / bulkInsert"]
        seed["seed.ts<br/>seed.json cache"]
    end

    db[("PostgreSQL<br/>carparks · rates · availability<br/>scraped_pages · scraper_domains")]

    subgraph api["API (src/providers/carparks)"]
        list["GET /api/carparks<br/>active only"]
        nearby["GET /api/carparks/nearby<br/>haversine radius"]
        detail["GET /api/carparks/:id"]
        avail["GET /api/carparks/availability"]
    end

    frontend["React Frontend<br/>search · map · results"]

    gov --> govP
    dm --> dmP
    pk --> pkP
    sgc --> sgcP
    web --> search

    govP --> merge
    dmP --> merge
    pkP --> merge
    sgcP --> merge
    rates --> merge

    search --> llm
    llm --> apply
    apply --> db

    merge --> upsert
    upsert --> db
    upsert --> seed
    seed -. cold start .-> upsert

    db --> list
    db --> nearby
    db --> detail
    db --> avail

    list --> frontend
    nearby --> frontend
    detail --> frontend
    avail --> frontend

    timers["Cron timers (index.ts)<br/>availability: 1 min<br/>full merge: 6 hr<br/>scraper: 7 day"]
    timers -. triggers .-> providers
    timers -. triggers .-> scraper
```

## Regenerating diagrams

```bash
# from backend/ — regenerates erd.md (ER diagram) + schema.dbml, strips emoji markers
npm run diagrams
```

`erd.md` and `schema.dbml` are auto-generated from `schema.prisma`. This `dataflow.md` is hand-maintained — edit the Mermaid above when the pipeline changes.
