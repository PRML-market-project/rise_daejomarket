// Figma search-tag glyphs. Shared with admin by scripts/sync-map-data.mjs.
export const searchTagIcons = [
  { label: "정육청과수산", asset: "wheat", color: "#116543", size: 24.0833 },
  { label: "식품", asset: "washoku", color: "#ff85ba", size: 28 },
  { label: "식료품잡화", asset: "cart", color: "#116543", size: 24.0833 },
  { label: "농산물 가공", asset: "grocery", color: "#116543", size: 24.0833 },
  { label: "식당", asset: "restaurant", color: "#ff9500", size: 25.185 },
  { label: "의류잡화", asset: "apparel", color: "#116543", size: 25.5 },
  { label: "서비스업", asset: "person", color: "#116543", size: 24.0833 },
  { label: "좌판", asset: "store", color: "#116543", size: 28.3333 },
  { label: "간식", asset: "snack", color: "#0062ff", size: 30 },
];

export function getSearchTagIcon(label: string) {
  return searchTagIcons.find((icon) => icon.label === label) ?? searchTagIcons[4];
}
