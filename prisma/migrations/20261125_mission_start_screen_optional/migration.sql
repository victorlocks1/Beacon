-- Excluir a tela inicial de uma tarefa NÃO exclui mais a tarefa: a tela inicial
-- passa a ser opcional e a referência vira NULL (antes: ON DELETE CASCADE, que
-- apagava a missão inteira, com resultados). Não altera nenhum dado existente.
ALTER TABLE "Mission" ALTER COLUMN "startScreenId" DROP NOT NULL;

ALTER TABLE "Mission" DROP CONSTRAINT IF EXISTS "Mission_startScreenId_fkey";
ALTER TABLE "Mission"
  ADD CONSTRAINT "Mission_startScreenId_fkey"
  FOREIGN KEY ("startScreenId") REFERENCES "Screen"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
