import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function load(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}
const { shuffleSearchMatches, getSearchResultPresentation, getSearchResultPage } = await load("../src/features/kiosk/searchResultPresentation.ts");
const { figmaMapShops } = await load("../src/data/figma-map-shops.ts");
let seed = 20261103;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
for (const category of new Set(figmaMapShops.map(shop => shop.category))) {
  const shops = figmaMapShops.filter(shop => shop.category === category);
  const firstPages = new Set();
  const orders = new Set();
  for (let trial = 0; trial < 300; trial++) {
    const shuffled = shuffleSearchMatches(shops, random);
    assert.deepEqual(new Set(shuffled.map(shop => shop.id)), new Set(shops.map(shop => shop.id)));
    const results = getSearchResultPresentation(shuffled, "relevance", () => 0);
    const allPages = Array.from({ length: Math.ceil(results.length / 6) }, (_, i) => getSearchResultPage(results, i + 1).visible).flat();
    assert.equal(allPages.length, shops.length, "pagination must expose even the last shop");
    for (const { shop } of getSearchResultPage(results, 1).visible) firstPages.add(shop.id);
    orders.add(shuffled.map(shop => shop.id).join(","));
  }
  assert.equal(firstPages.size, shops.length, `${category}: no shop excluded from the first page`);
  if (shops.length > 1) assert.ok(orders.size > 1);
}
const source = readFileSync(new URL("../src/features/kiosk/KioskSearchApp.tsx", import.meta.url), "utf8");
const tagSearch = source.slice(source.indexOf("const tagResultShops"), source.indexOf("const resultShops"));
assert.ok(!/slice\(0,\s*12\)/.test(tagSearch), "tag search must not discard shops after the first twelve");
assert.ok(tagSearch.includes("shuffleSearchMatches("));
console.log("PASS: every catalog shop reaches cards/pages, repeated orders vary, tag matches are not capped.");
