-- Guarda o nó de entrada (página/seção) usado na importação do Figma, para
-- permitir "Atualizar protótipo" re-sincronizando as telas a partir do mesmo escopo.
ALTER TABLE "Prototype" ADD COLUMN IF NOT EXISTS "figmaEntryNodeId" TEXT;
