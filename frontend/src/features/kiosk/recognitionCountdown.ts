export const RECOGNITION_SEARCH_SECONDS = 5;

type CountdownClock = {
  now: () => number;
  schedule: (callback: () => void, delayMs: number) => () => void;
};
const browserClock: CountdownClock = {
  now: () => performance.now(),
  schedule(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

/** A cancelled recognition must never submit, even if its timer callback was already queued. */
export function startRecognitionCountdown(onTick: (seconds: number) => void, onComplete: () => void, clock: CountdownClock = browserClock) {
  const deadline = clock.now() + RECOGNITION_SEARCH_SECONDS * 1000;
  let cancelled = false;
  let cancelTimer = () => {};
  onTick(RECOGNITION_SEARCH_SECONDS);
  const tick = () => {
    if (cancelled) return;
    const millisecondsLeft = Math.max(0, deadline - clock.now());
    if (millisecondsLeft === 0) {
      cancelled = true;
      onComplete();
      return;
    }
    onTick(Math.ceil(millisecondsLeft / 1000));
    cancelTimer = clock.schedule(tick, Math.min(1000, millisecondsLeft));
  };
  cancelTimer = clock.schedule(tick, 1000);
  return () => { cancelled = true; cancelTimer(); };
}
