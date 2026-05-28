# rise_daejomarket

## Run local services

From the repository root:

```powershell
npm.cmd run dev
```

or:

```powershell
powershell -ExecutionPolicy Bypass -File .\run-all.ps1
```

This starts:

- backend: http://localhost:8080
- ai-server: http://localhost:8000
- frontend: http://localhost:5173
- admin-frontend: http://localhost:3000

## Run server mode

From the repository root:

```powershell
npm.cmd run dev:server
```

This starts:

- backend: http://localhost:8080
- ai-server: http://localhost:8000
- frontend: http://localhost:5173
- admin-frontend: http://localhost:3000

It opens 4 windows and starts Cloudflare tunnels for backend and ai-server.

Use the printed values in Vercel:

- backend: `VITE_API_URL`
- ai-server: `VITE_GPT_API_URL`


npm.cmd run dev -> 로컬 개발용 4개만 실행
npm.cmd run dev:server -> Vercel 연결용 서버 모드로 실행
