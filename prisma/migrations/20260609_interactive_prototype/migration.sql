-- Enums
CREATE TYPE "ScrollMode" AS ENUM ('none', 'vertical', 'horizontal', 'both');
CREATE TYPE "HotspotAction" AS ENUM ('navigate', 'open_overlay', 'close_overlay', 'back');
CREATE TYPE "OverlayPosition" AS ENUM ('bottom', 'center');

-- Screen.scroll
ALTER TABLE "Screen" ADD COLUMN "scroll" "ScrollMode" NOT NULL DEFAULT 'none';

-- Hotspot: ação, posição de overlay e destino opcional
ALTER TABLE "Hotspot" ADD COLUMN "action" "HotspotAction" NOT NULL DEFAULT 'navigate';
ALTER TABLE "Hotspot" ADD COLUMN "overlayPosition" "OverlayPosition";
ALTER TABLE "Hotspot" ALTER COLUMN "targetScreenId" DROP NOT NULL;
