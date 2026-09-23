import { figmaMapShops as kioskMapShops } from "./kioskMapShops.generated";

export type FigmaMapIconCell = { x: number; y: number; width: number; height: number };

export const leftMapIconCells: FigmaMapIconCell[] = [[1579,83],[2307,54],[2369,83],[2460,83],[2551,84],[2643,83],[2734,54],[2796,96],[2900,77],[2985,78],[3071,87],[3210,49],[3267,54],[3329,74],[3411,73],[3492,133],[3861,82],[3951,83],[4185,68],[4261,68],[4337,49],[4394,54],[4456,84],[4548,69],[4695,54],[4757,74],[4839,60],[5048,68],[5124,61],[5193,54],[5255,69],[5409,68],[5634,66],[5708,40],[5756,71],[5835,71],[5914,72],[5994,92],[6094,74],[6176,73],[6257,71],[6495,60],[6563,142],[6713,55],[6776,94],[6919,93],[7020,93],[7121,93],[7222,85],[7315,93],[7503,62],[7573,52],[7633,52],[7693,98],[7799,98],[8133,108],[8249,85],[8342,84],[8434,78],[8520,252],[8883,231],[9541,154]].map(([y, height]) => ({ x: 4827, y, width: 52, height }));
export const rightMapIconCells: FigmaMapIconCell[] = [[4255,76],[4341,76],[4425,76],[4655,76],[4739,76],[4823,76],[5064,76],[5148,76],[5232,76],[5691,76],[5775,76],[5859,76],[5943,76],[6027,76],[6111,76],[6195,76],[6718,76],[6802,76],[6886,76],[6970,76],[7054,76],[7138,76],[7222,76],[7306,76],[7573,76],[7657,76]].map(([y, height]) => ({ x: 4961, y, width: 52, height }));

// Admin and kiosk consume the same canonical list; these aliases only support
// the existing admin presentation without creating a second coordinate source.
export const figmaMapShops = kioskMapShops.map((shop) => ({
  ...shop,
  meta: shop.number,
  markerX: shop.guideX ?? shop.x + shop.width / 2,
  markerY: shop.guideY ?? shop.y + shop.height / 2,
}));
