"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const MIN_ASPECT = 1422 / 1920;
const MAX_ASPECT = 16 / 9;
const MIN_WIDTH = 1422;
const MIN_HEIGHT = 1080;
type Frame = { width: number; height: number; scale: number };

/** Preserve the responsive admin layout between the portrait minimum and 16:9. */
export default function AdminViewport({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const fit = () => {
      const { clientWidth: width, clientHeight: height } = element;
      if (width <= 0 || height <= 0) return;
      const aspect = Math.max(MIN_ASPECT, Math.min(MAX_ASPECT, width / height));
      const fittedWidth = Math.min(width, height * aspect);
      const fittedHeight = fittedWidth / aspect;
      // Keep the original desktop sizing when there is room. Smaller displays
      // receive the same layout scaled down, with no changes to its columns.
      const scale = Math.min(1, fittedWidth / MIN_WIDTH, fittedHeight / MIN_HEIGHT);
      setFrame({ width: fittedWidth / scale, height: fittedHeight / scale, scale });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const canvasStyle = {
    "--admin-viewport-height": `${frame?.height ?? 1920}px`,
    position: "absolute",
    left: "50%",
    top: "50%",
    width: frame?.width ?? MIN_WIDTH,
    height: frame?.height ?? 1920,
    transform: `translate(-50%, -50%) scale(${frame?.scale ?? 1})`,
    transformOrigin: "center",
    visibility: frame === null ? "hidden" : "visible",
    overflow: "hidden",
    background: "#f8fbf8",
  } satisfies CSSProperties & { "--admin-viewport-height": string };

  return <div ref={viewport} data-admin-viewport style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#e8ece9" }}>
    <div data-admin-canvas style={canvasStyle}>{children}</div>
  </div>;
}
