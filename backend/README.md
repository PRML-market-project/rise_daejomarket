
# Vietnamese translation

Menu, category, and store names are translated from Korean to Vietnamese when
they are created or renamed. Configure Azure Translator only on the backend:

```powershell
$env:AZURE_TRANSLATOR_KEY="<key>"
$env:AZURE_TRANSLATOR_REGION="koreacentral"
```

`AZURE_TRANSLATOR_ENDPOINT` is optional and defaults to
`https://api.cognitive.microsofttranslator.com`.

Development uses `spring.jpa.hibernate.ddl-auto=update`, so the nullable
Vietnamese columns are created when the backend starts. For an environment
where automatic schema updates are disabled, run
`src/main/resources/db/manual/add_vietnamese_translation_columns.sql` once.

After deployment, an authenticated administrator can translate existing rows:

```http
POST /api/admin/translations/vi/backfill
```

If Azure Translator is not configured or temporarily fails, normal menu
creation continues. The Vietnamese fields remain empty and the kiosk falls
back to the English name, then the Korean name.
