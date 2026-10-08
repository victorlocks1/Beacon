-- Critério de sucesso "clique em hotspot": a missão conclui quando o testador
-- clica em qualquer um dos hotspots marcados (não depende de chegar numa tela).
ALTER TYPE "SuccessType" ADD VALUE IF NOT EXISTS 'hotspot';

CREATE TABLE IF NOT EXISTS "MissionGoalHotspot" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "hotspotId" TEXT NOT NULL,

    CONSTRAINT "MissionGoalHotspot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MissionGoalHotspot_missionId_hotspotId_key"
  ON "MissionGoalHotspot"("missionId", "hotspotId");

ALTER TABLE "MissionGoalHotspot" DROP CONSTRAINT IF EXISTS "MissionGoalHotspot_missionId_fkey";
ALTER TABLE "MissionGoalHotspot"
  ADD CONSTRAINT "MissionGoalHotspot_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "Mission"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionGoalHotspot" DROP CONSTRAINT IF EXISTS "MissionGoalHotspot_hotspotId_fkey";
ALTER TABLE "MissionGoalHotspot"
  ADD CONSTRAINT "MissionGoalHotspot_hotspotId_fkey"
  FOREIGN KEY ("hotspotId") REFERENCES "Hotspot"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- mesma regra das demais tabelas: API pública do Supabase não enxerga nada
ALTER TABLE "MissionGoalHotspot" ENABLE ROW LEVEL SECURITY;
