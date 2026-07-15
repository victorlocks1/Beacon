-- Passo de caminho exato: opcional + "qualquer tela do grupo" (mesmo nome).
-- Torna o sucesso por CAMINHO robusto sem enumerar cada variação de rota.
ALTER TABLE "PathStep" ADD COLUMN IF NOT EXISTS "optional" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PathStep" ADD COLUMN IF NOT EXISTS "matchByName" BOOLEAN NOT NULL DEFAULT false;
