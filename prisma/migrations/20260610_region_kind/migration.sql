CREATE TYPE "RegionKind" AS ENUM ('scroll', 'fixed');
ALTER TABLE "ScrollRegion" ADD COLUMN "kind" "RegionKind" NOT NULL DEFAULT 'scroll';
ALTER TABLE "ScrollRegion" ALTER COLUMN "imageUrl" DROP NOT NULL;
