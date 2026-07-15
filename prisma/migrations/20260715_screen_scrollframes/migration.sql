-- Geometria dos frames roláveis (embed vivo) p/ posicionar cliques de carrossel/scroll no heatmap.
ALTER TABLE "Screen" ADD COLUMN IF NOT EXISTS "scrollFrames" JSONB;
