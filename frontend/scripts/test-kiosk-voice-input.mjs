import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/features/kiosk/KioskSearchApp.tsx', import.meta.url), 'utf8');
const start = source.indexOf('  const startVoice = () => {');
const end = source.indexOf('\n  const submit =', start);
assert.ok(start >= 0 && end > start);
const compiled = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;

function harness() {
  let now = 0, nextId = 0, state, transcript, query, recognition;
  const timers = new Map();
  const cancelVoiceRef = { current: null };
  class Recognition {
    stops = 0;
    aborts = 0;
    constructor() { recognition = this; }
    start() { this.onstart(); }
    stop() { this.stops++; }
    abort() { this.aborts++; }
    result(text, isFinal = false) { this.onresult({ results: [Object.assign([{ transcript: text }], { isFinal })] }); }
  }
  const window = {
    SpeechRecognition: Recognition,
    setTimeout(fn, ms) { const id = ++nextId; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const begin = new Function('window', 'cancelVoiceRef', 'setVoiceState', 'setTranscript', 'setQuery', 'language', 'VOICE_SILENCE_TIMEOUT_MS', `${compiled}; return startVoice;`)(
    window, cancelVoiceRef, value => { state = value; }, value => { transcript = value; }, value => { query = value; }, 'ko', 2000,
  );
  const tick = ms => {
    now += ms;
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  };
  begin();
  return { begin, tick, cancelVoiceRef, timers, get recognition() { return recognition; }, get state() { return state; }, get query() { return query; }, get transcript() { return transcript; } };
}

const silent = harness();
silent.tick(1999);
assert.equal(silent.recognition.stops, 0);
silent.tick(1);
assert.equal(silent.recognition.stops, 1);
assert.equal(silent.state, 'error');

const speech = harness();
speech.tick(1000);
speech.recognition.result('맛집');
speech.tick(1500);
assert.equal(speech.recognition.stops, 0);
speech.recognition.result('맛집 찾아줘', true);
assert.equal(speech.state, 'recognizing', 'a final result must not end continuous listening early');
speech.tick(1999);
assert.equal(speech.recognition.stops, 0);
speech.tick(1);
assert.equal(speech.recognition.stops, 1);
assert.equal(speech.state, 'confirmed');
assert.equal(speech.query, '맛집 찾아줘');
speech.recognition.result('맛집 찾아주세요', true);
assert.equal(speech.query, '맛집 찾아주세요', 'retain the final result returned by stop');
speech.recognition.onend();
assert.equal(speech.cancelVoiceRef.current, null);
assert.equal(speech.timers.size, 0);

const speaking = harness();
speaking.recognition.onspeechstart();
speaking.tick(3000);
assert.equal(speaking.recognition.stops, 0, 'do not cut off speech awaiting its first transcript');
speaking.recognition.onspeechend();
speaking.tick(2000);
assert.equal(speaking.recognition.stops, 1);

const cancelled = harness();
const old = cancelled.recognition;
cancelled.begin();
assert.equal(old.aborts, 1);
old.result('늦게 도착한 결과');
assert.equal(cancelled.transcript, '');
cancelled.cancelVoiceRef.current();
cancelled.tick(3000);
assert.equal(cancelled.recognition.stops, 0);
assert.equal(cancelled.timers.size, 0);
console.log('Kiosk voice input silence, final transcript, and cancellation checks passed.');
