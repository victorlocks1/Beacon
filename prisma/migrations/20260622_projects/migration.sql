-- Camada de Projetos: User → Project → Study

-- 1) Tabela Project
CREATE TABLE IF NOT EXISTS "Project" (
  "id"        TEXT NOT NULL,
  "ownerId"   TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "archived"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Project_ownerId_idx" ON "Project"("ownerId");

ALTER TABLE "Project"
  ADD CONSTRAINT "Project_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Study.projectId (nullable primeiro, para backfill)
ALTER TABLE "Study" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- 3) Backfill: um projeto padrão por usuário que já tem estudos
INSERT INTO "Project" ("id", "ownerId", "name", "archived", "createdAt")
SELECT gen_random_uuid()::text, u."id", 'Meu projeto', false, CURRENT_TIMESTAMP
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Study" s WHERE s."ownerId" = u."id")
  AND NOT EXISTS (SELECT 1 FROM "Project" p WHERE p."ownerId" = u."id");

UPDATE "Study" s
SET "projectId" = p."id"
FROM "Project" p
WHERE p."ownerId" = s."ownerId" AND s."projectId" IS NULL;

-- 4) Torna NOT NULL + FK + índice
ALTER TABLE "Study" ALTER COLUMN "projectId" SET NOT NULL;

ALTER TABLE "Study"
  ADD CONSTRAINT "Study_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Study_projectId_idx" ON "Study"("projectId");
