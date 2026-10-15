import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const moduleUrls = new Map();
async function loadModule(path, dependencies = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  let compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  for (const [specifier, dependency] of Object.entries(dependencies)) compiled = compiled.replace(`from "${specifier}"`, `from "${moduleUrls.get(dependency)}"`);
  const url = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  moduleUrls.set(path, url);
  return import(url);
}
const { getLocationMarkerPosition, CURRENT_LOCATION, ORIGINAL_LOCATION_TIP } = await loadModule("../src/components/market/locationMarker.ts");
const { MAP_SIZE, getMapOverviewCamera, constrainCoveredMapCenter, getNumberedMarkerLayouts, getResultMapMarkerLayouts } = await loadModule("../src/components/market/mapOverview.ts", { "./locationMarker": "../src/components/market/locationMarker.ts" });
const { getSearchResultPresentation, getSearchResultPage } = await loadModule("../src/features/kiosk/searchResultPresentation.ts");
const { figmaMapShops } = await loadModule("../src/data/figma-map-shops.ts");
// Load the real map geometry without starting React or loading browser-only imports.
const mapSource = readFileSync(new URL("../src/components/market/MapView.tsx", import.meta.url), "utf8");
const parsedMap = ts.createSourceFile("MapView.tsx", mapSource, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TSX);
const geometrySource = ts.createPrinter().printFile(ts.factory.updateSourceFile(parsedMap, parsedMap.statements.filter(statement => !ts.isImportDeclaration(statement))));
const geometryJs = ts.transpileModule(geometrySource, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText;
const geometryModule = `import { reflectPointAcrossCenter } from "${moduleUrls.get("../src/components/market/locationMarker.ts")}";\n${geometryJs}\nexport { getShopLabelBubble };`;
const { getShopNumberMarkers, getShopMapMarker, getShopLabelBubble } = await import(`data:text/javascript;base64,${Buffer.from(geometryModule).toString("base64")}`);
for (const shop of figmaMapShops) {
  const center = getShopMapMarker(shop);
  const bubble = getShopLabelBubble(shop, center);
  const [originalNumberTip, numberTip] = getShopNumberMarkers(shop);
  assert.deepEqual(originalNumberTip, bubble.tailTip, "original point is retained alongside its reflected point");
  const drawnTip = bubble.tailPath.match(/L ([^ ]+) ([^ ]+)/).slice(1).map(Number);
  assert.deepEqual(drawnTip, [bubble.tailTip.x, bubble.tailTip.y], "reference point is the actual name-bubble triangle vertex");
  assert.ok(Math.abs((numberTip.x + bubble.tailTip.x) / 2 - center.x) < 1e-8, `${shop.name}: horizontal midpoint is the shop centre`);
  assert.ok(Math.abs((numberTip.y + bubble.tailTip.y) / 2 - center.y) < 1e-8, `${shop.name}: vertical midpoint is the shop centre`);
}
const top = 208;
const bottom = 1128;
const viewport = { width: 1080, height: 1920 };
const project = (point, camera, size) => ({ x: size.width / 2 + (point.x - camera.center.x) * camera.scale, y: size.height / 2 + (point.y - camera.center.y) * camera.scale });
for (const size of [viewport, { width: 800, height: 1700 }, { width: 1440, height: 2160 }]) {
  const camera = getMapOverviewCamera(size, top, bottom);
  for (const zoom of [1, 1.2, 4]) for (const x of [-10000, camera.center.x, 20000]) for (const y of [-10000, camera.center.y, 20000]) {
    const scale = camera.scale * zoom;
    const center = constrainCoveredMapCenter({ x, y }, scale, size, top, bottom);
    const start = project({ x: 0, y: 0 }, { scale, center }, size);
    const end = project({ x: MAP_SIZE.width, y: MAP_SIZE.height }, { scale, center }, size);
    assert.ok(start.x <= 1e-8 && end.x >= size.width - 1e-8, "panning never exposes horizontal gutters");
    assert.ok(start.y <= top + 1e-8 && end.y >= size.height - bottom - 1e-8, "panning never exposes vertical gutters");
  }
  const location = getLocationMarkerPosition(CURRENT_LOCATION, camera.center, camera.scale, size, { width: 104, height: 47 }, bottom, top, 0.6);
  assert.equal(location.offscreen, false);
  assert.deepEqual(location.arrowTip, project(CURRENT_LOCATION, camera, size));
  // Zooming keeps the centre of the unobscured area on the same map point.
  const nextScale = camera.scale * 1.2;
  const next = { scale: nextScale, center: { ...camera.center, y: camera.center.y + (bottom - top) / 2 * (1 / nextScale - 1 / camera.scale) } };
  const visibleCentre = project({ x: MAP_SIZE.width / 2, y: MAP_SIZE.height / 2 }, next, size);
  assert.ok(Math.abs(visibleCentre.y - (top + size.height - bottom) / 2) < 1e-8);
}
const shops = Array.from({ length: 14 }, (_, index) => ({ id: String(index), name: `Shop ${index}`, distance: Math.floor(index / 2) * 10 }));
const relevance = getSearchResultPresentation(shops, "relevance", shop => shop.distance);
assert.deepEqual(getSearchResultPage(relevance, 1).visible.map(result => result.number), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(getSearchResultPage(relevance, 2).visible.map(result => result.number), [7, 8, 9, 10, 11, 12]);
assert.deepEqual(getSearchResultPage(relevance, 99).visible.map(result => result.number), [13, 14]);
const sorted = getSearchResultPresentation([...shops].reverse(), "distance", shop => shop.distance);
assert.deepEqual(sorted.slice(0, 4).map(result => result.shop.id), ["1", "0", "3", "2"], "equal distances preserve relevance order");
assert.deepEqual(sorted.map(result => result.number), Array.from({ length: 14 }, (_, index) => index + 1));
assert.equal(getSearchResultPage([], 1).pageCount, 1);
const pageLocalNumbers = getSearchResultPresentation(figmaMapShops.slice(0, 12), "relevance", () => 10).map((result, index) => ({ ...result, number: index % 6 + 1 }));
assert.deepEqual(getSearchResultPage(pageLocalNumbers, 2).visible.map(result => result.number), [7, 8, 9, 10, 11, 12], "page two derives global numbers from its offset even if incoming numbers restarted");
const reserved = [{ x: 952, y: 600, width: 128, height: 192 }];
const horizontalSide = side => side === "left" || side === "right";
// A previously vertical arrow must return to a side when space opens up.
for (const width of [62, 104.497]) {
  const current = { id: "current-location", width, height: 46.956, tail: 12.658, targets: [{ x: 400, y: 450 }] };
  const layout = controls => getResultMapMarkerLayouts([], viewport, top, bottom, controls, undefined, current, {
    "current-location": { side: "top", candidateIndex: 0 },
  }).location;
  const rightBlocked = { x: 420, y: 425, width: 110, height: 50 };
  const leftBlocked = { x: 270, y: 425, width: 110, height: 50 };
  assert.ok(horizontalSide(layout([]).side), "horizontal placement takes priority over a previous vertical side");
  assert.equal(layout([rightBlocked]).side, "right", "use the other horizontal side before a vertical arrow");
  assert.ok(!horizontalSide(layout([rightBlocked, leftBlocked]).side), "vertical arrows remain available when both sides are blocked");
}
const sideBySide = getNumberedMarkerLayouts([
  { id: "first", number: 3, x: 400, y: 500 },
  { id: "second", number: 4, x: 460, y: 520 },
], viewport, top, bottom);
assert.ok(sideBySide.every(marker => !marker.tracking && horizontalSide(marker.side)), "choose a joint layout with horizontal arrows when both shops can fit");
const cardinalAngles = new Set([-90, 0, 90, 180]);
const overlapArea = (a, b) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function checkLayouts(layouts, overlay = bottom, controls = reserved) {
  for (const [index, marker] of layouts.entries()) {
    assert.ok(cardinalAngles.has(marker.angle), "all current-location and number arrows are cardinal");
    assert.ok(marker.x >= 0 && marker.x + marker.width <= viewport.width);
    assert.ok(marker.y >= top && marker.y + marker.height <= viewport.height - overlay);
    const horizontal = marker.side === "left" || marker.side === "right";
    const center = { x: marker.x + marker.width / 2, y: marker.y + marker.height / 2 };
    const tail = marker.id === "current-location" ? 12.658 : 12;
    close(horizontal ? marker.arrowTip.y : marker.arrowTip.x, horizontal ? center.y : center.x);
    close(horizontal ? Math.abs(marker.arrowTip.x - center.x) : Math.abs(marker.arrowTip.y - center.y), (horizontal ? marker.width : marker.height) / 2 + tail);
    if (!marker.tracking) assert.deepEqual(marker.arrowTip, marker.projected, "exact tips stay on their shop-side point");
    for (const control of controls) assert.equal(overlapArea(marker, control), 0, "controls stay usable");
    for (const other of layouts.slice(index + 1)) {
      const overlap = overlapArea(marker, other);
      if (!marker.tracking || !other.tracking) assert.equal(overlap, 0, "exact labels never overlap any marker");
      else assert.ok(overlap / Math.min(marker.width * marker.height, other.width * other.height) <= 0.15 + 1e-8, "trackers retain readable numbers with only a small overlap");
    }
  }
}
const cluster = Array.from({ length: 6 }, (_, index) => ({ id: String(index), number: index + 1, x: 730, y: 600 + index * 2 }));
const pairedCluster = cluster.map(marker => ({ ...marker, candidates: [{ x: marker.x - 8, y: marker.y }, { x: marker.x + 8, y: marker.y }] }));
for (const markers of [cluster, pairedCluster]) {
  const layouts = getNumberedMarkerLayouts(markers, viewport, top, bottom, reserved);
  assert.equal(layouts.length, 6, "no number is lost when shops are crowded");
  assert.ok(layouts.some(marker => !marker.tracking), "available exact positions are used");
  checkLayouts(layouts);
  for (const tag of layouts.filter(marker => !marker.tracking)) {
    const shop = markers.find(marker => marker.id === tag.id);
    assert.ok((shop.candidates ?? [shop]).some(target => target.x === tag.tip.x && target.y === tag.tip.y));
  }
}
const edgeTargets = cluster.map(marker => ({ ...marker, y: 1000 }));
const edgeCluster = getNumberedMarkerLayouts(edgeTargets, viewport, top, bottom, reserved);
assert.ok(edgeCluster.every(marker => marker.offscreen && marker.tracking));
checkLayouts(edgeCluster);
assert.ok(edgeCluster.some((a, index) => edgeCluster.slice(index + 1).some(b => overlapArea(a, b) > 0)), "edge trackers can share space rather than spread across the map");
assert.ok(Math.max(...edgeCluster.map(marker => marker.y)) - Math.min(...edgeCluster.map(marker => marker.y)) < 1, "bottom trackers slide along the edge");
const seenSides = new Set();
for (const x of [-500, 20, 540, 1060, 1500]) for (const y of [0, 220, 500, 780, 1400]) {
  const tags = getNumberedMarkerLayouts([{ id: "tracked", number: 1, x, y }], viewport, top, bottom, reserved);
  checkLayouts(tags);
  seenSides.add(tags[0].side);
}
assert.equal(seenSides.size, 4);
assert.equal(getNumberedMarkerLayouts(cluster, viewport, top, bottom, [], "2").some(marker => marker.id === "2"), false);
assert.equal(getNumberedMarkerLayouts(cluster, viewport, top, bottom, [], "2").length, 5);

// Use the same joint placement as MapView, including the current-location label.
function layoutCamera(shops, camera, overlay, previous = {}) {
  const markers = shops.map((shop, index) => {
    const candidates = getShopNumberMarkers(shop).map(point => project(point, camera, viewport));
    return { id: shop.id, number: index + 1, ...candidates[0], candidates };
  });
  const current = { id: "current-location", width: 104.497, height: 46.956, tail: 12.658, targets: [ORIGINAL_LOCATION_TIP, CURRENT_LOCATION].map(point => project(point, camera, viewport)) };
  const controls = [{ x: 952, y: viewport.height - overlay - 192, width: 128, height: 192 }];
  const result = getResultMapMarkerLayouts(markers, viewport, top, overlay, controls, undefined, current, previous);
  checkLayouts(Object.values(result.positions), overlay, controls);
  assert.equal(result.numbered.length, shops.length);
  assert.equal(new Set(result.numbered.map(marker => marker.key)).size, shops.length);
  for (const [index, rect] of result.numbered.entries()) {
    const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const distance = point => Math.hypot(point.x - center.x, point.y - center.y);
    assert.ok(distance(rect.anchor) <= Math.min(...markers[index].candidates.map(distance)) + 1e-8, "the nearer of the two real shop-side points is retained");
  }
  return result;
}
for (const overlay of [bottom, bottom + 144]) {
  const camera = getMapOverviewCamera(viewport, 0, overlay);
  for (let start = 0; start < figmaMapShops.length; start++) layoutCamera(figmaMapShops.slice(start, start + 6), camera, overlay);
}
const restaurants = figmaMapShops.filter(shop => shop.category === "식당").slice(0, 6);
assert.equal(restaurants.length, 6);
for (const zoom of [1, 1.2, 2, 4]) for (const offset of [{ x: 0, y: 0 }, { x: -2000, y: -3000 }, { x: 1500, y: 2000 }]) {
  const overview = getMapOverviewCamera(viewport, 0, bottom);
  const camera = { scale: overview.scale * zoom, center: constrainCoveredMapCenter({ x: overview.center.x + offset.x, y: overview.center.y + offset.y }, overview.scale * zoom, viewport, 0, bottom) };
  layoutCamera(restaurants, camera, bottom);
}
// Previous placements should stay on their side under a small unobstructed pan.
let previous = {};
for (let offset = 0; offset < 20; offset++) {
  const target = [{ id: "stable", number: 7, x: 400 + offset, y: 450 }];
  const result = getResultMapMarkerLayouts(target, viewport, top, bottom, [], undefined, undefined, previous);
  if (previous.stable) {
    assert.equal(result.positions.stable.side, previous.stable.side);
    close(result.positions.stable.x - previous.stable.x, 1);
  }
  previous = result.positions;
}
// Continuous pan across all real shops exercises exact/tracking transitions.
const overview = getMapOverviewCamera(viewport, 0, bottom);
previous = {};
const started = performance.now();
for (let frame = 0; frame <= 120; frame++) {
  const scale = overview.scale * 2;
  const camera = { scale, center: constrainCoveredMapCenter({ x: 4900, y: 2000 + frame * 60 }, scale, viewport, 0, bottom) };
  previous = layoutCamera(restaurants, camera, bottom, previous).positions;
}
console.log(`Result map passed: compact cardinal arrows, exact-label priority, limited tracking overlap, real-shop pan/zoom, selection and pagination; 121 pan frames in ${Math.round(performance.now() - started)}ms.`);
