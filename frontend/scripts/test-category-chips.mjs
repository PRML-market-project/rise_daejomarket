import fs from "node:fs";
import assert from "node:assert/strict";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const source = fs.readFileSync(new URL("../src/features/kiosk/KioskSearchApp.tsx", import.meta.url), "utf8");
const component = source.slice(source.indexOf("function CategoryChips("), source.indexOf("function TouchKeyboard("));
const js = ts.transpile(component.replaceAll("import.meta.env.VITE_API_URL", "undefined"), {
  jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020,
});
const Chips = new Function("React", "getSearchTagIcon", "useKioskLocale", `${js}; return CategoryChips;`)(
  React, () => ({ asset: "restaurant", color: "#ff9500", size: 25.185 }), () => ({ t: text => text }),
);
const render = (configuredTags) => renderToStaticMarkup(React.createElement(Chips, { configuredTags, onChoose() {} }));
for (const input of [undefined, []]) {
  const html = render(input);
  for (const name of ["주변식당", "반찬가게", "간식가게"]) assert.ok(html.includes(name));
  assert.equal((html.match(/<button/g) ?? []).length, 3);
}
const tag = { id: 7, name: "관리자 태그", icon: "식당", keywords: "음식", visible: false };
assert.equal((render([tag]).match(/<button/g) ?? []).length, 0);
const configured = render([{ ...tag, visible: true }]);
assert.ok(configured.includes(tag.name));
assert.ok(!configured.includes("주변식당"));
console.log("PASS: missing/empty defaults, explicitly hidden tags, configured tags");
