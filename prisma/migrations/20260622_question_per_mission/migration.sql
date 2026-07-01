-- Perguntas podem pertencer a uma Mission (acompanhamento) além de Block (gerais)
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "missionId" TEXT;
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Question" ALTER COLUMN "blockId" DROP NOT NULL;

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Question_missionId_idx" ON "Question"("missionId");
