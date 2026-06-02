-- CreateEnum
CREATE TYPE "StudyStatus" AS ENUM ('draft', 'live', 'closed');

-- CreateEnum
CREATE TYPE "PrototypeSource" AS ENUM ('image', 'figma');

-- CreateEnum
CREATE TYPE "HotspotShape" AS ENUM ('rect', 'polygon');

-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('mission', 'question');

-- CreateEnum
CREATE TYPE "SuccessType" AS ENUM ('screen', 'path');

-- CreateEnum
CREATE TYPE "MissionOutcome" AS ENUM ('direct', 'indirect', 'unfinished', 'given_up');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('click', 'navigate', 'misclick', 'give_up', 'end');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Study" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "StudyStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Study_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prototype" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "source" "PrototypeSource" NOT NULL,
    "figmaFileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prototype_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Screen" (
    "id" TEXT NOT NULL,
    "prototypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotspot" (
    "id" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "shape" "HotspotShape" NOT NULL,
    "coords" JSONB NOT NULL,
    "targetScreenId" TEXT NOT NULL,

    CONSTRAINT "Hotspot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "type" "BlockType" NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "description" TEXT,
    "startScreenId" TEXT NOT NULL,
    "successType" "SuccessType" NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionGoal" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "goalScreenId" TEXT NOT NULL,

    CONSTRAINT "MissionGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionPath" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "MissionPath_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathStep" (
    "id" TEXT NOT NULL,
    "missionPathId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "PathStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "studyId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "deviceType" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "outcome" "MissionOutcome" NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "misclickCount" INTEGER NOT NULL,
    "clickCount" INTEGER NOT NULL,

    CONSTRAINT "MissionResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "screenId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "xNorm" DOUBLE PRECISION NOT NULL,
    "yNorm" DOUBLE PRECISION NOT NULL,
    "hotspotId" TEXT,
    "targetScreenId" TEXT,
    "timestampMs" BIGINT NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Prototype_studyId_key" ON "Prototype"("studyId");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_blockId_key" ON "Mission"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- AddForeignKey
ALTER TABLE "Study" ADD CONSTRAINT "Study_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prototype" ADD CONSTRAINT "Prototype_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Screen" ADD CONSTRAINT "Screen_prototypeId_fkey" FOREIGN KEY ("prototypeId") REFERENCES "Prototype"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotspot" ADD CONSTRAINT "Hotspot_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotspot" ADD CONSTRAINT "Hotspot_targetScreenId_fkey" FOREIGN KEY ("targetScreenId") REFERENCES "Screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_startScreenId_fkey" FOREIGN KEY ("startScreenId") REFERENCES "Screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionGoal" ADD CONSTRAINT "MissionGoal_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionGoal" ADD CONSTRAINT "MissionGoal_goalScreenId_fkey" FOREIGN KEY ("goalScreenId") REFERENCES "Screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionPath" ADD CONSTRAINT "MissionPath_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathStep" ADD CONSTRAINT "PathStep_missionPathId_fkey" FOREIGN KEY ("missionPathId") REFERENCES "MissionPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathStep" ADD CONSTRAINT "PathStep_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_studyId_fkey" FOREIGN KEY ("studyId") REFERENCES "Study"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionResult" ADD CONSTRAINT "MissionResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionResult" ADD CONSTRAINT "MissionResult_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_hotspotId_fkey" FOREIGN KEY ("hotspotId") REFERENCES "Hotspot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_targetScreenId_fkey" FOREIGN KEY ("targetScreenId") REFERENCES "Screen"("id") ON DELETE SET NULL ON UPDATE CASCADE;
