import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(new URL("../package.json", import.meta.url));
const project = fileURLToPath(new URL("../", import.meta.url));
const root = path.resolve(project, "../..");
const publicRoot = path.join(project, "public");
const cache = new Map();
function load(file) {
  if (!path.extname(file)) file = [file + ".ts", file + ".tsx"].find(existsSync);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const localRequire = name => name.startsWith(".") ? load(path.resolve(path.dirname(file), name)) : require(name);
  new Function("require", "module", "exports", compiled)(localRequire, module, module.exports);
  return module.exports;
}

const artwork = load(path.join(project, "src/data/mapArtwork.ts"));
const { MapView } = load(path.join(project, "src/components/market/MapView.tsx"));
const { figmaMapShops } = load(path.join(project, "src/data/figma-map-shops.ts"));
const { MAP_SIZE, getMapOverviewCamera } = load(path.join(project, "src/components/market/mapOverview.ts"));
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const html = renderToStaticMarkup(React.createElement(MapView, { shops: figmaMapShops }));
const assets = [...artwork.mapUnderlayAssets, ...artwork.mapOverlayAssets];
assert.deepEqual(MAP_SIZE, { width: 9833, height: 12973 });
assert.deepEqual(artwork.CORE_MAP_SIZE, { width: 6807, height: 10577 });
for (const asset of assets) {
  const bytes = readFileSync(path.join(publicRoot, asset.url));
  assert.ok(bytes.length > 100, `${asset.url}: nonempty Figma asset`);
  const svgRoot = bytes.toString("utf8").match(/<svg\b[^>]*>/)[0];
  assert.equal(Number(svgRoot.match(/\bwidth="([\d.]+)"/)[1]), asset.width, `${asset.url}: intrinsic width`);
  assert.equal(Number(svgRoot.match(/\bheight="([\d.]+)"/)[1]), asset.height, `${asset.url}: intrinsic height`);
  assert.ok(html.includes(`href="${asset.url}" x="${asset.x}" y="${asset.y}" width="${asset.width}" height="${asset.height}"`), `${asset.url}: exact rendered slot`);
  const admin = readFileSync(path.join(root, "admin-frontend/public", asset.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), createHash("sha256").update(admin).digest("hex"), `${asset.url}: admin sync`);
}
assert.ok(html.includes('width="6807" height="10577"'), "original map is never stretched to the padded size");
assert.ok(html.includes('x="4866" y="666" width="185" height="80" fill="black"'), "the previous exit-7 artwork is masked out");
assert.ok(html.includes('mask="url(#'), "the core artwork uses the landmark-replacement mask");
assert.ok(!html.includes("figma.com/api/mcp/asset"), "no temporary URLs in rendered map");

console.log("PASS: seven exact Figma assets, native dimensions/positions, unchanged core geometry, and admin sync.");
