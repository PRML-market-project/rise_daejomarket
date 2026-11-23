const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../../frontend/node_modules/typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/kiosk/kioskBrowserTitle.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, window: { location: { hostname: 'localhost', port: '5173' } } };
vm.runInNewContext(code, context);
const { kioskBrowserTitle } = context.exports;
assert.equal(kioskBrowserTitle('kiosk'), '[DAEJO:5173] kiosk');
assert.equal(kioskBrowserTitle('[DAEJO:5173] kiosk'), '[DAEJO:5173] kiosk');
for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
  assert.equal(kioskBrowserTitle('admin', { hostname, port: '5173' }), '[DAEJO:5173] admin');
}
for (const location of [{ hostname: 'example.com', port: '5173' }, { hostname: 'localhost', port: '3000' }, { hostname: 'localhost.evil', port: '5173' }, { hostname: 'localhost', port: '51730' }]) {
  assert.equal(kioskBrowserTitle('Other site', location), 'Other site');
}
console.log('Kiosk browser title tests passed.');
