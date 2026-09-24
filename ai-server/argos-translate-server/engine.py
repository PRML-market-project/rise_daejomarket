from functools import lru_cache
import json
import runtime

GLOSSARY = json.loads((runtime.ROOT / "glossary.json").read_text(encoding="utf-8"))


class ArgosEngine:
    def __init__(self, allow_download=False):
        from argostranslate import package, translate
        installed = {(p.from_code, p.to_code) for p in package.get_installed_packages()}
        missing = set(runtime.REQUIRED_PAIRS) - installed
        if missing:
            raise RuntimeError(f"Missing Argos models {sorted(missing)}. Run install_models.py first.")
        languages = {language.code: language for language in translate.get_installed_languages()}
        self.ko_en = languages["ko"].get_translation(languages["en"])
        self.en_vi = languages["en"].get_translation(languages["vi"])
        # SentencePiece's Windows file loader cannot handle some non-ASCII
        # checkout paths. Loading the same model bytes avoids that limitation.
        from argostranslate.tokenizer import SentencePieceTokenizer
        import sentencepiece
        import stanza
        for model in (self.ko_en, self.en_vi):
            packaged = getattr(model, "underlying", model)
            tokenizer = packaged.pkg.tokenizer
            if isinstance(tokenizer, SentencePieceTokenizer):
                tokenizer.processor = sentencepiece.SentencePieceProcessor(model_proto=tokenizer.model_file.read_bytes())
            if not allow_download:
                packaged.sentencizer.stanza_pipeline = stanza.Pipeline(
                    lang=packaged.pkg.from_code, dir=str(packaged.pkg.package_path / "stanza"),
                    processors="tokenize", use_gpu=False, logging_level="ERROR", download_method=None,
                )

    @lru_cache(maxsize=4096)
    def _english(self, text):
        return self.ko_en.translate(text)

    @lru_cache(maxsize=4096)
    def _vietnamese(self, english):
        return self.en_vi.translate(english)

    def translate(self, text, source, targets):
        if source == "ko" and text.strip() in GLOSSARY:
            return {target: GLOSSARY[text.strip()][target] for target in targets}
        english = self._english(text) if source == "ko" else text
        output = {}
        for target in targets:
            translated = english if target == "en" else self._vietnamese(english)
            if not translated.strip():
                raise RuntimeError("Argos returned an empty translation")
            output[target] = translated
        return output
