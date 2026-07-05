-- FKs que referenciam Screen/Hotspot não tinham regra ON DELETE. O padrão do
-- Postgres (NO ACTION) bloqueava a exclusão em cascata de uma tela/hotspot que
-- fosse referenciado por outra linha — quebrando "excluir projeto/estudo" com
-- P2003 (ex.: Hotspot_targetScreenId_fkey). Aqui recriamos cada FK com a regra
-- correta: CASCADE nos obrigatórios (a linha dependente some junto) e SET NULL
-- nos opcionais (apenas perde a referência).

-- Hotspot → tela alvo (opcional)
ALTER TABLE "Hotspot" DROP CONSTRAINT IF EXISTS "Hotspot_targetScreenId_fkey";
ALTER TABLE "Hotspot"
  ADD CONSTRAINT "Hotspot_targetScreenId_fkey"
  FOREIGN KEY ("targetScreenId") REFERENCES "Screen"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Mission → tela inicial (obrigatório)
ALTER TABLE "Mission" DROP CONSTRAINT IF EXISTS "Mission_startScreenId_fkey";
ALTER TABLE "Mission"
  ADD CONSTRAINT "Mission_startScreenId_fkey"
  FOREIGN KEY ("startScreenId") REFERENCES "Screen"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- MissionGoal → tela objetivo (obrigatório)
ALTER TABLE "MissionGoal" DROP CONSTRAINT IF EXISTS "MissionGoal_goalScreenId_fkey";
ALTER TABLE "MissionGoal"
  ADD CONSTRAINT "MissionGoal_goalScreenId_fkey"
  FOREIGN KEY ("goalScreenId") REFERENCES "Screen"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- PathStep → tela (obrigatório)
ALTER TABLE "PathStep" DROP CONSTRAINT IF EXISTS "PathStep_screenId_fkey";
ALTER TABLE "PathStep"
  ADD CONSTRAINT "PathStep_screenId_fkey"
  FOREIGN KEY ("screenId") REFERENCES "Screen"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Event → tela (obrigatório)
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_screenId_fkey";
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_screenId_fkey"
  FOREIGN KEY ("screenId") REFERENCES "Screen"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Event → hotspot (opcional)
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_hotspotId_fkey";
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_hotspotId_fkey"
  FOREIGN KEY ("hotspotId") REFERENCES "Hotspot"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Event → tela alvo (opcional)
ALTER TABLE "Event" DROP CONSTRAINT IF EXISTS "Event_targetScreenId_fkey";
ALTER TABLE "Event"
  ADD CONSTRAINT "Event_targetScreenId_fkey"
  FOREIGN KEY ("targetScreenId") REFERENCES "Screen"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
