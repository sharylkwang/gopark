# Commands

## Docker Compose

### Start Services

```bash
# Start all services (no GPU)
docker compose up --build

# Start with local vLLM for AI scraping (requires NVIDIA GPU)
docker compose --profile gpu up --build

# Start in background
docker compose up -d --build

# Start specific service
docker compose up backend --build
```

### Stop Services

```bash
# Stop all
docker compose down

# Stop and remove volumes (resets database)
docker compose down -v

# Stop including vLLM
docker compose --profile gpu down
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f vllm

# Last 100 lines
docker compose logs --tail=100 backend
```

### Restart

```bash
# Restart a single service
docker compose restart backend
docker compose restart frontend

# Rebuild and restart
docker compose up --build backend
```

---

## Database (Prisma)

All commands run inside the backend container:

```bash
# Open a shell in the backend container
docker compose exec backend sh
```

### Migrations

```bash
# Create a new migration
npx prisma migrate dev --name <migration_name>

# Apply pending migrations (runs automatically on startup)
npx prisma migrate deploy

# Reset database (drops all data)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

### Prisma Studio (GUI)

```bash
npx prisma studio
# Opens at http://localhost:5555
```

### Generate Client

```bash
npx prisma generate
```

### Seed Database

```bash
# Mark database as seeded (enables cron jobs)
npx tsx -e "
  import prisma from './src/db/index.js';
  import { markSeeded } from './src/db/schema.js';
  await markSeeded();
  console.log('Seed status set');
  await prisma.\$disconnect();
"
```

---

## PostgreSQL

### Direct Access

```bash
# Connect from host (port 5433)
psql -h localhost -p 5433 -U postgres -d gopark

# Connect from within Docker network
docker compose exec gopark psql -U postgres -d gopark
```

### Common Queries

```sql
-- Carpark count by source
SELECT unnest(sources) AS source, COUNT(*) FROM carparks GROUP BY source ORDER BY count DESC;

-- Carparks with most rate entries
SELECT c.id, c.name, COUNT(r.id) AS rates FROM carparks c JOIN rates r ON r.carpark_id = c.id GROUP BY c.id ORDER BY rates DESC LIMIT 20;

-- Live availability summary
SELECT lot_type, COUNT(*), SUM(available) AS total_available FROM availability GROUP BY lot_type;

-- Scraped page cache status
SELECT domain, COUNT(*) AS pages, MAX(last_scraped) AS latest FROM scraped_pages GROUP BY domain;

-- Seed status
SELECT * FROM seed_status;
```

---

## Frontend

```bash
# Open shell
docker compose exec frontend sh

# Run linter
npm run lint

# Build for production
npm run build
```

---

## Backend

```bash
# Open shell
docker compose exec backend sh

# Run in dev mode (already default in docker-compose)
npm run dev

# Run in production mode
npm start
```

---

## vLLM (GPU Profile)

```bash
# Start vLLM separately
docker compose --profile gpu up vllm

# Check health
curl http://localhost:8100/health

# List loaded models
curl http://localhost:8100/v1/models

# Test completion
curl http://localhost:8100/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen3.5-4B",
    "messages": [{"role": "user", "content": "Hello"}],
    "max_tokens": 50
  }'
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATAGOVSG_KEY` | | data.gov.sg API key |
| `GEOAPIFY_KEY` | | Geoapify geocoding key |
| `GOOGLE_MAPS_KEY` | | Google Maps key (tiles + routing) |
| `DATAMALL_API` | | LTA DataMall API key |
| `DATABASE_URL` | `postgresql://postgres:password123@gopark:5432/gopark` | PostgreSQL connection |
| `ZHIPUAI_API_KEY` | | Z.AI GLM API key (cloud scraping) |
| `ZHIPUAI_MODEL` | `glm-4-flash` | Z.AI model name |
| `VLLM_URL` | `http://gopark-vllm:8000/v1` | vLLM endpoint |
| `VLLM_MODEL` | `Qwen/Qwen3.5-4B` | vLLM model name |
| `LOG_LEVEL` | `info` | Logger level: debug, info, warn, error |
| `HF_TOKEN` | | HuggingFace token (for gated models) |
| `PORT` | `3000` | Backend port |

---

## Scraper LLM Backend

The scraper checks in order:

1. `ZHIPUAI_API_KEY` set -> uses Z.AI GLM cloud API (no GPU needed)
2. `VLLM_URL` reachable -> uses local vLLM (start with `--profile gpu`)
3. Neither available -> scraper skipped, other cron jobs still run
