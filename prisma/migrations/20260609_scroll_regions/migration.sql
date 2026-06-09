CREATE TYPE "ScrollAxis" AS ENUM ('horizontal', 'vertical', 'both');

CREATE TABLE "ScrollRegion" (
  "id" TEXT NOT NULL,
  "screenId" TEXT NOT NULL,
  "coords" JSONB NOT NULL,
  "axis" "ScrollAxis" NOT NULL DEFAULT 'horizontal',
  "imageUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScrollRegion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ScrollRegion"
  ADD CONSTRAINT "ScrollRegion_screenId_fkey"
  FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;
