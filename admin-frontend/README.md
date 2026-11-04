# 별도 관리자 앱

Next.js 관리자 앱입니다. 실제 UI는 `../frontend/src/features/admin`과 공용 지도 컴포넌트를 직접 사용합니다. 소스 복사/지도 동기화 스크립트는 사용하지 않습니다.

이 폴더에서 `npm.cmd ci`, `npm.cmd run dev -- --port 3000`, `npm.cmd run build`를 실행합니다. 백엔드 주소는 `NEXT_PUBLIC_API_URL`로 설정합니다. 통합 실행은 루트의 `npm.cmd run dev:local`을 사용합니다.

공용 UI와 `frontend` 의존성이 함께 존재하는 저장소 루트를 기준으로 빌드합니다. 별도 도메인에서 제공하는 `public` 자산은 이 앱의 실행에 필요하므로 유지합니다.
