import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/market/locationMarker.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { CURRENT_LOCATION: origin, CURRENT_LOCATION_ICON_CENTER: iconCenter, ORIGINAL_LOCATION_TIP: originalTip, reflectPointAcrossCenter, LOCATION_LABEL: label, getLocalMapPoint, getLocationMarkerPosition: position, getCandidateMarkerPosition } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const viewport = { width: 1080, height: 1920 };
const bubble = { width: label.width, height: label.height };
const marker = (center, scale = 1, overlay = 604, size = bubble, top = 208) => position(origin, center, scale, viewport, size, overlay, top);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function checkPointer(result, size, tail) {
  assert.ok([0, 90, 180, -90].includes(result.angle), "current location uses four directions");
  const center = { x: result.x + size.width / 2, y: result.y + size.height / 2 };
  const horizontal = result.side === "left" || result.side === "right";
  close(horizontal ? result.arrowTip.y : result.arrowTip.x, horizontal ? center.y : center.x);
  close(horizontal ? Math.abs(result.arrowTip.x - center.x) : Math.abs(result.arrowTip.y - center.y), (horizontal ? size.width : size.height) / 2 + tail);
  if (!result.tracking) assert.deepEqual(result.arrowTip, result.projected, "exact markers retain their actual map point");
  if (result.offscreen) assert.equal(result.tracking, true);
  const delta = horizontal ? result.projected.x - center.x : result.projected.y - center.y;
  assert.ok((result.side === "left" || result.side === "top" ? -delta : delta) >= -1e-8, "the cardinal arrow faces its target");
}
const chosenCandidates = new Set();
for (const scale of [0.16, 0.6, 1.2]) for (const x of [4200, 4950, 5100, 6000]) for (const y of [2000, 4300, 6500]) {
  const camera = { x, y };
  const result = getCandidateMarkerPosition([originalTip, origin], camera, scale, viewport, { width: 104, height: 47 }, 1128, 208, 0.75);
  chosenCandidates.add(result.candidateIndex);
  const labelCenter = { x: result.x + 52, y: result.y + 23.5 };
  const projectedCandidates = [originalTip, origin].map(point => ({ x: viewport.width / 2 + (point.x - x) * scale, y: viewport.height / 2 + (point.y - y) * scale }));
  assert.deepEqual(result.projected, projectedCandidates[result.candidateIndex]);
  const distance = point => Math.hypot(point.x - labelCenter.x, point.y - labelCenter.y);
  assert.ok(distance(result.projected) <= Math.min(...projectedCandidates.map(distance)) + 1e-8);
  checkPointer(result, { width: 104, height: 47 }, 12);
}
assert.equal(chosenCandidates.size, 2, "panning can select either target without adding another label");
assert.equal(origin.x, 4938);
close(origin.y, 4294.272077938642);
close((origin.x + originalTip.x) / 2, iconCenter.x);
close((origin.y + originalTip.y) / 2, iconCenter.y);
assert.deepEqual(reflectPointAcrossCenter(origin, iconCenter), originalTip, "reflection preserves the original offset on the opposite side");
for (const tip of [{ x: 50, y: 80 }, { x: 150, y: 80 }, { x: 100, y: 20 }, { x: 120, y: 140 }]) {
  const center = { x: 100, y: 80 };
  const reflected = reflectPointAcrossCenter(tip, center);
  close((tip.x + reflected.x) / 2, center.x);
  close((tip.y + reflected.y) / 2, center.y);
  close(Math.hypot(tip.x - center.x, tip.y - center.y), Math.hypot(reflected.x - center.x, reflected.y - center.y));
}
const initial = marker(origin);
assert.equal(initial.offscreen, false);
assert.equal(initial.side, "left");
assert.equal(initial.x, 540 + label.tailLength);
close(initial.y, 960 - bubble.height / 2);
assert.deepEqual(initial.arrowTip, { x: 540, y: 960 });
const moved = marker({ x: origin.x - 100, y: origin.y + 50 }, 2);
assert.deepEqual(moved.arrowTip, { x: 740, y: 860 });
assert.equal(marker({ x: 10000, y: origin.y }).side, "left");
assert.equal(marker({ x: 0, y: origin.y }).side, "right");
assert.equal(marker({ x: origin.x, y: 10000 }).side, "top");
assert.equal(marker({ x: origin.x, y: 0 }).side, "bottom");
// The search panel and bottom sheet count as outside the visible map.
assert.equal(marker({ x: origin.x, y: origin.y + 800 }).offscreen, true);
assert.equal(marker({ x: origin.x, y: origin.y - 500 }).offscreen, true);
// Admin has no search overlay.
assert.equal(marker({ x: origin.x, y: origin.y + 800 }, 1, 0, bubble, 0).offscreen, false);

for (const overlay of [420, 604, 1128]) {
  for (const scale of [15 * 4 / 3 / 38, 18 * 4 / 3 / 38, 32 * 4 / 3 / 38]) {
    for (const width of [173, 440]) {
      const size = { width: width * scale, height: 78 * scale };
      for (let x = 1400; x <= 6200; x += 200) {
        for (let y = 1350; y <= 10450; y += 200) {
          const result = marker({ x, y }, scale, overlay, size);
          assert.ok(result.x >= 8 - 1e-8 && result.x + size.width <= viewport.width - 8 + 1e-8);
          assert.ok(result.y >= 208 && result.y + size.height <= viewport.height - overlay - 8 + 1e-8);
          checkPointer(result, size, label.tailLength * scale);
        }
      }
    }
  }
}
// Shrinking the entire kiosk must not change map coordinates or pan distances.
for (const x of [0, 1, 1079, 1080]) {
  for (const y of [208, 209, 1315, 1316]) {
    const result = marker({ x: origin.x + 540 - x, y: origin.y + 960 - y });
    assert.ok(Number.isFinite(result.angle), "corner has a valid direction toward its actual map point");
    assert.deepEqual(result.projected, { x, y }, "corner tracking retains the original coordinate");
    assert.ok(result.x >= 0 && result.x + bubble.width <= 1080);
    assert.ok(result.y >= 208 && result.y + bubble.height <= 1316);
  }
}
for (const cssScale of [0.25, 0.5, 0.8, 1, 1.25]) {
  const rect = { left: 40, top: 20, width: 1080 * cssScale, height: 1920 * cssScale };
  assert.deepEqual(getLocalMapPoint({ x: 40 + 100 * cssScale, y: 20 + 300 * cssScale }, rect, viewport), { x: 100, y: 300 });
}
// The base maps must no longer contain the outlined, untranslatable location label.
for (const path of ["../public/images/daejomarket-map.svg", "../../../admin-frontend/public/images/daejomarket-map.svg"]) {
  const svg = readFileSync(new URL(path, import.meta.url), "utf8");
  assert.ok(!svg.includes('<rect x="5052" y="4253"'));
  assert.ok(!svg.includes('M5036 4291.73L5052.2'));
  assert.ok(svg.includes('<rect x="4961" y="4255"'), "retain the actual kiosk map icon");
  assert.ok(svg.includes('<rect x="4961" y="4255" width="52" height="76" rx="8" fill="#FF5E00"'), "kiosk target matches the orange current-location label");
}
assert.equal(readFileSync(new URL("../../../admin-frontend/src/components/market/locationMarker.ts", import.meta.url), "utf8"), source);
const diagonal = marker({ x: origin.x - 2000, y: origin.y - 1000 });
checkPointer(diagonal, bubble, label.tailLength);
console.log("Location marker passed: four compact pointer directions, exact anchors, tracked corners, zoom, scaled input, overlays, colours and admin sync.");
