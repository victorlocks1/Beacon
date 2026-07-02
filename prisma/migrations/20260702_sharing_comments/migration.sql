-- Compartilhamento de estudo (membros) + comentários de revisão (pins)

ALTER TABLE "Study" ADD COLUMN IF NOT EXISTS "shareCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Study_shareCode_key" ON "Study"("shareCode");

CREATE TABLE "StudyMember" (
  "id"        TEXT NOT NULL,
  "studyId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudyMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StudyMember_studyId_userId_key" ON "StudyMember"("studyId", "userId");
ALTER TABLE "StudyMember"
  ADD CONSTRAINT "StudyMember_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyMember"
  ADD CONSTRAINT "StudyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Comment" (
  "id"        TEXT NOT NULL,
  "studyId"   TEXT NOT NULL,
  "screenId"  TEXT,
  "xNorm"     DOUBLE PRECISION,
  "yNorm"     DOUBLE PRECISION,
  "parentId"  TEXT,
  "authorId"  TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "resolved"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Comment_studyId_idx" ON "Comment"("studyId");
CREATE INDEX "Comment_screenId_idx" ON "Comment"("screenId");
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment"
  ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
