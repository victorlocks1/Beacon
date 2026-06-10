CREATE TYPE "Language" AS ENUM ('pt', 'es');
ALTER TABLE "Study" ADD COLUMN "language" "Language" NOT NULL DEFAULT 'pt';
