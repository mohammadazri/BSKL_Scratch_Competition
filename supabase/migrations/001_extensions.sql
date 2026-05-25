-- 001_extensions.sql
-- Enable required Postgres extensions.
-- pgcrypto provides gen_random_uuid() used by every PK default.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
