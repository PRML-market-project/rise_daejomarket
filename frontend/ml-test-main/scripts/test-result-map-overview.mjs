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
const { getLocationMarkerPosition, getCandidateMarkerPosition, CURRENT_LOCATION, ORIGINAL_LOCATION_TIP } = await loadModule("../src/components/market/locationMarker.ts");
const { MAP_SIZE, getMapOverviewCamera, constrainCoveredMapCenter, getNumberedMarkerLayouts } = await loadModule("../src/components/market/mapOverview.ts", { "./locationMarker": "../src/components/market/locationMarker.ts" });
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
const cluster = Array.from({ length: 6 }, (_, index) => ({ id: String(index), number: index + 1, x: 730, y: 600 + index * 2 }));
const layouts = getNumberedMarkerLayouts(cluster, viewport, top, bottom, reserved);
// Adjacent shops force labels to move. Snapping must not move the arrow tip
// from a shop's side target onto its icon centre or another map coordinate.
const pairedCluster = cluster.map(marker => ({ ...marker, candidates: [{ x: marker.x - 8, y: marker.y }, { x: marker.x + 8, y: marker.y }] }));
for (const tag of getNumberedMarkerLayouts(pairedCluster, viewport, top, bottom, reserved)) {
  assert.deepEqual(tag.tip, tag.anchor, "a visible shop's arrow tip stays on the selected side target after collision handling");
  const shop = pairedCluster.find(marker => marker.id === tag.id);
  assert.notDeepEqual(tag.tip, { x: shop.x, y: shop.y }, "the tip never falls back to the shop's midpoint");
}
assert.equal(layouts.length, 6, "all six adjacent results have a readable number");
for (const [index, marker] of layouts.entries()) {
  assert.deepEqual(marker.anchor, { x: cluster[index].x, y: cluster[index].y });
  assert.ok(marker.y >= top && marker.y + marker.height <= viewport.height - bottom);
  for (const other of [...layouts.slice(index + 1), ...reserved]) {
    assert.ok(marker.x + marker.width <= other.x || other.x + other.width <= marker.x || marker.y + marker.height <= other.y || other.y + other.height <= marker.y, "numbers and controls never overlap");
  }
}
const tracked = getNumberedMarkerLayouts([{ id: "outside", number: 1, x: 100, y: 1000 }], viewport, top, bottom);
assert.equal(tracked.length, 1, "an offscreen shop retains an edge indicator");
assert.equal(tracked[0].offscreen, true);
assert.ok(tracked[0].y + tracked[0].height < viewport.height - bottom);
const edgeCluster = getNumberedMarkerLayouts(cluster.map(marker => ({ ...marker, y: 1000 })), viewport, top, bottom, reserved);
for (const tag of edgeCluster) for (const other of edgeCluster) if (tag.id !== other.id) {
  assert.ok(tag.tip.x <= other.x || tag.tip.x >= other.x + other.width || tag.tip.y <= other.y || tag.tip.y >= other.y + other.height, "edge-indicator tips are not hidden inside another number label");
}
const cardinalAngles = new Set([-180, -90, 0, 90, 180]);
const seenSides = new Set();
for (const x of [-500, 20, 540, 1060, 1500]) for (const y of [0, 220, 500, 780, 1400]) {
  const [tag] = getNumberedMarkerLayouts([{ id: "tracked", number: 1, x, y }], viewport, top, bottom, reserved);
  assert.ok(cardinalAngles.has(tag.angle), "numbers use only four directions, including corners and offscreen tracking");
  seenSides.add(tag.side);
  const center = { x: tag.x + tag.width / 2, y: tag.y + tag.height / 2 };
  if (!tag.offscreen) assert.deepEqual(tag.tip, tag.anchor, "visible tips remain on their map coordinates, even at corners");
  else if (tag.side === "left" || tag.side === "right") {
    assert.equal(tag.tip.y, center.y, "horizontal edge indicator attaches to the edge centre");
    assert.equal(Math.abs(tag.tip.x - center.x), tag.width / 2 + 12);
  } else {
    assert.equal(tag.tip.x, center.x, "vertical edge indicator attaches to the edge centre");
    assert.equal(Math.abs(tag.tip.y - center.y), tag.height / 2 + 12);
  }
}
assert.equal(seenSides.size, 4, "all four fixed directions are available");
assert.equal(getNumberedMarkerLayouts(cluster, viewport, top, bottom, [], "2").some(marker => marker.id === "2"), false, "selection hides only the selected shop number");
assert.equal(getNumberedMarkerLayouts(cluster, viewport, top, bottom, [], "2").length, 5);
for (const overlay of [bottom, bottom + 144]) {
  const camera = getMapOverviewCamera(viewport, top, overlay);
  const current = getCandidateMarkerPosition([ORIGINAL_LOCATION_TIP, CURRENT_LOCATION], camera.center, camera.scale, viewport, { width: 104.497, height: 46.956 }, overlay, top, 12.658 / 16);
  const exclusions = [{ x: current.x, y: current.y, width: 104.497, height: 46.956 }];
  for (let start = 0; start < figmaMapShops.length; start++) {
    const visibleShops = figmaMapShops.slice(start, start + 6);
    const markers = visibleShops.map((shop, index) => {
      const candidates = getShopNumberMarkers(shop).map(point => project(point, camera, viewport));
      return { id: shop.id, number: index + 1, ...candidates[0], candidates };
    });
    const dualLayouts = getNumberedMarkerLayouts(markers, viewport, top, overlay, exclusions);
    assert.equal(dualLayouts.length, visibleShops.length, `each shop retains one number with overlay ${overlay}, starting at ${start}`);
    assert.equal(new Set(dualLayouts.map(marker => marker.key)).size, dualLayouts.length, "each shop has one unique render key");
    for (let index = 0; index < dualLayouts.length; index++) {
      const rect = dualLayouts[index];
      assert.ok(cardinalAngles.has(rect.angle), "every real shop uses a fixed arrow direction");
      if (!rect.offscreen) assert.deepEqual(rect.tip, rect.anchor, "real shop arrow tips stay on a side target, never on the icon centre");
      const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
      const distances = markers[index].candidates.map(point => Math.hypot(point.x - center.x, point.y - center.y));
      const chosen = Math.hypot(rect.anchor.x - center.x, rect.anchor.y - center.y);
      assert.ok(chosen <= Math.min(...distances) + 1e-8, "the single pointer chooses the nearer candidate");
      for (const other of [...dualLayouts.slice(index + 1), ...exclusions]) assert.ok(rect.x + rect.width <= other.x || other.x + other.width <= rect.x || rect.y + rect.height <= other.y || other.y + other.height <= rect.y, "all numbers remain readable without overlapping labels");
    }
    assert.equal(getNumberedMarkerLayouts(markers, viewport, top, overlay, exclusions, visibleShops[0].id).length, visibleShops.length - 1, "selection hides only the selected shop number");
  }
}
const restaurants = figmaMapShops.filter(shop => shop.category === "식당").slice(0, 6);
for (const zoom of [1, 1.2, 2, 4]) for (const offset of [{ x: 0, y: 0 }, { x: -2000, y: -3000 }, { x: 1500, y: 2000 }]) {
  const overview = getMapOverviewCamera(viewport, 0, bottom);
  const camera = { scale: overview.scale * zoom, center: constrainCoveredMapCenter({ x: overview.center.x + offset.x, y: overview.center.y + offset.y }, overview.scale * zoom, viewport, 0, bottom) };
  const markers = restaurants.map((shop, index) => ({ id: shop.id, number: index + 1, ...project(getShopMapMarker(shop), camera, viewport), candidates: getShopNumberMarkers(shop).map(point => project(point, camera, viewport)) }));
  const tags = getNumberedMarkerLayouts(markers, viewport, top, bottom, reserved);
  assert.equal(tags.length, 6, "all numbers remain visible after zooming and panning");
  for (const [index, tag] of tags.entries()) {
    assert.ok(cardinalAngles.has(tag.angle));
    if (!tag.offscreen) {
      assert.deepEqual(tag.tip, tag.anchor);
      assert.notDeepEqual(tag.tip, { x: markers[index].x, y: markers[index].y }, "zoom never moves a visible tip onto the shop icon's centre");
    }
    for (const other of [...tags.slice(index + 1), ...reserved]) assert.ok(tag.x + tag.width <= other.x || other.x + other.width <= tag.x || tag.y + tag.height <= other.y || other.y + other.height <= tag.y, "panning keeps number labels readable");
  }
}
console.log("Result map passed: tips stay on shop-side targets after collisions, zoom and pan; four fixed directions, nearest candidate selection, readable numbers and selected-only hiding preserved.");
