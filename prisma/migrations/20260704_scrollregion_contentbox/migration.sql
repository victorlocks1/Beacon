-- Caixa do conteúdo rolável (a "tira") para alinhar a tira na mesma escala da
-- base ao renderizar o scroll — corrige a duplicação/fantasma.
ALTER TABLE "ScrollRegion" ADD COLUMN IF NOT EXISTS "contentBox" JSONB;
