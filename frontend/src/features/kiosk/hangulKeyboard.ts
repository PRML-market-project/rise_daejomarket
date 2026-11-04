const INITIALS = Array.from("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ");
const MEDIALS = Array.from("ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ");
const FINALS = ["", ...Array.from("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")];

const COMBINED_MEDIALS: Record<string, string> = {
  "ㅗㅏ": "ㅘ", "ㅗㅐ": "ㅙ", "ㅗㅣ": "ㅚ", "ㅘㅣ": "ㅙ",
  "ㅜㅓ": "ㅝ", "ㅜㅔ": "ㅞ", "ㅜㅣ": "ㅟ", "ㅝㅣ": "ㅞ",
  "ㅡㅣ": "ㅢ",
};
const COMBINED_FINALS: Record<string, string> = {
  "ㄱㅅ": "ㄳ", "ㄴㅈ": "ㄵ", "ㄴㅎ": "ㄶ",
  "ㄹㄱ": "ㄺ", "ㄹㅁ": "ㄻ", "ㄹㅂ": "ㄼ", "ㄹㅅ": "ㄽ",
  "ㄹㅌ": "ㄾ", "ㄹㅍ": "ㄿ", "ㄹㅎ": "ㅀ", "ㅂㅅ": "ㅄ",
};
const SPLIT_FINALS = Object.fromEntries(
  Object.entries(COMBINED_FINALS).map(([parts, combined]) => [combined, Array.from(parts)]),
) as Record<string, string[]>;
const SIMPLE_MEDIALS: Record<string, string> = {
  "ㅘ": "ㅗ", "ㅙ": "ㅗ", "ㅚ": "ㅗ",
  "ㅝ": "ㅜ", "ㅞ": "ㅜ", "ㅟ": "ㅜ", "ㅢ": "ㅡ",
};

function syllable(initial: string, medial: string, final = "") {
  return String.fromCharCode(0xac00 + (INITIALS.indexOf(initial) * MEDIALS.length + MEDIALS.indexOf(medial)) * FINALS.length + FINALS.indexOf(final));
}

function parts(character: string) {
  const offset = character.charCodeAt(0) - 0xac00;
  if (offset < 0 || offset >= 11172) return null;
  return {
    initial: INITIALS[Math.floor(offset / (MEDIALS.length * FINALS.length))],
    medial: MEDIALS[Math.floor(offset / FINALS.length) % MEDIALS.length],
    final: FINALS[offset % FINALS.length],
  };
}

export function appendHangulKey(value: string, key: string): string {
  if (!INITIALS.includes(key) && !MEDIALS.includes(key)) return value + key;
  const characters = Array.from(value);
  const last = characters.pop();
  if (!last) return key;
  const prefix = characters.join("");
  const previous = parts(last);

  if (MEDIALS.includes(key)) {
    if (previous) {
      if (previous.final) {
        const [remainingFinal, nextInitial] = SPLIT_FINALS[previous.final] ?? ["", previous.final];
        return prefix + syllable(previous.initial, previous.medial, remainingFinal) + syllable(nextInitial, key);
      }
      const medial = COMBINED_MEDIALS[previous.medial + key];
      return medial ? prefix + syllable(previous.initial, medial) : value + key;
    }
    if (INITIALS.includes(last)) return prefix + syllable(last, key);
    return prefix + (COMBINED_MEDIALS[last + key] ?? last + key);
  }

  if (previous) {
    if (!previous.final && FINALS.includes(key)) return prefix + syllable(previous.initial, previous.medial, key);
    const final = COMBINED_FINALS[previous.final + key];
    if (final) return prefix + syllable(previous.initial, previous.medial, final);
  }
  return value + key;
}

export function deleteLastKeyboardCharacter(value: string): string {
  const characters = Array.from(value);
  const last = characters.pop();
  if (!last) return value;
  const prefix = characters.join("");
  const previous = parts(last);
  if (previous) {
    if (previous.final) {
      const final = SPLIT_FINALS[previous.final]?.[0] ?? "";
      return prefix + syllable(previous.initial, previous.medial, final);
    }
    if (SIMPLE_MEDIALS[previous.medial]) return prefix + syllable(previous.initial, SIMPLE_MEDIALS[previous.medial]);
    return prefix + previous.initial;
  }
  return prefix + (SIMPLE_MEDIALS[last] ?? "");
}
