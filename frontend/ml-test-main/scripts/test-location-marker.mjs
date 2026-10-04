import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/components/market/locationMarker.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
const { CURRENT_LOCATION: origin, LOCATION_LABEL: label, getLocalMapPoint, getLocationMarkerPosition: position } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const viewport = { width: 1080, height: 1920 };
const bubble = { width: label.width, height: label.height };
const marker = (center, scale = 1, overlay = 604, size = bubble, top = 208) => position(origin, center, scale, viewport, size, overlay, top);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
assert.equal(origin.x, 5036);
close(origin.y, 4291.727922061358);
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
          if (!result.offscreen) {
            assert.deepEqual(result.arrowTip, result.projected, "visible tip stays on its map point");
            continue;
          }
          assert.ok(result.x >= 8 - 1e-8 && result.x + size.width <= viewport.width - 8 + 1e-8);
          assert.ok(result.y >= 208 && result.y + size.height <= viewport.height - overlay - 8 + 1e-8);
          const center = { x: result.x + size.width / 2, y: result.y + size.height / 2 };
          const directions = { left: 180, right: 0, top: -90, bottom: 90 };
          assert.equal(result.angle, directions[result.side]);
          if (result.side === "left" || result.side === "right") {
            close(result.arrowTip.y, center.y);
            close(result.arrowTip.x, center.x + (result.side === "left" ? -1 : 1) * (size.width / 2 + label.tailLength * scale));
          } else {
            close(result.arrowTip.x, center.x);
            close(result.arrowTip.y, center.y + (result.side === "top" ? -1 : 1) * (size.height / 2 + label.tailLength * scale));
          }
        }
      }
    }
  }
}
// Shrinking the entire kiosk must not change map coordinates or pan distances.
for (const x of [0, 1, 1079, 1080]) {
  for (const y of [208, 209, 1315, 1316]) {
    const result = marker({ x: origin.x + 540 - x, y: origin.y + 960 - y });
    assert.equal(result.offscreen, true, "corner uses an indicator with a centred arrow");
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
  assert.ok(svg.includes('<rect x="4961" y="4255" width="52" height="76" rx="8" fill="#22A36B"'), "kiosk target matches the map accent");
}
assert.equal(readFileSync(new URL("../../../admin-frontend/src/components/market/locationMarker.ts", import.meta.url), "utf8"), source);
console.log("Location marker passed: fixed anchor, four centred arrow directions, zoom, scaled input, overlays, corners, colours and admin sync.");
