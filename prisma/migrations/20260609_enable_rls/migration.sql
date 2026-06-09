-- Bloqueia a API pública (PostgREST/anon) do Supabase ativando RLS em todas as
-- tabelas. O app acessa o banco via Prisma como o papel "postgres" (dono das
-- tabelas), que IGNORA o RLS — então nenhuma query do app é afetada.
-- Sem policies = a API pública (anon/authenticated) não enxerga nenhuma linha.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Study" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Prototype" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Screen" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Hotspot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScrollRegion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Block" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Mission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MissionGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MissionPath" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PathStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MissionResult" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
