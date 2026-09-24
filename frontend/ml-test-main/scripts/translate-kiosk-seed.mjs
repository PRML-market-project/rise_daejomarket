// Emits a seed snapshot for review; no credentials or external translation API.
import fs from "node:fs";
const backend = new URL("../../../backend/", import.meta.url);
const endpoint = (process.env.ARGOS_TRANSLATOR_URL || "http://127.0.0.1:17834").replace(/\/$/, "");
const seed = JSON.parse(fs.readFileSync(new URL("src/main/resources/translations/kiosk-seed.json", backend), "utf8"));
const names = new Set(JSON.parse(fs.readFileSync(new URL("src/main/resources/translations/kiosk-shop-names.json", backend), "utf8")));
const pending = Object.keys(seed).filter(text => process.argv.includes("--all") || !seed[text].en || !seed[text].vi);
for (let i = 0; i < pending.length; i += 8) {
  const texts = pending.slice(i, i + 8);
  const response = await fetch(`${endpoint}/translate`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts, source: "ko", targets: ["en", "vi"], nameTexts: texts.filter(text => names.has(text)) }), signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Local Argos returned HTTP ${response.status}`);
  const { results } = await response.json();
  if (!Array.isArray(results) || results.length !== texts.length) throw new Error("Invalid translation response");
  results.forEach(({ sourceText, translations }, index) => {
    if (sourceText !== texts[index] || !translations?.en || !translations?.vi) throw new Error("Incomplete or mismatched translation");
    seed[sourceText] = translations;
  });
}
process.stdout.write(JSON.stringify(seed, null, 2));
