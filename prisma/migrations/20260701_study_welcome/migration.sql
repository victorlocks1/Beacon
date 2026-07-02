-- Boas-vindas customizáveis do testador (nulo = usa o padrão do idioma)
ALTER TABLE "Study" ADD COLUMN IF NOT EXISTS "welcomeTitle" TEXT;
ALTER TABLE "Study" ADD COLUMN IF NOT EXISTS "welcomeMessage" TEXT;
