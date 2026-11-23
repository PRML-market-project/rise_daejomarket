/** The stop command always targets this kiosk PC, even if the data API uses a tunnel. */
export async function shutdownKiosk(): Promise<void> {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname) || !["5173", "3000"].includes(window.location.port)) {
    throw new Error("종료는 키오스크 PC의 로컬 어드민에서만 가능합니다.");
  }
  const response = await fetch("http://127.0.0.1:8080/api/kiosk-control/shutdown", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Kiosk-Control": "admin-header" },
    body: "{}",
    signal: AbortSignal.timeout(12000),
  });
  if (response.status !== 202) {
    if (response.status === 404) {
      throw new Error("실행 중인 백엔드에 종료 기능이 반영되지 않았습니다. end.cmd로 종료한 뒤 start.cmd를 실행해주세요.");
    }
    const payload = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(payload?.message || "종료 요청을 처리하지 못했습니다. 다시 시도하거나 end.cmd를 실행해주세요.");
  }
}
