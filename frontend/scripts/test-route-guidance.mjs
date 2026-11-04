import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const options = { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React };
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: options }).outputText).toString("base64")}`);
const { figmaMapShops } = await importSource(read("../src/data/figma-map-shops.ts"));
// Exercise the actual route geometry without mounting the browser map.
const parsed = ts.createSourceFile("MapView.tsx", read("../src/components/market/MapView.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const geometry = ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed, parsed.statements.filter(node => !ts.isImportDeclaration(node))));
const { getRouteDirectionForShop } = await importSource(geometry);
const shop = id => {
  const result = figmaMapShops.find(value => value.id === id);
  assert.ok(result, `shop ${id} exists`);
  return result;
};
const north = shop("585:28772");
const south = shop("585:28780");
const nearYangji = shop("585:28779");
const farYangji = shop("585:28804");
assert.equal(getRouteDirectionForShop(north), "left");
assert.equal(getRouteDirectionForShop(south), "right");
assert.equal(nearYangji.name, farYangji.name);
assert.equal(getRouteDirectionForShop(nearYangji), "behind", "only the Yangji beside the kiosk is behind it");
assert.equal(getRouteDirectionForShop(farYangji), "right", "the other Yangji keeps its route direction");
assert.equal(getRouteDirectionForShop({ ...nearYangji, name: "변경된 가게 이름" }), "behind", "admin renaming does not break the nearby-shop exception");
for (const id of ["585:28795", "585:28796", "585:28797"]) {
  assert.equal(getRouteDirectionForShop(shop(id)), "left", "crosswalk routes use their initial upward segment");
}
assert.equal(getRouteDirectionForShop({ ...north, id: "horizontal", section: "", guideX: 4920, guideY: 4291.5 }), "right", "a route without vertical travel follows the requested default");

function loadCommonJs(path, overrides = {}) {
  const compiled = ts.transpileModule(read(path), { compilerOptions: { ...options, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  new Function("require", "exports", "React", compiled)(name => overrides[name] ?? require(name), exports, React);
  return exports;
}
const locale = loadCommonJs("../src/features/kiosk/i18n.tsx");
const presentation = loadCommonJs("../src/features/kiosk/searchResultPresentation.ts");
const { DirectionsPanel } = loadCommonJs("../src/features/kiosk/KioskResultScreens.tsx", { "./i18n": locale, "./searchResultPresentation": presentation });
function renderGuidance(selected, language = "ko") {
  const markup = renderToStaticMarkup(React.createElement(locale.KioskLocaleContext.Provider, { value: { language, t: locale.createTranslator(language) } },
    React.createElement(DirectionsPanel, { shopName: selected.name, direction: getRouteDirectionForShop(selected), distanceMeters: 30, onBack() {}, onHome() {} })));
  const heading = markup.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/)[1];
  return { markup, heading, text: heading.replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'") };
}
const left = renderGuidance(north);
assert.ok(left.text.includes(`“${north.name}”은`));
assert.match(left.text, /왼쪽으로\s+30m\s+이동하세요/);
assert.match(left.heading, /<strong[^>]*>30m<\/strong>/, "route distance keeps the Figma highlight");
const right = renderGuidance(farYangji);
assert.ok(right.text.includes("“양지상회”는"));
assert.match(right.text, /오른쪽으로\s+30m\s+이동하세요/);
const behind = renderGuidance(nearYangji);
assert.ok(behind.text.includes("바로 뒤에 있어요"));
assert.ok(!behind.heading.includes("<strong") && !behind.text.includes("이동하세요"), "behind guidance has no walking-distance instruction");
for (const language of ["en", "vi"]) {
  for (const phrase of ["왼쪽으로", "오른쪽으로", "바로 뒤에 있어요", "“{name}”은", "“{name}”는"]) {
    assert.notEqual(locale.createTranslator(language)(phrase), phrase, `${phrase} is localized in ${language}`);
  }
}
assert.match(renderGuidance(north, "en").text, /Head left for\s+30m/);
assert.match(renderGuidance(south, "en").text, /Head right for\s+30m/);
assert.ok(renderGuidance(nearYangji, "en").text.includes("right behind you"));
console.log("PASS: upward/left, downward/right, crosswalk starts, nearby Yangji only, rendered copy, distance highlight and translations.");
