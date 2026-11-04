# 대조시장 키오스크

이 폴더가 Vite 앱 루트입니다. `src/features/kiosk`는 사용자 화면, `src/features/admin`은 키오스크와 별도 관리자 앱에서 함께 사용하는 UI입니다. 지도 가게의 원본은 `src/data/figma-map-shops.ts`입니다.

루트에서 `npm.cmd run dev:local` 또는 이 폴더에서 `npm.cmd run dev`로 실행합니다. 빌드는 `npm.cmd run build`, 환경변수는 `VITE_API_URL`, `VITE_GPT_API_URL`입니다. Vercel Root Directory도 `frontend`로 설정합니다.

동작 점검용 스크립트는 `scripts/test-*.mjs`에 있습니다.
