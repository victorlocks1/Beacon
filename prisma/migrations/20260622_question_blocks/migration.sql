-- M6: Blocos de pergunta (Question) + respostas do testador (Answer)

CREATE TYPE "QuestionType" AS ENUM ('open', 'choice', 'rating', 'binary');

CREATE TABLE "Question" (
  "id"          TEXT NOT NULL,
  "blockId"     TEXT NOT NULL,
  "type"        "QuestionType" NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "required"    BOOLEAN NOT NULL DEFAULT true,
  "options"     JSONB,
  CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Question_blockId_key" ON "Question"("blockId");

ALTER TABLE "Question"
  ADD CONSTRAINT "Question_blockId_fkey"
  FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Answer" (
  "id"         TEXT NOT NULL,
  "sessionId"  TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "text"       TEXT,
  "choice"     TEXT,
  "rating"     INTEGER,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Answer_sessionId_questionId_key" ON "Answer"("sessionId", "questionId");

ALTER TABLE "Answer"
  ADD CONSTRAINT "Answer_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Answer"
  ADD CONSTRAINT "Answer_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
