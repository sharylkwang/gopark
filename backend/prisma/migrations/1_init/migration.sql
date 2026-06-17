-- CreateTable
CREATE TABLE "carparks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "agency" TEXT NOT NULL DEFAULT '',
    "sources" TEXT[],
    "lot_types" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carparks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rates" (
    "id" SERIAL NOT NULL,
    "carpark_id" TEXT NOT NULL,
    "amount" DECIMAL(8,2) NOT NULL,
    "duration_mins" INTEGER,
    "unit" TEXT NOT NULL DEFAULT 'flat',
    "vehicle_type" TEXT NOT NULL DEFAULT 'C',
    "period_start" TEXT,
    "period_end" TEXT,
    "is_first" BOOLEAN NOT NULL DEFAULT false,
    "day_type" TEXT NOT NULL DEFAULT 'all',
    "sources" TEXT[],

    CONSTRAINT "rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availability" (
    "carpark_id" TEXT NOT NULL,
    "lot_type" TEXT NOT NULL DEFAULT 'C',
    "available" INTEGER,
    "total" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_pkey" PRIMARY KEY ("carpark_id","lot_type")
);

-- CreateTable
CREATE TABLE "seed_status" (
    "key" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "seed_status_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "scraped_pages" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "data_hash" TEXT NOT NULL DEFAULT '',
    "carparks" INTEGER NOT NULL DEFAULT 0,
    "last_scraped" TIMESTAMP(3) NOT NULL,
    "last_changed" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraped_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scraper_domains" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "search_query" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_searched" TIMESTAMP(3),

    CONSTRAINT "scraper_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rates_carpark_id_amount_duration_mins_vehicle_type_day_type_key" ON "rates"("carpark_id", "amount", "duration_mins", "vehicle_type", "day_type", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "scraped_pages_url_key" ON "scraped_pages"("url");

-- CreateIndex
CREATE INDEX "scraped_pages_domain_idx" ON "scraped_pages"("domain");

-- CreateIndex
CREATE INDEX "scraped_pages_last_changed_idx" ON "scraped_pages"("last_changed");

-- CreateIndex
CREATE UNIQUE INDEX "scraper_domains_domain_key" ON "scraper_domains"("domain");

-- AddForeignKey
ALTER TABLE "rates" ADD CONSTRAINT "rates_carpark_id_fkey" FOREIGN KEY ("carpark_id") REFERENCES "carparks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availability" ADD CONSTRAINT "availability_carpark_id_fkey" FOREIGN KEY ("carpark_id") REFERENCES "carparks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
