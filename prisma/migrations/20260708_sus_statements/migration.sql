-- Enunciados customizados do SUS por estudo (nulo = padrão do idioma).
ALTER TABLE "Study" ADD COLUMN IF NOT EXISTS "susStatements" JSONB;
