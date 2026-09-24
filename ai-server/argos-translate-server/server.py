import logging
import os
import re
from contextlib import asynccontextmanager
from threading import Lock
from typing import Literal

import runtime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, model_validator
from engine import ArgosEngine

log = logging.getLogger(__name__)


def translate_shop_name(text: str, targets: list[str]) -> dict[str, str]:
    from hangul_romanize import Transliter
    from hangul_romanize.rule import academic

    floor = re.fullmatch(r"(.+?)\s*\((\d+)층(?:\s*(고객센터))?\)", text)
    name = floor.group(1) if floor else text
    romanized = Transliter(academic).translit(name)
    label = f"{romanized} ({name})" if romanized != name else name
    if not floor:
        return {target: label for target in targets}
    number, service = floor.group(2), floor.group(3)
    suffixes = {
        "en": f"{number}F" + (" Customer Center" if service else ""),
        "vi": f"Tầng {number}" + (" · Trung tâm khách hàng" if service else ""),
    }
    return {target: f"{label} · {suffixes[target]}" for target in targets}


class TranslationRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=16)
    source: Literal["ko", "en"] = "ko"
    nameTexts: list[str] = Field(default_factory=list, max_length=16)
    targets: list[Literal["en", "vi"]] = Field(default_factory=lambda: ["en", "vi"], min_length=1, max_length=2)

    @model_validator(mode="after")
    def validate_texts(self):
        if any(not text.strip() for text in self.texts):
            raise ValueError("Texts cannot be blank")
        if sum(len(text) for text in self.texts) > 20000:
            raise ValueError("Split requests into batches of at most 20000 characters")
        return self


def create_app(engine_factory=ArgosEngine):
    lock = Lock()

    @asynccontextmanager
    async def lifespan(app):
        # Fail startup clearly if models were not installed; no cloud fallback.
        app.state.engine = engine_factory()
        yield

    app = FastAPI(title="Daejo local Argos translation", lifespan=lifespan)

    @app.get("/health")
    def health():
        return {"status": "ready", "engine": "argos", "routes": ["ko->en", "ko->en->vi", "en->vi"]}

    @app.post("/translate")
    def translate(request: TranslationRequest):
        # Single CPU worker. Avoid unbounded request queues and model races.
        if not lock.acquire(blocking=False):
            raise HTTPException(503, "Translator busy; retry later")
        try:
            results = []
            for text in request.texts:
                if text in request.nameTexts and request.source == "ko":
                    translated = translate_shop_name(text, request.targets)
                else:
                    translated = app.state.engine.translate(text, request.source, request.targets)
                results.append({"sourceText": text, "translations": translated})
            return {"results": results}
        except Exception:
            log.exception("Local translation failed")
            raise HTTPException(503, "Local translation failed; check server logs") from None
        finally:
            lock.release()

    return app


app = create_app()
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.environ.get("ARGOS_HOST", "127.0.0.1"), port=int(os.environ.get("ARGOS_PORT", "17834")))
