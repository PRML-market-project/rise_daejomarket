import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/kiosk/useKioskSpeech.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.replace(/^import .*;\r?\n/gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function harness({ response, decoding, resume } = {}) {
  const effects = [], states = [], timers = new Map();
  const original = [Float32Array.from([0.1, -0.3, 0.7, -0.6]), Float32Array.from([-0.2, 0.4, -0.8, 0.5])];
  const audio = { numberOfChannels: 2, length: 4, sampleRate: 1000, getChannelData: i => original[i] };
  const node = { disconnects: 0, stops: 0, connect() {}, disconnect() { this.disconnects++; }, stop() { this.stops++; }, start() { this.started = true; } };
  const context = {
    baseLatency: 0.03, outputLatency: 0.08,
    resume: () => resume ?? Promise.resolve(),
    close: () => Promise.resolve(),
    decodeAudioData: () => decoding ?? Promise.resolve(audio),
    createBuffer(channels, length, sampleRate) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { length, sampleRate, getChannelData: i => data[i] };
    },
    createBufferSource: () => node,
  };
  let signal;
  const exports = {};
  const hook = new Function('exports', 'useCallback', 'useEffect', 'useRef', 'useState', 'AudioContext', 'fetch', 'KIOSK_TTS_URL', 'setTimeout', 'clearTimeout', compiled + '; return exports.useKioskSpeech;')(
    exports, fn => fn, fn => effects.push(fn), () => ({ current: null }), () => [false, value => states.push(value)],
    function () { return context; },
    async (_url, options) => { signal = options.signal; return response ?? { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }; },
    '/api/tts', (fn, ms) => { const id = timers.size + 1; timers.set(id, { fn, ms }); return id; }, id => timers.delete(id),
  );
  const { prepareSpeech } = hook('A complete search result.', 'en');
  prepareSpeech();
  const cleanup = effects[0]();
  return { states, timers, node, original, cleanup, get signal() { return signal; } };
}

const normal = harness();
assert.deepEqual(normal.states, [true], 'generation must protect the idle timer');
await flush();
assert.equal(normal.node.started, true);
assert.equal(normal.node.buffer.length, 304);
for (let channel = 0; channel < 2; channel++) {
  assert.deepEqual(normal.node.buffer.getChannelData(channel).slice(0, 4), normal.original[channel], 'last speech samples must remain unchanged');
  assert.ok(normal.node.buffer.getChannelData(channel).slice(4).every(v => v === 0));
}
normal.node.onended();
assert.deepEqual(normal.states, [true], 'wait for physical output to drain');
const [finish] = normal.timers.values();
assert.equal(finish.ms, 110);
finish.fn();
assert.deepEqual(normal.states, [true, false]);
normal.cleanup();
assert.equal(normal.signal.aborted, true);
assert.equal(normal.timers.size, 0);
assert.equal(normal.node.onended, null);

const decoding = deferred();
const cancelled = harness({ decoding: decoding.promise });
await flush();
cancelled.cleanup();
decoding.resolve({});
await flush();
assert.equal(cancelled.node.started, undefined, 'an old response must not start after navigation');
assert.deepEqual(cancelled.states, [true, false]);

const resume = deferred();
const suspended = harness({ resume: resume.promise });
await flush();
assert.equal(suspended.node.started, undefined, 'resume the audio context before starting');
suspended.cleanup();
resume.resolve();
await flush();
assert.equal(suspended.node.started, undefined);

const warn = console.warn;
console.warn = () => {};
try {
  const failed = harness({ response: { ok: false, status: 503 } });
  await flush();
  assert.deepEqual(failed.states, [true, false], 'failed generation must release the idle timer');
} finally { console.warn = warn; }

// Exercise the actual inactivity effect with simulated clock ticks.
const app = readFileSync(new URL('../src/features/kiosk/KioskSearchApp.tsx', import.meta.url), 'utf8');
const start = app.indexOf('    // Start the full idle interval');
const end = app.indexOf('  }, [returnToWelcome, screen, isSpeechActive]);', start);
assert.ok(start >= 0 && end > start);
const idleCode = ts.transpileModule(`function idle(screen, isSpeechActive, window, returnToWelcome, INACTIVITY_TIMEOUT_MS) { ${app.slice(start, end)} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const idle = new Function(`${idleCode}; return idle;`)();
let calls = 0, resets = 0;
const fakeWindow = {
  setTimeout(fn, ms) { calls++; assert.equal(ms, 30_000); this.timeout = fn; return calls; },
  clearTimeout() {}, addEventListener() {}, removeEventListener() {},
};
assert.equal(idle('results', true, fakeWindow, () => resets++, 30_000), undefined);
assert.equal(calls, 0, 'even speech longer than 30 seconds must not schedule an idle reset');
const idleCleanup = idle('results', false, fakeWindow, () => resets++, 30_000);
assert.equal(calls, 1, 'a full idle interval begins after playback ends');
fakeWindow.timeout();
assert.equal(resets, 1);
idleCleanup();
console.log('PASS: original stereo samples, output drain, navigation cancellation, suspended context, failure recovery, idle reset after speech');
