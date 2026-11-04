import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/kiosk/kioskAiSearch.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.replaceAll('import.meta.env', 'env'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const exports = {};
new Function('exports', 'env', compiled)(exports, {});
const format = exports.formatKioskAiMessage;
const explanation = '비 오는 날 따뜻하게 즐기기 좋은 음식으로 칼국수와 전을 추천해 드립니다. 아래 가게들을 확인해 보세요.';
assert.equal(format(`**${explanation}  [카테고리 매치] - 도깨비칼국수 (시장 남측) - 장터빈대떡 (시장 서측 통로)**`), explanation);
assert.equal(format('아래 가게들을 확인해 보세요.\n- 도깨비칼국수\n- 장터빈대떡'), '아래 가게들을 확인해 보세요.');
assert.equal(format('가'.repeat(85)), '가'.repeat(85));
assert.equal(Array.from(format('가'.repeat(86))).length, 85);
assert.equal(Array.from(format('😀'.repeat(86))).length, 85);
assert.equal(format('가게를 안내해 드릴게요. ' + '추가 안내 '.repeat(30)), '가게를 안내해 드릴게요.');

globalThis.fetch = async () => ({ ok: true, json: async () => ({
  chat_message: `${explanation} [카테고리 매치] - 도깨비칼국수`,
  result: { status: 'success', intent: 'get_store', items: [{ target_id: 'shop-1' }] },
}) });
const result = await exports.searchKioskWithAi('비 오는 날 음식 추천', 'ko', new AbortController().signal);
assert.equal(result.message, explanation);
assert.deepEqual(result.shopIds, ['shop-1']);
console.log('Kiosk AI message checks passed.');
