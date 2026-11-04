// 261029_지도_FULL · FAR8pPnXUZCtc7GHNS5cbT / 1002:72311.
// Keep the unchanged core map and its interactive shop-label atlas at original
// coordinates. New Figma layers extend the canvas without stretching that core.
export const CORE_MAP_SIZE = { width: 6807, height: 10577 };
export const MAP_BACKGROUND_COLOR = "#e9e9e9";

// Previous frame 585:28515 at (4868,667), render bounds (4867.70,667,
// 182.08,78). Its replacement moved to (4865,653). Clear only the old
// baked-in artwork over the white road, including its one-pixel text halo.
export const replacedCoreLandmarks = [
  { nodeId: "585:28515", x: 4866, y: 666, width: 185, height: 80, fill: "#ffffff" },
];

export const mapUnderlayAssets = [
  { nodeId: "1002:72313", url: "/images/map-extended-estate.svg", x: 0, y: 10563.400390625, width: 1386.04, height: 1635.22 },
  { nodeId: "1002:72315", url: "/images/map-extended-roads.svg", x: 0, y: 2, width: 9833, height: 12971 },
  { nodeId: "1002:72323", url: "/images/map-extended-buildings.svg", x: 0, y: 0, width: 9833, height: 12973 },
];

export const SUBWAY_LINE = { nodeId: "1002:72602", x: 5154, y: -8, width: 287, height: 1429, fill: "#a85b48" };

export const mapOverlayAssets = [
  { nodeId: "1002:72994", url: "/images/map-additional-buildings.svg", x: 0, y: 0, width: 9833, height: 12973 },
  // Native outlined exports, positioned by their rendered bounds. No font
  // substitution, icon redraw, or resizing of their SVG root dimensions.
  { nodeId: "1002:73518", url: "/images/subway-exit-7.svg", x: 4864.7001953125, y: 653, width: 183, height: 78 },
  { nodeId: "1002:73522", url: "/images/subway-line-6-label.svg", x: 5178.61865234375, y: 676.796875, width: 234, height: 47 },
  { nodeId: "1002:73523", url: "/images/subway-exit-6.svg", x: 5570.7314453125, y: 667, width: 185, height: 78 },
];
