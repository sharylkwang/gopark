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