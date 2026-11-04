import { useEffect, useRef, useState } from "react";

/** Keep the still visible until playback actually starts, including stalled loads. */
export function DesignMotion({ name, className = "", loop = true, onEnded }: {
  name: string; className?: string; loop?: boolean; onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackTimer = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (reducedMotion || failed) return;
    const video = videoRef.current;
    video?.play().catch((error: DOMException) => {
      if (error.name !== "AbortError") setFailed(true);
    });
  }, [failed, reducedMotion]);
  useEffect(() => () => {
    if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
  }, []);
  const showVideo = () => {
    if (fallbackTimer.current !== null) window.clearTimeout(fallbackTimer.current);
    fallbackTimer.current = null;
    setPlaying(true);
  };
  const waitForVideo = () => {
    // Native looping briefly seeks to frame zero. Don't flash an unrelated poster.
    if (fallbackTimer.current !== null) return;
    fallbackTimer.current = window.setTimeout(() => {
      fallbackTimer.current = null;
      setPlaying(false);
    }, 1500);
  };
  return <span aria-hidden="true" className={`pointer-events-none block ${className}`}>
    <img src={`/design-assets/${name}.png`} alt="" className={`absolute inset-0 h-full w-full object-contain ${playing && !failed && !reducedMotion ? "opacity-0" : "opacity-100"}`} />
    {!failed && !reducedMotion && <video ref={videoRef} src={`/design-assets/${name}.${name === "welcome" ? "mp4" : "webm"}`}
      autoPlay muted playsInline loop={loop} preload="auto"
      className={`absolute inset-0 h-full w-full object-contain ${playing ? "opacity-100" : "opacity-0"}`}
      onPlaying={showVideo} onWaiting={waitForVideo}
      onStalled={waitForVideo} onError={() => setFailed(true)} onEnded={onEnded} />}
  </span>;
}

export function VoiceMotionButton({ active, onStart, label }: { active: boolean; onStart: () => void; label: string }) {
  const [clicked, setClicked] = useState(false);
  useEffect(() => {
    if (!clicked) return;
    const timer = window.setTimeout(() => setClicked(false), 3000);
    return () => window.clearTimeout(timer);
  }, [clicked]);
  const name = clicked ? "voice-click" : active ? "voice-active" : "voice-default";
  return <button type="button" aria-label={label} disabled={active}
    onClick={() => { setClicked(true); onStart(); }}
    className="relative flex h-[320px] w-[320px] shrink-0 items-center justify-center rounded-full"
    style={{ background: active ? "#00af55" : "#168259",
      boxShadow: active ? "0 0 80px rgba(0, 190, 95, 0.4)" : undefined }}>
    <img src="/figma/mic.svg" alt="" style={{ width: 84, height: 84, position: "relative", zIndex: 1, pointerEvents: "none" }} />
    <div aria-hidden="true" style={{ position: "absolute", left: -110, top: -110,
      width: 540, height: 540, pointerEvents: "none", clipPath: "circle(160px at 270px 270px)" }}>
      <CompatibleMotion key={name} name={name} loop={!clicked} onEnded={() => setClicked(false)} />
    </div>
  </button>;
}

/** H.264 motion for input screens, independent of transparent-video support. */
export function CompatibleMotion({ name, loop = true, loopDelayMs = 0, onEnded }: {
  name: string; loop?: boolean; loopDelayMs?: number; onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const waitingToReplay = useRef(false);
  const replayTimer = useRef<number | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const play = () => {
    const video = videoRef.current;
    if (!video || waitingToReplay.current) return;
    video.muted = true;
    void video.play().catch((error: DOMException) => {
      // A load/replay interrupt isn't a decoder failure. Keep the video for canplay.
      if (error.name !== "AbortError") setVisible(false);
    });
  };
  useEffect(() => {
    play();
    return () => {
      if (replayTimer.current !== null) window.clearTimeout(replayTimer.current);
    };
  }, []);
  const handleEnded = () => {
    onEnded?.();
    if (!loop || loopDelayMs <= 0) return;
    const video = videoRef.current;
    if (!video) return;
    waitingToReplay.current = true;
    video.pause();
    video.currentTime = 0;
    // Keep the first video frame visible instead of showing the mid-animation poster.
    setVisible(true);
    replayTimer.current = window.setTimeout(() => {
      replayTimer.current = null;
      waitingToReplay.current = false;
      play();
    }, loopDelayMs);
  };
  const fill: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" };
  return <>
    <img src={`/design-assets/${name}.png`} alt="" aria-hidden="true" style={{ ...fill, opacity: visible && !failed ? 0 : 1 }} />
    {!failed && <video ref={videoRef} src={`/design-assets/${name}.mp4?v=2`} poster={`/design-assets/${name}.png`}
      autoPlay muted playsInline loop={loop && loopDelayMs <= 0} preload="auto" aria-hidden="true"
      style={{ ...fill, opacity: visible ? 1 : 0 }} onCanPlay={play}
      onPlaying={() => setVisible(true)} onWaiting={() => { if (!waitingToReplay.current) setVisible(false); }}
      onError={() => { setVisible(false); setFailed(true); }} onEnded={handleEnded} />}
  </>;
}
