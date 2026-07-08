-- Código curto do link do testador (URL encurtada): /t/<testerCode>.
ALTER TABLE "Study" ADD COLUMN IF NOT EXISTS "testerCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Study_testerCode_key" ON "Study" ("testerCode");
