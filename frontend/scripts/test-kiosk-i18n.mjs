import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);
const source = fs.readFileSync(new URL("src/features/kiosk/i18n.tsx", root), "utf8");
const compiled = ts.transpile(source, { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true });
const exports = {};
new Function("require", "exports", compiled)(name => name === "@/data/kiosk-translations.json" ? {} : require(name), exports);
const missing = new Set();
for (const file of ["KioskSearchApp", "KioskResultScreens", "KioskPromotionPlayer"]) {
  const content = fs.readFileSync(new URL(`src/features/kiosk/${file}.tsx`, root), "utf8");
  const ast = ts.createSourceFile(file + ".tsx", content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === "t" && ts.isStringLiteral(node.arguments[0]) && /[가-힣]/.test(node.arguments[0].text)) {
      for (const lang of ["en", "vi"]) if (exports.createTranslator(lang)(node.arguments[0].text) === node.arguments[0].text) missing.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
}
assert.deepEqual([...missing], [], "All fixed UI text must have English and Vietnamese translations");
const dynamic = { "가게 이름": { en: "Shop name", vi: "Tên cửa hàng" } };
assert.equal(exports.createTranslator("en", dynamic)("가게 이름"), "Shop name");
assert.equal(exports.createTranslator("vi", dynamic)("가게 이름"), "Tên cửa hàng");
assert.equal(exports.createTranslator("ko", dynamic)("가게 이름"), "가게 이름");
assert.equal(exports.createTranslator("en")("미번역 가게"), "미번역 가게");
assert.equal(exports.createTranslator("en")("현재 위치에서 {distance}m", { distance: 138 }), "138 m from here");
console.log("PASS: UI dictionaries, saved translations, Korean fallback, interpolation");
