-- SUS agora é um bloco posicionável na sequência (não mais um toggle no fim).
-- (susEnabled e SusResponse já foram criados na migração anterior; susEnabled
--  fica sem uso — pode ser removido depois com segurança.)
ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'sus';
