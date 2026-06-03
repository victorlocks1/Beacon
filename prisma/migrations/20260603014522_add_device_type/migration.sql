-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('desktop', 'tablet', 'mobile');

-- AlterTable
ALTER TABLE "Prototype" ADD COLUMN     "deviceType" "DeviceType" NOT NULL DEFAULT 'desktop';
