/** Lets the local Windows shutdown script identify kiosk tabs in a shared Chrome window. */
export const KIOSK_BROWSER_MARKER = "[DAEJO:5173]";

export function kioskBrowserTitle(title: string, location: Pick<Location, "hostname" | "port"> = window.location): string {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname) && location.port === "5173";
  return local && !title.startsWith(`${KIOSK_BROWSER_MARKER} `) ? `${KIOSK_BROWSER_MARKER} ${title}` : title;
}
