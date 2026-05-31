ALTER TABLE "carparks" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "carparks" ADD COLUMN "scrape_misses" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "carparks_active_idx" ON "carparks"("active");
