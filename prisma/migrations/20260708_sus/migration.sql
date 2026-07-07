-- Questionário SUS (System Usability Scale)
ALTER TABLE "Study" ADD COLUMN IF NOT EXISTS "susEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "SusResponse" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "values" INTEGER[] NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SusResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SusResponse_sessionId_key" ON "SusResponse"("sessionId");

ALTER TABLE "SusResponse"
  ADD CONSTRAINT "SusResponse_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
