# rise_daejomarket

Integrated launcher and setup guide for the kiosk frontend, admin frontend, backend, and AI server.

## Project Structure

- `backend`: Spring Boot API server
- `ai-server`: Flask AI server (`ai-server/code/app.py`)
- `frontend/ml-test-main`: Vite kiosk frontend
- `admin-frontend`: Next.js admin frontend
- `run-all.ps1`: local mode launcher
- `run-server.ps1`: Vercel test mode launcher with Cloudflare tunnels

## Requirements

- Windows PowerShell
- Node.js / npm
- Java 20
- Python virtual environment at `ai-server/.venv`
- `cloudflared` installed and available on PATH for Vercel test mode

## Install Dependencies

Run these from the repository root if dependencies are missing.

```powershell
npm.cmd install
cd frontend\ml-test-main
npm.cmd install
cd ..\..\admin-frontend
npm.cmd install
cd ..\ai-server
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..\backend
.\gradlew.bat dependencies --configuration runtimeClasspath
```

## Local Development

Use this when everything runs locally.

```powershell
npm.cmd run dev
```

Same command:

```powershell
npm.cmd run dev:local
```

`dev:local` keeps one visible PowerShell window. It starts the native Windows Ink
recognizer behind the backend API and the local llama.cpp model behind the AI
server in hidden child processes; their output is saved in `.local-service-logs/`.
Keep the launcher window open, and press Ctrl+C there to stop the services it started.

The local endpoints are:

- backend: http://localhost:8080
- ai-server: http://localhost:8000
- handwriting-server: http://localhost:17832
- frontend: http://localhost:5173
- admin-frontend: http://localhost:3000
- admin included in the kiosk app: http://localhost:5173/dashboard

The kiosk's top-left logo opens the admin page in a new tab after 10 consecutive
clicks (no more than 1.5 seconds between clicks). Admin authentication still applies.
The kiosk build includes `/login` and `/dashboard`, so the Vercel deployment
serves the admin UI on the same domain without a separate admin deployment.
Both use the kiosk's `VITE_API_URL` backend. Login is required; localhost alone
allows demo login without backend authentication. The existing standalone Next.js admin app
reuses the same admin components.

On backend startup, a missing `daejo_admin` account is created with password
`2580` (stored as a BCrypt hash). This lets the deployed admin UI use the same
credentials through the real backend `/login` endpoint. Deploy/restart the
backend with these changes; a Vercel frontend redeploy alone does not create
the account. No additional Vercel credential variables are needed.
The backend variables `KIOSK_ADMIN_USERNAME` and `KIOSK_ADMIN_PASSWORD` override
the credentials for initial creation, and `KIOSK_ADMIN_BOOTSTRAP_ENABLED=false`
disables creation. Existing accounts and their passwords are preserved.

Deploy with the Vercel Root Directory set to `frontend/ml-test-main` (or
`frontend`, which has a wrapper build configuration). After pulling these
changes, redeploy the frontend. Leave `VITE_ADMIN_URL` unset to open the bundled
admin UI. Set it only when deliberately using a separately deployed admin site.

For local frontend development, set `frontend/ml-test-main/.env` like this:

```env
VITE_API_URL=http://localhost:8080
VITE_GPT_API_URL=http://localhost:8000
```

## Vercel Test Mode

Use this when the Vercel-deployed frontend needs to call your local backend and AI server.

```powershell
npm.cmd run dev:server
```

This opens 5 visible PowerShell windows:

- backend
- ai-server
- handwriting-server
- frontend
- admin-frontend

It also starts hidden Cloudflare tunnel processes for:

- backend: http://localhost:8080
- ai-server: http://localhost:8000

After running, the main PowerShell window prints values like:

```env
VITE_API_URL=https://xxxxx.trycloudflare.com
VITE_GPT_API_URL=https://yyyyy.trycloudflare.com
```

Put those exact values into the Vercel project environment variables for the kiosk frontend.

## Vercel Environment Variables

In Vercel, configure:

```env
VITE_API_URL=<backend Cloudflare URL>
VITE_GPT_API_URL=<ai-server Cloudflare URL>
```

Example:

```env
VITE_API_URL=https://abc.trycloudflare.com
VITE_GPT_API_URL=https://def.trycloudflare.com
```

After changing Vercel environment variables, redeploy the Vercel project.
Handwriting search uses `VITE_API_URL` too: the backend forwards `/api/handwriting/recognize`
to the Windows handwriting server at `http://127.0.0.1:17832`. No separate
handwriting tunnel or Vercel variable is needed. If the backend and recognizer
run on different machines, set `HANDWRITING_SERVICE_URL` on the backend.

## AI Server Environment Variables

The AI server reads environment variables from `ai-server/.env`.

Required:

```env
OPENAI_API_KEY=<your OpenAI API key>
```

Do not commit `.env` files. They are ignored by Git.

## npm Scripts

From the repository root:

```powershell
npm.cmd run dev
```

Runs local mode (`run-all.ps1`).

```powershell
npm.cmd run dev:local
```

Runs local mode (`run-all.ps1`).

```powershell
npm.cmd run dev:server
```

Runs Vercel test mode (`run-server.ps1`).

## Stopping Services

Each service is attached to its own PowerShell window.

To stop local mode, press Ctrl+C in the launcher window; it stops the services it started.

To stop Vercel test mode, close the 5 visible windows. Hidden Cloudflare tunnel processes usually exit with the script session, but if ports or tunnel logs remain busy, close old PowerShell/cloudflared processes before running again.

## Notes

- `frontend/ml-test-main/vite.config.ts` allows `.trycloudflare.com` hosts so the frontend can be opened through Cloudflare when needed.
- Cloudflare tunnel URLs change every time `npm.cmd run dev:server` is run.
- `.cloudflared-logs/` is ignored by Git.
- `ai-server/.venv/`, `.env`, logs, and generated pickle files are ignored by Git.
