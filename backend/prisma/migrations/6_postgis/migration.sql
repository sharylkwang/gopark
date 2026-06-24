CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE carparks ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

UPDATE carparks SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326) WHERE lat != 0 AND lng != 0;

CREATE INDEX IF NOT EXISTS carparks_geom_idx ON carparks USING GIST (geom);
