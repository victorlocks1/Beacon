-- SUM passa de 1 pergunta (SEQ) para 3 (ASQ: tempo, informação, facilidade).
ALTER TABLE "SumResponse" DROP COLUMN IF EXISTS "ease";
ALTER TABLE "SumResponse" ADD COLUMN IF NOT EXISTS "values" INTEGER[] NOT NULL DEFAULT '{}';

ALTER TABLE "Study" DROP COLUMN IF EXISTS "sumStatement";
ALTER TABLE "Study" ADD COLUMN IF NOT EXISTS "sumStatements" JSONB;
