-- Fundação do protótipo vivo (embed do Figma):
-- node-ids para o embed + mapear eventos → tela, e log cru dos eventos da Embed API.

ALTER TABLE "Prototype" ADD COLUMN IF NOT EXISTS "figmaStartNodeId" TEXT;
ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "figmaNodeId" TEXT;

CREATE TABLE IF NOT EXISTS "FigmaEventLog" (
  "id"         TEXT NOT NULL,
  "sessionId"  TEXT NOT NULL,
  "type"       TEXT NOT NULL,
  "data"       JSONB NOT NULL,
  "clientTsMs" BIGINT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FigmaEventLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FigmaEventLog_sessionId_idx" ON "FigmaEventLog"("sessionId");

ALTER TABLE "FigmaEventLog"
  ADD CONSTRAINT "FigmaEventLog_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
