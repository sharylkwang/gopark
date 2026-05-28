ALTER TABLE "carparks" RENAME COLUMN "last_updated" TO "details_updated_at";
ALTER TABLE "carparks" ADD COLUMN "availability_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "carparks" SET "availability_updated_at" = "details_updated_at";
