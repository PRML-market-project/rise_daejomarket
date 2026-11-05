# Local Argos translation

All application translation calls use the local Argos server. No cloud translator
key or metered translation API is used.

## Start the translator first

See [setup and launch instructions](../ai-server/argos-translate-server/README.md).
Default endpoint: `http://127.0.0.1:17834`. Keep it on loopback or a private network.

Backend environment variables:

- `ARGOS_TRANSLATOR_URL`: local/private server URL (default above).
- `ARGOS_TRANSLATOR_ENABLED`: default `true`.
- `ARGOS_TRANSLATOR_TIMEOUT_SECONDS`: default `120`, for CPU inference.
- `ARGOS_KIOSK_BACKFILL_ON_STARTUP`: default `true`; fills missing kiosk translations.

Restart the backend after changing these settings. Start the translator before
the backend, or save content again to retry any missing translations.

## Stored translations

Shop descriptions, keywords, tags and search-tag names are translated into English
and Vietnamese on admin save. Vietnamese uses Korean → English → Vietnamese.
Shop names use automatic romanization with the Korean name retained, because the
available Korean model can mistranslate short proper nouns. This is not an
official English business name. Known category labels use a small reviewed glossary.

Translations are saved in `kiosk_experience.translations_json`, keyed by Korean
source text. Unchanged translations are reused. Existing stored translations are
preserved when switching provider; failed requests never replace them with blanks.
A changed source uses a new lookup key. The initial map's 144 source strings have
a bundled snapshot in `src/main/resources/translations/kiosk-seed.json`.
Shop-name classification is in `kiosk-shop-names.json`; update these catalogs when
the static map changes. Newly edited shops are classified automatically.

`GET /api/kiosk-experience` returns `translations` and `pendingTranslations`.
If the local service is unavailable, Korean saves still succeed and pending
translations are retried on the next save/startup. The admin editor shows this.
Static UI translations need no translation server. Text embedded in uploaded
images/videos is not translated.

Development uses Hibernate `ddl-auto=update`. Otherwise run the one-time SQL in
`src/main/resources/db/manual/add_kiosk_translation_cache.sql`.

## Verification

```powershell
.\gradlew.bat -I translation-test.init.gradle test --tests '*ArgosTranslatorServiceTest' --tests '*KioskTranslationServiceTest'
```

The init script uses an ASCII temporary build path to avoid Windows Java
classloader problems with Korean checkout paths. Frontend checks:
`node scripts/test-kiosk-i18n.mjs`, `node scripts/test-category-chips.mjs`,
and `npm run build`.

Translation seed files live under `src/main/resources/translations`.
The backend retries missing translations through the local Argos service.
