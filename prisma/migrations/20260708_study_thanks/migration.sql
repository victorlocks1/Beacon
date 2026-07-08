-- Tela de agradecimento customizável (nulo = usa o padrão do idioma).
ALTER TABLE "Study" ADD COLUMN IF NOT EXISTS "thanksTitle" TEXT;
ALTER TABLE "Study" ADD COLUMN IF NOT EXISTS "thanksMessage" TEXT;
