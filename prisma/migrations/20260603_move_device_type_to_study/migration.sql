-- AlterTable Study: add deviceType
ALTER TABLE "Study" ADD COLUMN "deviceType" "DeviceType" NOT NULL DEFAULT 'desktop';

-- AlterTable Prototype: remove deviceType
ALTER TABLE "Prototype" DROP COLUMN "deviceType";
