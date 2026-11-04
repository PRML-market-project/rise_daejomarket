import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/features/kiosk/hangulKeyboard.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
}).outputText;
const { appendHangulKey, deleteLastKeyboardCharacter } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);
const type = (keys) => Array.from(keys).reduce(appendHangulKey, "");

assert.equal(type("ㄱㅏㄱㅔ"), "가게");
assert.equal(type("ㅅㅣㅈㅏㅇ"), "시장");
assert.equal(type("ㅎㅏㄴㄱㅡㄹ"), "한글");
assert.equal(type("ㄱㅗㅏㄴ"), "관");
assert.equal(type("ㅇㅣㄹㄱㅓ"), "일거");
assert.equal(type("ㅂㅏㄲ"), "밖");
assert.equal(type("ㄱㅏㅂㅅ"), "값");
assert.equal(type("ㄱㅏㅂㅅㅣ"), "갑시");
assert.equal(type("ㄱㅏ ㄴㅏ"), "가 나");

assert.equal(deleteLastKeyboardCharacter("값"), "갑");
assert.equal(deleteLastKeyboardCharacter("갑"), "가");
assert.equal(deleteLastKeyboardCharacter("가"), "ㄱ");
assert.equal(deleteLastKeyboardCharacter("ㄱ"), "");
assert.equal(deleteLastKeyboardCharacter("관"), "과");
assert.equal(deleteLastKeyboardCharacter("과"), "고");
assert.equal(deleteLastKeyboardCharacter("abc"), "ab");

console.log("PASS: Hangul syllable composition, final transfer, compounds, spacing, backspace");
