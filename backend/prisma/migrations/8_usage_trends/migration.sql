CREATE TABLE "availability_snapshots" (
    "id" SERIAL NOT NULL,
    "carpark_id" TEXT NOT NULL,
    "occupancy_pct" INTEGER NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "availability_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "availability_snapshots_carpark_id_recorded_at_idx" ON "availability_snapshots"("carpark_id", "recorded_at");
CREATE INDEX "availability_snapshots_recorded_at_idx" ON "availability_snapshots"("recorded_at");

CREATE TABLE "carpark_trends" (
    "carpark_id" TEXT NOT NULL,
    "profile" JSONB NOT NULL,
    "today_profile" JSONB NOT NULL,
    "today_source" TEXT NOT NULL,
    "is_holiday" BOOLEAN NOT NULL DEFAULT false,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "carpark_trends_pkey" PRIMARY KEY ("carpark_id")
);
