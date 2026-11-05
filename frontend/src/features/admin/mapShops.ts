import { figmaMapShops as kioskMapShops } from "../../data/figma-map-shops";

// Admin and kiosk consume the same canonical list; these aliases only support
// the existing admin presentation without creating a second coordinate source.
export const figmaMapShops = kioskMapShops.map((shop) => ({
  ...shop,
  meta: shop.number,
  markerX: shop.guideX ?? shop.x + shop.width / 2,
  markerY: shop.guideY ?? shop.y + shop.height / 2,
}));
