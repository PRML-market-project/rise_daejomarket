"use client";

import { useRef } from "react";

export default function AdminLogo() {
  const taps = useRef({ count: 0, lastAt: 0 });
  const returnToKiosk = () => {
    const now = Date.now();
    taps.current.count = now - taps.current.lastAt <= 1500 ? taps.current.count + 1 : 1;
    taps.current.lastAt = now;
    if (taps.current.count === 5) {
      taps.current.count = 0;
      window.location.assign("/");
    }
  };

  return <button type="button" onClick={returnToKiosk} aria-label="대조시장" className="shrink-0 touch-manipulation">
    <img src="/figma/daecho-logo.svg" alt="" className="block h-[44px] w-[142px]" />
  </button>;
}
