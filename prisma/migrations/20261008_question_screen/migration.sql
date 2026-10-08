-- Pergunta sobre uma tela específica: a tela escolhida é exibida ao testador
-- junto com a pergunta. Opcional (NULL = pergunta sem tela, como antes).
ALTER TABLE "Question" ADD COLUMN IF NOT EXISTS "screenId" TEXT;

ALTER TABLE "Question" DROP CONSTRAINT IF EXISTS "Question_screenId_fkey";
ALTER TABLE "Question"
  ADD CONSTRAINT "Question_screenId_fkey"
  FOREIGN KEY ("screenId") REFERENCES "Screen"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
