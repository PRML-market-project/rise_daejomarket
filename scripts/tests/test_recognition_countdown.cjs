const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('../../frontend/node_modules/typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/features/kiosk/recognitionCountdown.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {}, performance, setTimeout, clearTimeout };
vm.runInNewContext(code, context);
const { startRecognitionCountdown } = context.exports;

function fakeClock() {
  let now = 0, nextId = 0;
  const tasks = new Map();
  return {
    now: () => now,
    schedule(callback, delay) {
      const id = ++nextId; tasks.set(id, { callback, at: now + delay });
      return () => tasks.delete(id);
    },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        const due = [...tasks].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at; tasks.delete(due[0]); due[1].callback();
      }
      now = target;
    },
    stall(ms) { now += ms; const callbacks = [...tasks.values()]; tasks.clear(); callbacks.forEach(task => task.callback()); },
    queuedCallback() { return [...tasks.values()][0]?.callback; },
    count: () => tasks.size,
  };
}

test('displays 5 through 1 and searches exactly once at five seconds', () => {
  const clock = fakeClock(), ticks = []; let searches = 0;
  startRecognitionCountdown(value => ticks.push(value), () => searches++, clock);
  clock.advance(4999);
  assert.deepEqual(ticks, [5, 4, 3, 2, 1]); assert.equal(searches, 0);
  clock.advance(1); assert.equal(searches, 1);
  clock.advance(10000); assert.equal(searches, 1); assert.equal(clock.count(), 0);
});

test('clearing, retrying, leaving or submitting manually cancels pending automatic search', () => {
  for (const action of ['clear', 'retry', 'leave', 'manual search']) {
    const clock = fakeClock(); let searches = 0;
    const cancel = startRecognitionCountdown(() => {}, () => searches++, clock);
    clock.advance(4000); cancel(); clock.advance(10000);
    assert.equal(searches, 0, action); assert.equal(clock.count(), 0, action);
  }
});

test('a callback queued before cancellation cannot submit afterwards', () => {
  const clock = fakeClock(); let searches = 0;
  const cancel = startRecognitionCountdown(() => {}, () => searches++, clock);
  const queued = clock.queuedCallback(); cancel(); clock.advance(5000); queued();
  assert.equal(searches, 0); assert.equal(clock.count(), 0);
});

test('a new recognized phrase gets a fresh five seconds and replaces the old search', () => {
  const clock = fakeClock(), submitted = [], ticks = [];
  const cancelOld = startRecognitionCountdown(() => {}, () => submitted.push('old phrase'), clock);
  clock.advance(3000); cancelOld();
  startRecognitionCountdown(value => ticks.push(value), () => submitted.push('new phrase'), clock);
  clock.advance(4999); assert.deepEqual(submitted, []); assert.equal(ticks[0], 5);
  clock.advance(1); assert.deepEqual(submitted, ['new phrase']);
});

test('delayed browser timers use the actual deadline instead of extending the countdown', () => {
  const clock = fakeClock(); let searches = 0;
  startRecognitionCountdown(() => {}, () => searches++, clock);
  clock.stall(6200); assert.equal(searches, 1); assert.equal(clock.count(), 0);
});
