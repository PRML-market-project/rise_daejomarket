import { KioskLocaleContext, createTranslator, useKioskLocale } from "./i18n";
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getSearchTagIcon } from "@/data/search-tag-icons";
import { getRouteDirectionForShop, getRouteDistanceForShop, MapView } from "@/components/market/MapView";
import { figmaMapShops as marketShops } from "@/data/figma-map-shops";
import {
  DirectionsPanel,
  FloatingSearchBar,
  LanguageSelectionScreen,
  MarketMapPanel,
  ResultsPanel,
  SearchStatusScreen,
} from "./KioskResultScreens";
import { fetchKioskExperience, KioskExperience, KioskPromotionPlayer, subscribeToKioskExperience } from "./KioskPromotionPlayer";
import { searchKioskWithAi } from "./kioskAiSearch";
import { recordKioskEvent } from "./kioskAnalytics";
import { KIOSK_BOTTOM_INSET, KIOSK_PANEL_HEIGHT, KIOSK_TOUCH_KEYBOARD_HEIGHT } from "./kioskLayout";
import { useKioskSpeech } from "./useKioskSpeech";
import { appendHangulKey, deleteLastKeyboardCharacter } from "./hangulKeyboard";
import { CompatibleMotion, DesignMotion, VoiceMotionButton } from "./DesignMotion";
import { getSearchResultPage, getSearchResultPresentation, shuffleSearchMatches, type ResultSortMode } from "./searchResultPresentation";
import { RecognitionConfirmation } from "./RecognitionConfirmation";
import { useRecognitionCountdown } from "./useRecognitionCountdown";

type InputMode = "keyboard" | "handwriting" | "voice";
type VoiceState = "idle" | "listening" | "recognizing" | "confirmed" | "error";
type Screen = "welcome" | "search" | "processing" | "results" | "directions" | "map" | "no-results" | "answer" | "error" | "language";
type Language = "ko" | "en" | "vi";

const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;
const INACTIVITY_TIMEOUT_MS = 30_000;
// Auto operation mode: idle time on the welcome screen before the promotion playlist starts.
const AUTO_PROMOTION_IDLE_MS = 60_000;
const VOICE_SILENCE_TIMEOUT_MS = 2_000;
const GREEN = "linear-gradient(105deg, #289064 0%, #116543 82%)";

type KeyboardLayout = "ko" | "en" | "number";

const keyboardLayouts: Record<KeyboardLayout, string[][]> = {
  ko: [
    ["ㅂ", "ㅈ", "ㄷ", "ㄱ", "ㅅ", "ㅛ", "ㅕ", "ㅑ", "ㅐ", "ㅔ"],
    ["ㅁ", "ㄴ", "ㅇ", "ㄹ", "ㅎ", "ㅗ", "ㅓ", "ㅏ", "ㅣ"],
    ["ㅋ", "ㅌ", "ㅊ", "ㅍ", "ㅠ", "ㅜ", "ㅡ"],
  ],
  en: [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["z", "x", "c", "v", "b", "n", "m"],
  ],
  number: [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
    ["-", "/", ";", ":", "(", ")", "₩", "&", "@"],
    [".", ",", "?", "!", "'", "\"", "#"],
  ],
};

const shiftedKeyboardLayouts: Record<KeyboardLayout, string[][]> = {
  ko: [
    ["ㅃ", "ㅉ", "ㄸ", "ㄱ", "ㅆ", "ㅛ", "ㅕ", "ㅑ", "ㅒ", "ㅖ"],
    keyboardLayouts.ko[1],
    keyboardLayouts.ko[2],
  ],
  en: keyboardLayouts.en.map((row) => row.map((key) => key.toUpperCase())),
  number: [
    ["[", "]", "{", "}", "#", "%", "^", "*", "+", "="],
    ["_", "\\", "|", "~", "<", ">", "€", "£", "¥"],
    ["…", "`", "•", "§", "±", "÷", "×"],
  ],
};

const languageLabels = { ko: "한국어", en: "English", vi: "Tiếng Việt" } as const;

function Header({ language, onMap, onLanguage }: { language: Language; onMap: () => void; onLanguage: () => void }) {
  const { t } = useKioskLocale();
  const logoTaps = useRef({ count: 0, startedAt: 0 });
  const openAdminAfterFiveTaps = () => {
    const now = Date.now();
    if (logoTaps.current.count === 0 || now - logoTaps.current.startedAt > 1000) {
      logoTaps.current = { count: 1, startedAt: now };
    } else {
      logoTaps.current.count += 1;
    }
    if (logoTaps.current.count === 5) {
      logoTaps.current.count = 0;
      window.open(import.meta.env.VITE_ADMIN_URL?.trim() || `${window.location.origin}/dashboard`, "_blank", "noopener,noreferrer");
    }
  };
  return (
    <header className="flex h-[120px] shrink-0 items-center justify-between border-b-2 border-[#ebebeb] px-[52px]">
      <button type="button" onClick={openAdminAfterFiveTaps} aria-label={t("대조시장")} className="shrink-0 touch-manipulation"><img src="/figma/daecho-logo.svg" alt="" className="block h-[44px] w-[142px]" /></button>
      <div className="flex gap-[16px]">
        <button
          type="button"
          onClick={onMap}
          className="flex h-[68px] items-center gap-[8px] rounded-full bg-[#ebebeb] px-[32px] text-[24px] font-medium text-[#19211c]"
        >
          <img src="/figma/map.svg" alt="" className="h-[28px] w-[28px]" />{t("시장지도")}</button>
        <button
          type="button"
          onClick={onLanguage}
          className="flex h-[68px] items-center gap-[8px] rounded-full bg-[#ebebeb] px-[32px] text-[24px] font-medium text-[#19211c]"
        >
          <img src="/figma/globe.svg" alt="" className="h-[26px] w-[26px]" />
          {languageLabels[language]}
        </button>
      </div>
    </header>
  );
}

/**
 * Figma's 24px × 1px white logo divider. The kiosk canvas is scaled to the window, so a 1 CSS px line
 * becomes a sub-pixel line whose blur depends on where it lands; two dividers then look different.
 * Keep it at least one device pixel wide and shift it onto a device-pixel boundary so every divider
 * renders identically.
 */
function LogoDivider({ scale }: { scale: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const snap = () => {
      element.style.transform = "";
      const left = element.getBoundingClientRect().left * dpr;
      element.style.transform = `translateX(${(Math.round(left) - left) / dpr / scale}px)`;
    };
    snap();
    let active = true;
    // Text widths before the divider change once the web font finishes loading.
    void document.fonts?.ready.then(() => { if (active) snap(); });
    return () => { active = false; };
  });
  return <span ref={ref} className="block h-[24px] shrink-0 bg-white" style={{ width: Math.max(1, 1 / (scale * dpr)) }} />;
}

function PrimaryButton({
  children,
  disabled = false,
  onClick,
  className = "",
  typography = "text-[40px] font-normal leading-[52px]",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  /** Font size/weight/line-height. Kept separate so it replaces (not competes with) the default. */
  typography?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[120px] min-h-[112px] items-center justify-center rounded-full px-[24px] ${typography} transition active:scale-[0.99] disabled:bg-[#ebebeb] disabled:text-[#a1a1a1] ${className}`}
      style={!disabled ? { backgroundImage: GREEN, color: "white" } : undefined}
    >
      {children}
    </button>
  );
}

function MethodTabs({ mode, onChange }: { mode: InputMode; onChange: (mode: InputMode) => void }) {
  const { t } = useKioskLocale();
  const tabs: Array<[InputMode, string]> = [
    ["voice", "음성 검색"],
    ["handwriting", "손글씨 검색"],
    ["keyboard", "키보드 검색"],
  ];

  return (
    <div className="flex h-[128px] w-full shrink-0 items-start justify-between rounded-[101px] bg-[#ebebeb] p-[12px]">
      {tabs.map(([value, label]) => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
          className={`flex h-[104px] w-[310px] shrink-0 items-center justify-center gap-[16px] whitespace-nowrap rounded-full p-[32px] text-[36px] font-medium leading-[48px] ${
            mode === value ? "text-white" : "text-[#a1a1a1]"
          }`}
          style={{
            backgroundColor: "white",
            backgroundImage: mode === value ? "linear-gradient(98.238deg, #289064 0%, #116543 71.65%)" : undefined,
            boxShadow: "5px 5px 8px rgba(0,0,0,0.15), inset 0 -4px 8px rgba(0,0,0,0.25)",
          }}
        >
          <img src={`/figma/search-methods/${value}.svg`} alt="" className="shrink-0"
            style={{ filter: mode === value ? "brightness(0) invert(1)" : "brightness(0) invert(0.631373)" }} />
          {t(label)}
        </button>
      ))}
    </div>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useKioskLocale();
  return (
    <label className="flex h-[120px] w-full items-center gap-[16px] rounded-full bg-[#ebebeb] px-[48px]">
      <img src="/figma/search.svg" alt="" className="h-[40px] w-[40px]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="search"
        autoComplete="off"
        autoCorrect="off"
        placeholder={t("검색어를 입력하세요")}
        className="min-w-0 flex-1 bg-transparent text-[40px] leading-[52px] text-[#19211c] outline-none placeholder:text-[#a1a1a1]"
      />
    </label>
  );
}

function CategoryChips({ onChoose, configuredTags }: { onChoose: (tag: { name: string; keywords: string }) => void; configuredTags?: KioskExperience["searchTags"] }) {
  const { t } = useKioskLocale();
  const defaults = [
    { id: 1, name: "주변식당", icon: "식당", keywords: "식당", visible: true },
    { id: 2, name: "반찬가게", icon: "식품", keywords: "식품", visible: true },
    { id: 3, name: "간식가게", icon: "간식", keywords: "식품", visible: true },
  ];
  // The API initializes searchTags to []; show the design defaults until tags
  // are configured. Filter afterwards so explicitly hidden tags stay hidden.
  const chips = (configuredTags?.length ? configuredTags : defaults).filter((tag) => tag.visible).slice(0, 3).map((tag) => {
    const design = getSearchTagIcon(tag.icon);
    const uploaded = "iconUrl" in tag ? tag.iconUrl as string | undefined : undefined;
    const icon = uploaded ? (/^https?:\/\//.test(uploaded) ? uploaded : `${(import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "")}${uploaded}`) : `/search-icons/${design.asset}.svg`;
    return { ...tag, src: icon, color: design.color, size: uploaded ? 28 : design.size };
  });
  return (
    <div className="flex gap-[8px]">
      {chips.map(({ id, name: label, src: icon, color, keywords, size }) => (
        <button
          type="button"
          key={id}
          onClick={() => onChoose({ name: label, keywords: keywords || label })}
          className="flex h-[72px] items-center gap-[12px] rounded-full border-2 border-[#ebebeb] px-[32px] text-[36px] leading-[40px] text-[#19211c]"
        >
          <span className="flex h-[40px] w-[40px] items-center justify-center rounded-full" style={{ backgroundColor: color }}>
            <img src={icon} alt="" style={{ width: size, height: size }} />
          </span>
          {t(label)}
        </button>
      ))}
    </div>
  );
}

function TouchKeyboard({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => void }) {
  const { t, language } = useKioskLocale();
  const [layout, setLayout] = useState<KeyboardLayout>(language === "ko" ? "ko" : "en");
  const [alphaLayout, setAlphaLayout] = useState<Exclude<KeyboardLayout, "number">>(language === "ko" ? "ko" : "en");
  const [shifted, setShifted] = useState(false);
  const keyClass = "flex h-[104px] shrink-0 items-center justify-center whitespace-nowrap rounded-[12px] bg-[#f8fbf8] text-[36px] font-medium leading-[48px] text-[#19211c] shadow-[0_2px_0_rgba(0,0,0,.12)] active:translate-y-[2px] active:shadow-none";
  const rows = (shifted ? shiftedKeyboardLayouts : keyboardLayouts)[layout];
  const append = (key: string) => onChange(layout === "ko" ? appendHangulKey(value, key) : value + key);
  const addVietnameseTone = (tone: string) => {
    const letters = Array.from(value);
    const last = letters.pop();
    if (!last || !/[aeiouyăâêôơư]/i.test(last.normalize("NFD")[0])) return;
    const base = last.normalize("NFD").replace(/[\u0300\u0301\u0303\u0309\u0323]/g, "");
    onChange(letters.join("") + (base + tone).normalize("NFC"));
  };
  const toggleLanguage = () => {
    const nextLayout = alphaLayout === "ko" ? "en" : "ko";
    setAlphaLayout(nextLayout);
    setLayout(nextLayout);
    setShifted(false);
  };
  const toggleNumbers = () => {
    setLayout((current) => current === "number" ? alphaLayout : "number");
    setShifted(false);
  };

  const shiftLabel = layout === "ko" ? "쌍자음" : layout === "en" ? "Shift" : "기호";

  return (
    <div className="flex w-full shrink-0 flex-col gap-[12px] rounded-[24px] bg-[#ebebeb] px-[24px] py-[48px]" style={{ height: KIOSK_TOUCH_KEYBOARD_HEIGHT, ...(language === "vi" ? { paddingTop: 20, paddingBottom: 20 } : {}) }}>
      {language === "vi" && <div className="flex h-[44px] shrink-0 justify-center gap-2">
        {["ă", "â", "ê", "ô", "ơ", "ư", "đ"].map(letter => <button type="button" key={letter} onClick={() => append(shifted ? letter.toUpperCase() : letter)} className="w-[64px] rounded-lg bg-[#f8fbf8] text-[28px]">{letter}</button>)}
        {[["á", "\u0301"], ["à", "\u0300"], ["ả", "\u0309"], ["ã", "\u0303"], ["ạ", "\u0323"], ["a", ""]].map(([label, tone]) => <button type="button" key={label} aria-label={`Dấu ${label}`} onClick={() => addVietnameseTone(tone)} className="w-[52px] rounded-lg bg-[#d8e8df] text-[28px]">{label}</button>)}
      </div>}
      {rows.slice(0, 2).map((row, index) => (
        <div key={index} className="flex justify-center gap-[8px]">
          {row.map((key) => <button type="button" key={key} onClick={() => append(key)} className={`${keyClass} w-[86.4px]`}>{key}</button>)}
        </div>
      ))}
      <div className="flex justify-center gap-[8px]">
        <button type="button" aria-pressed={shifted} onClick={() => setShifted((current) => !current)} className={`${keyClass} w-[133.6px] gap-[8px] text-[24px] leading-[36px] ${shifted ? "bg-[#d8e8df] text-[#116543]" : ""}`}><span className="text-[24px]">⇧</span><span>{t(shiftLabel)}</span></button>
        {rows[2].map((key) => <button type="button" key={key} onClick={() => append(key)} className={`${keyClass} w-[86.4px]`}>{key}</button>)}
        <button type="button" onClick={() => onChange(deleteLastKeyboardCharacter(value))} className={`${keyClass} w-[133.6px] gap-[8px] text-[24px] leading-[36px]`}><span className="text-[24px]">⌫</span><span>{t("삭제")}</span></button>
      </div>
      <div className="flex justify-center gap-[8px]">
        <button type="button" aria-pressed={layout === "number"} onClick={toggleNumbers} className={`${keyClass} w-[124px] text-[24px] leading-[36px]`}>{layout === "number" ? (alphaLayout === "ko" ? "가나다" : "ABC") : "123"}</button>
        <button type="button" onClick={toggleLanguage} className={`${keyClass} w-[124px] text-[24px] leading-[36px]`}>{t("한/영")}</button>
        <button type="button" onClick={() => append(" ")} className={`${keyClass} w-[456px] text-[24px] leading-[36px]`}>{t("띄어쓰기")}</button>
        <button type="button" onClick={onSubmit} className="h-[104px] w-[208px] shrink-0 whitespace-nowrap rounded-[12px] bg-[#363636] text-[28px] font-bold leading-[40px] text-white shadow-[0_2px_0_rgba(0,0,0,.12)]">{t("확인")}</button>
      </div>
    </div>
  );
}

type InkPoint = { x: number; y: number; t: number; pressure: number };
type InkStroke = { points: InkPoint[] };
type RecognitionResponse = { candidates?: string[]; detail?: string; error?: string };

const HANDWRITING_API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "");
const HANDWRITING_IDLE_MS = 1500;
const HANDWRITING_WIDTH = 984;
const HANDWRITING_HEIGHT = 808;

function HandwritingPad({ language, recognizing, onRecognizingChange, onRecognized }: {
  language: Language; recognizing: boolean;
  onRecognizingChange: (recognizing: boolean) => void; onRecognized: (text: string) => void;
}) {
  const { t } = useKioskLocale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasInk, setHasInk] = useState(false);
  const strokesRef = useRef<InkStroke[]>([]);
  const activeStrokeRef = useRef<InkStroke | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const strokeStartedAtRef = useRef(0);
  const recognitionTimerRef = useRef<number | null>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  const configureContext = useCallback(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return null;
    context.lineWidth = 18;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#116543";
    return context;
  }, []);

  const redraw = useCallback(() => {
    const context = configureContext();
    if (!context) return;
    context.clearRect(0, 0, HANDWRITING_WIDTH, HANDWRITING_HEIGHT);
    const draw = (stroke: InkStroke) => {
      if (!stroke.points.length) return;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    };
    strokesRef.current.forEach(draw);
    if (activeStrokeRef.current) draw(activeStrokeRef.current);
  }, [configureContext]);

  const cancelPendingRecognition = useCallback(() => {
    if (recognitionTimerRef.current !== null) {
      window.clearTimeout(recognitionTimerRef.current);
      recognitionTimerRef.current = null;
    }
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    onRecognizingChange(false);
  }, [onRecognizingChange]);

  const recognize = useCallback(async () => {
    if (!strokesRef.current.length) return;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    onRecognizingChange(true);

    try {
      const response = await fetch(`${HANDWRITING_API_URL}/api/handwriting/recognize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strokes: strokesRef.current, language }),
        signal: controller.signal,
      });
      const result = (await response.json()) as RecognitionResponse;
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.detail ?? result.error ?? "recognition failed");
      const recognizedWord = result.candidates?.find((candidate) => candidate.trim());
      if (!recognizedWord) {
        return;
      }
      onRecognized(recognizedWord);
      strokesRef.current = [];
      activeStrokeRef.current = null;
      setHasInk(false);
      redraw();
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        onRecognizingChange(false);
      }
    }
  }, [language, onRecognized, onRecognizingChange, redraw]);

  const scheduleRecognition = useCallback(() => {
    if (recognitionTimerRef.current !== null) window.clearTimeout(recognitionTimerRef.current);
    recognitionTimerRef.current = window.setTimeout(() => {
      recognitionTimerRef.current = null;
      void recognize();
    }, HANDWRITING_IDLE_MS);
  }, [recognize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = HANDWRITING_WIDTH;
    canvas.height = HANDWRITING_HEIGHT;
    redraw();
  }, [redraw]);

  useEffect(() => () => cancelPendingRecognition(), [cancelPendingRecognition]);

  const pointFor = (event: React.PointerEvent<HTMLCanvasElement>): InkPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (HANDWRITING_WIDTH / bounds.width),
      y: (event.clientY - bounds.top) * (HANDWRITING_HEIGHT / bounds.height),
      t: performance.now() - strokeStartedAtRef.current,
      pressure: event.pressure || 0.5,
    };
  };

  const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== event.pointerId || !activeStrokeRef.current) return;
    const stroke = activeStrokeRef.current;
    if (stroke.points.length === 1) stroke.points.push({ ...stroke.points[0], x: stroke.points[0].x + 0.1 });
    strokesRef.current = [...strokesRef.current, stroke];
    activeStrokeRef.current = null;
    activePointerRef.current = null;
    redraw();
    scheduleRecognition();
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-[28px] bg-[#ebebeb]" aria-busy={recognizing}>
      {!hasInk && !recognizing && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ opacity: 0.15 }}><CompatibleMotion name="handwriting" loopDelayMs={3000} /></div>}
      {!hasInk && !recognizing && (
        <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[36px] font-medium leading-[48px] text-[#0a3825]">{t("검색할 내용을 손가락으로 적어주세요")}</p>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-20 h-full w-full touch-none"
        style={{ opacity: recognizing ? 0 : 1, pointerEvents: recognizing ? "none" : undefined }}
        aria-label={t("손글씨 입력 영역")}
        onPointerDown={(event) => {
          cancelPendingRecognition();
          event.currentTarget.setPointerCapture(event.pointerId);
          activePointerRef.current = event.pointerId;
          strokeStartedAtRef.current = performance.now();
          activeStrokeRef.current = { points: [pointFor(event)] };
          setHasInk(true);
        }}
        onPointerMove={(event) => {
          if (activePointerRef.current !== event.pointerId || !activeStrokeRef.current) return;
          const point = pointFor(event);
          const previous = activeStrokeRef.current.points.at(-1);
          if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 1) return;
          activeStrokeRef.current.points.push(point);
          redraw();
        }}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
      {recognizing && (
        <div role="status" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-[24px]">
          {/* Keep Figma's 80x16 dot baseline; the padded MOV bounces above it. */}
          <div className="relative h-[16px] w-[80px] shrink-0">
            <DesignMotion name="handwriting-loading" format="webm" className="absolute bottom-0 left-[-40px] h-[60px] w-[160px]" />
          </div>
          <p className="text-[36px] font-medium leading-[48px] text-[#0a3825]">{t("내용을 확인중이예요")}</p>
        </div>
      )}
    </div>
  );
}

function VoicePanel({ state, transcript, onStart, onRetry, onKeyboard, secondsLeft = null }: { state: VoiceState; transcript: string; onStart: () => void; onRetry: () => void; onKeyboard?: () => void; secondsLeft?: number | null }) {
  const { t } = useKioskLocale();
  if (state === "error") {
    return (
      <div className="flex flex-1 flex-col items-center text-center font-['Kiosk_Result_Noto',sans-serif]" style={{ paddingTop: 320 - 56 }}>
        <DesignMotion name="voice-error" format="webm" className="relative h-[200px] w-[200px] shrink-0" />
        <h2 className="mt-[16px] text-[64px] font-bold leading-[1.4] text-[#0a3825]">{t("제대로 듣지 못했어요")}</h2>
        <p className="mt-[16px] text-[36px] font-medium leading-[44px] text-[#0a3825]">{t("조금 더 가까이에서 천천히 말씀해주세요.")}</p>
        <PrimaryButton onClick={onRetry} className="mt-[80px] w-full">{t("다시 말하기")}</PrimaryButton>
        <button type="button" onClick={onKeyboard} className="mt-[40px] h-[120px] w-full rounded-full bg-[#ebebeb] text-[40px] leading-[52px] text-[#19211c]">{t("키보드로 검색하기")}</button>
      </div>
    );
  }

  if (state === "confirmed") {
    return <RecognitionConfirmation kind="voice" text={transcript} secondsLeft={secondsLeft} onRetry={onRetry} />;
  }

  const active = state === "listening" || state === "recognizing";
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <VoiceMotionButton active={active} onStart={onStart} label={t("음성 입력")} />
      <p className="mt-[24px] text-[36px] font-medium leading-[48px] text-[#0a3825]">
        {state === "idle" ? t("원을 터치한 뒤 말씀해주세요") : state === "listening" ? t("듣고 있어요...") : `“${transcript || t("단팥빵을 사고...")}”`}
      </p>
    </div>
  );
}

export default function KioskSearchApp() {
  const [language, setLanguage] = useState<Language>("ko");
  const [scale, setScale] = useState(1);
  const [screen, setScreen] = useState<Screen>("welcome");
  const analyticsSession = useRef<string | null>(null);
  const searchEventId = useRef("");
  const startSession = () => {
    analyticsSession.current = crypto.randomUUID();
    recordKioskEvent(analyticsSession.current, "START", language);
    setScreen("search");
  };
  const trackShopSelection = (id: string) => {
    if (id !== selectedShopId) recordKioskEvent(analyticsSession.current, "SELECT", language, "touch", [id]);
    setSelectedShopId(id);
  };
  const [mode, setMode] = useState<InputMode>("voice");
  const [query, setQuery] = useState("");
  const [handwritingRecognized, setHandwritingRecognized] = useState(false);
  const [handwritingRecognizing, setHandwritingRecognizing] = useState(false);
  const [autoSearchArmed, setAutoSearchArmed] = useState(false);
  const onHandwritingRecognized = useCallback((text: string) => {
    setQuery(text); setHandwritingRecognized(true); setAutoSearchArmed(true);
  }, []);
  const [tagSearch, setTagSearch] = useState<{ name: string; keywords: string } | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const cancelVoiceRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (screen !== "search" || mode !== "voice") cancelVoiceRef.current?.();
    return () => cancelVoiceRef.current?.();
  }, [screen, mode, language]);
  const [handwritingResetKey, setHandwritingResetKey] = useState(0);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  // Directions can be opened from search results or from the full market map.
  const [directionsOrigin, setDirectionsOrigin] = useState<"results" | "map">("results");
  const [resultSortMode, setResultSortMode] = useState<ResultSortMode>("relevance");
  const [resultPage, setResultPage] = useState(1);
  const [aiShopIds, setAiShopIds] = useState<string[]>([]);
  const [aiAnswer, setAiAnswer] = useState("");
  const [pendingLanguage, setPendingLanguage] = useState<Language>(language);
  const [languageReturnScreen, setLanguageReturnScreen] = useState<Screen>("welcome");
  const [experience, setExperience] = useState<KioskExperience | null>(null);
  const [autoPromoting, setAutoPromoting] = useState(false);
  const t = useMemo(() => createTranslator(language, experience?.translations), [language, experience?.translations]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const updateExperience = useCallback((value: KioskExperience) => {
    setExperience((current) => JSON.stringify(current) === JSON.stringify(value) ? current : value);
  }, []);

  useEffect(() => {
    let disposed = false;
    const load = () => {
      const controller = new AbortController();
      fetchKioskExperience(controller.signal).then((value) => { if (!disposed) updateExperience(value); }).catch(() => undefined);
      return controller;
    };
    let controller = load();
    const refresh = () => { controller.abort(); controller = load(); };
    const unsubscribe = subscribeToKioskExperience((value) => { if (!disposed) updateExperience(value); }, refresh);
    const quickTunnel = new URL(import.meta.env.VITE_API_URL ?? "http://localhost:8080").hostname.endsWith(".trycloudflare.com");
    const timer = window.setInterval(refresh, quickTunnel ? 5_000 : 30_000);
    return () => { disposed = true; controller.abort(); unsubscribe(); window.clearInterval(timer); };
  }, [updateExperience]);

  const effectiveShops = useMemo(() => {
    const managed = new Map((experience?.shops ?? []).map((shop) => [shop.id, shop]));
    const canonicalIds = new Set(marketShops.map((shop) => shop.id));
    const legacyByName = new Map((experience?.shops ?? [])
      .filter((shop) => !canonicalIds.has(shop.id) && marketShops.filter((candidate) => candidate.name === shop.name).length === 1)
      .map((shop) => [shop.name, shop]));
    return marketShops.map((shop) => {
      const override = managed.get(shop.id) ?? legacyByName.get(shop.name);
      return override ? { ...shop, name: override.name, searchKeywords: override.keywords, description: override.description, tags: override.tags, thumbnailUrl: override.thumbnailUrl ? (/^https?:\/\//.test(override.thumbnailUrl) ? override.thumbnailUrl : `${(import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "")}${override.thumbnailUrl}`) : undefined, icon: override.icon } : shop;
    });
  }, [experience?.shops]);

  const tagResultShops = useMemo(() => {
    const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f\s]/g, "").replace(/đ/gi, "d").toLowerCase();
    if (!tagSearch) return [];
      const terms = tagSearch.keywords.split(/[,，]/).map((term) => normalize(term.trim())).filter(Boolean);
      const categoryGroups: Record<string, string[]> = {
        정육청과수산: ["정육", "청과", "수산"],
        음식점: ["식당"], 주변식당: ["식당"], 식당찾기: ["식당"],
      };
      return shuffleSearchMatches(effectiveShops.filter((shop, index) => {
        const categories = [shop.category, marketShops[index]?.category, ...(shop.tags ?? [])].map(normalize);
        const source = [shop.name, shop.description, shop.searchKeywords, ...(shop.tags ?? [])].filter((value): value is string => Boolean(value)).map(normalize);
        return terms.some((term) => {
          const categoryTerms = categoryGroups[term] ?? [term];
          return categoryTerms.some((category) => categories.includes(category)) || source.some((text) => text.includes(term));
        });
      }));
  }, [effectiveShops, tagSearch]);

  const resultShops = useMemo(() => {
    if (tagSearch) return tagResultShops;
    const byId = new Map(effectiveShops.map((shop) => [shop.id, shop]));
    return aiShopIds.flatMap((id) => { const shop = byId.get(id); return shop ? [shop] : []; });
  }, [aiShopIds, effectiveShops, tagResultShops, tagSearch]);

  const orderedResults = useMemo(() => getSearchResultPresentation(resultShops, resultSortMode, getRouteDistanceForShop), [resultShops, resultSortMode]);
  const { currentPage: currentResultPage, visible: visibleResults } = getSearchResultPage(orderedResults, resultPage);
  const changeResultSort = (next: ResultSortMode) => { setResultSortMode(next); setResultPage(1); setSelectedShopId(null); };
  const changeResultPage = (next: number) => { setResultPage(next); setSelectedShopId(null); };

  const selectedShop = useMemo(
    () => effectiveShops.find((shop) => shop.id === selectedShopId) ?? null,
    [effectiveShops, selectedShopId],
  );

  const { prepareSpeech, isSpeechActive } = useKioskSpeech(
    screen === "results" || screen === "answer" || screen === "no-results" ? aiAnswer : "",
    language,
  );

  const searchVisible = screen === "search" && !autoPromoting && !(experience?.operationMode === "PROMOTION" && experience.promotions.length > 0);
  const autoSearchReady = searchVisible && autoSearchArmed && Boolean(query.trim())
    && ((mode === "voice" && voiceState === "confirmed") || (mode === "handwriting" && handwritingRecognized));
  const { secondsLeft, cancel: cancelAutoSearch } = useRecognitionCountdown(autoSearchReady, `${mode}:${language}:${query}`, () => submit());
  useEffect(() => { if (!searchVisible) setAutoSearchArmed(false); }, [searchVisible]);

  const returnToWelcome = useCallback(() => {
    cancelAutoSearch();
    setAutoSearchArmed(false); setHandwritingRecognized(false);
    analyticsSession.current = null;
    setScreen("welcome");
    setMode("voice");
    setQuery("");
    setTagSearch(null);
    setTranscript("");
    setVoiceState("idle");
    setSelectedShopId(null);
    setAiShopIds([]);
    setAiAnswer("");
  }, [cancelAutoSearch]);

  useEffect(() => {
    const resize = () => setScale(Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    // Start the full idle interval after speech generation and physical playback.
    if (screen === "welcome" || isSpeechActive) return;

    let timeoutId = window.setTimeout(returnToWelcome, INACTIVITY_TIMEOUT_MS);
    const resetTimeout = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(returnToWelcome, INACTIVITY_TIMEOUT_MS);
    };
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "pointermove", "keydown", "wheel"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimeout, { passive: true }));

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimeout));
    };
  }, [returnToWelcome, screen, isSpeechActive]);

  const autoPromotionReady = experience?.operationMode === "AUTO" && (experience?.promotions.length ?? 0) > 0;
  useEffect(() => {
    if (!autoPromotionReady) setAutoPromoting(false);
  }, [autoPromotionReady]);
  useEffect(() => {
    if (!autoPromotionReady || autoPromoting || screen !== "welcome" || isSpeechActive) return;

    const start = () => setAutoPromoting(true);
    let timeoutId = window.setTimeout(start, AUTO_PROMOTION_IDLE_MS);
    const resetTimeout = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(start, AUTO_PROMOTION_IDLE_MS);
    };
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "pointermove", "keydown", "wheel"];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimeout, { passive: true }));

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimeout));
    };
  }, [autoPromotionReady, autoPromoting, screen, isSpeechActive]);

  useEffect(() => {
    if (screen !== "processing") return;
    if (tagSearch) {
      recordKioskEvent(analyticsSession.current, "SEARCH", language, "tag", tagResultShops.map(shop => shop.id), searchEventId.current);
      setScreen(tagResultShops.length ? "results" : "no-results");
      return;
    }
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeoutId = window.setTimeout(() => { timedOut = true; controller.abort(); }, 20_000);
    searchKioskWithAi(query, language, controller.signal).then((answer) => {
      if (!active || controller.signal.aborted) return;
      const knownIds = new Set(marketShops.map((shop) => shop.id));
      const ids = answer.shopIds.filter((id) => knownIds.has(id));
      recordKioskEvent(analyticsSession.current, "SEARCH", language, mode, ids, searchEventId.current);
      setAiShopIds(ids);
      setAiAnswer(answer.message);
      setScreen(ids.length ? "results" : answer.intent === "get_menu" || answer.intent === "get_total_price" ? "answer" : "no-results");
    }).catch(() => {
      if (active && (!controller.signal.aborted || timedOut)) setScreen("error");
    }).finally(() => window.clearTimeout(timeoutId));
    return () => { active = false; window.clearTimeout(timeoutId); controller.abort(); };
  }, [language, mode, query, screen, tagResultShops, tagSearch]);

  const title = useMemo(() => {
    if (mode === "handwriting") return ["가게 정보를", "손가락으로 적어주세요."];
    if (mode === "voice" && voiceState === "confirmed") return ["이렇게", "말씀하셨나요?"];
    if (mode === "voice") return ["가게 정보를", "말씀해주세요."];
    return ["어떤 가게를", "찾고계신가요?"];
  }, [mode, voiceState]);

  const startVoice = () => {
    cancelAutoSearch(); setAutoSearchArmed(false);
    cancelVoiceRef.current?.();
    setVoiceState("listening");
    setTranscript("");
    setQuery("");
    const SpeechRecognition = (window as typeof window & { webkitSpeechRecognition?: new () => any; SpeechRecognition?: new () => any }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceState("error");
      return;
    }
    const recognition = new SpeechRecognition();
    let silenceTimer: number | undefined;
    let latestText = "";
    let stopping = false;
    let cancelled = false;
    const clearSilenceTimer = () => {
      window.clearTimeout(silenceTimer);
      silenceTimer = undefined;
    };
    const confirmTranscript = () => {
      setQuery(latestText);
      setVoiceState(latestText.trim() ? "confirmed" : "error");
      setAutoSearchArmed(Boolean(latestText.trim()));
    };
    const scheduleSilenceStop = () => {
      clearSilenceTimer();
      if (stopping || cancelled) return;
      silenceTimer = window.setTimeout(() => {
        silenceTimer = undefined;
        stopping = true;
        recognition.stop();
        confirmTranscript();
      }, VOICE_SILENCE_TIMEOUT_MS);
    };
    const cancel = () => {
      cancelled = true;
      clearSilenceTimer();
      recognition.abort();
      if (cancelVoiceRef.current === cancel) cancelVoiceRef.current = null;
    };
    cancelVoiceRef.current = cancel;
    recognition.lang = { ko: "ko-KR", en: "en-US", vi: "vi-VN" }[language];
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onstart = scheduleSilenceStop;
    recognition.onspeechstart = clearSilenceTimer;
    recognition.onspeechend = scheduleSilenceStop;
    recognition.onresult = (event: any) => {
      if (cancelled) return;
      const text = Array.from(event.results).map((result: any) => result[0].transcript).join("");
      latestText = text;
      setTranscript(text);
      if (stopping) confirmTranscript();
      else {
        setVoiceState("recognizing");
        scheduleSilenceStop();
      }
    };
    recognition.onerror = () => {
      if (cancelled) return;
      stopping = true;
      clearSilenceTimer();
      setVoiceState("error");
    };
    recognition.onend = () => {
      clearSilenceTimer();
      if (cancelled) return;
      if (cancelVoiceRef.current === cancel) cancelVoiceRef.current = null;
      if (!stopping) confirmTranscript();
    };
    try {
      recognition.start();
    } catch {
      cancel();
      setVoiceState("error");
    }
  };

  const submit = () => {
    cancelAutoSearch(); setAutoSearchArmed(false);
    if (!query.trim()) return;
    searchEventId.current = crypto.randomUUID();
    prepareSpeech();
    setTagSearch(null);
    setSelectedShopId(null);
    setResultSortMode("relevance");
    setResultPage(1);
    setAiShopIds([]);
    setAiAnswer("");
    setScreen("processing");
  };

  const searchTag = (tag: { name: string; keywords: string }) => {
    searchEventId.current = crypto.randomUUID();
    setQuery("");
    setTagSearch({ ...tag });
    setSelectedShopId(null);
    setResultSortMode("relevance");
    setResultPage(1);
    setAiShopIds([]);
    setAiAnswer("");
    setScreen("processing");
  };

  const openSearch = () => {
    setTagSearch(null);
    setScreen("search");
  };

  const clearInput = () => {
    cancelAutoSearch(); setAutoSearchArmed(false); setHandwritingRecognized(false);
    cancelVoiceRef.current?.();
    setQuery("");
    setTranscript("");
    setVoiceState("idle");
    setHandwritingResetKey((current) => current + 1);
  };

  const changeInputMode = (nextMode: InputMode) => {
    if (nextMode === mode) return;
    clearInput();
    setMode(nextMode);
  };

  const canvas = (
    <div className="fixed inset-0 overflow-hidden bg-[#e8ece9]">
      <div
        className="absolute left-1/2 top-1/2 h-[1920px] w-[1080px] origin-center overflow-hidden bg-[#f8fbf8] font-['Kiosk_Result_Noto','Noto_Sans_KR',sans-serif] text-[#19211c]"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {!(["results", "directions", "map"] as Screen[]).includes(screen) && (
          <Header
            language={language}
            onMap={() => { cancelAutoSearch(); setAutoSearchArmed(false); setSelectedShopId(null); setScreen("map"); }}
            onLanguage={() => {
              cancelAutoSearch(); setAutoSearchArmed(false);
              setPendingLanguage(language);
              setLanguageReturnScreen(screen);
              setScreen("language");
            }}
          />
        )}

        {screen === "welcome" && (
          <main className="relative isolate flex h-[1800px] flex-col items-center overflow-hidden bg-[#f8fbf8] pt-[220px]" style={{ paddingBottom: KIOSK_BOTTOM_INSET }}>
            <div className="z-10 text-center text-[#0a3825]">
              <h1 className="text-[64px] font-bold leading-[1.4]">{t("가게를 찾고계신가요?")}<br />{t("화면을 터치해보세요")}</h1>
              <PrimaryButton onClick={startSession} className="mx-auto mt-[56px] w-[660px]" typography="text-[36px] font-medium leading-[44px]">{t("대조시장 길 찾기")}</PrimaryButton>
            </div>
            <DesignMotion name="welcome" className="absolute bottom-0 left-0 h-[1920px] w-full mix-blend-darken" />
            <div role="img" aria-label="RISE · DOL³ · WDKY" className="pointer-events-none absolute left-1/2 top-[1704px] z-10 flex h-[48px] -translate-x-1/2 items-center gap-[14px] whitespace-nowrap text-white drop-shadow-[0_0_12px_rgba(0,0,0,0.4)]">
              <span className="shrink-0 font-['Kiosk_Map_Pretendard',sans-serif] text-[48px] font-bold leading-none">RISE</span>
              <LogoDivider scale={scale} />
              <img src="/figma/woodikey-dol3.png" alt="" className="h-[40px] w-[109px] shrink-0 object-cover" />
              <LogoDivider scale={scale} />
              <img src="/figma/woodikey-wdky.svg" alt="" className="block h-[40px] w-[105px] max-w-none shrink-0" />
            </div>
          </main>
        )}

        {screen === "language" && (
          <LanguageSelectionScreen
            selected={pendingLanguage}
            onSelect={setPendingLanguage}
            onBack={() => setScreen(languageReturnScreen)}
            onComplete={() => {
              setLanguage(pendingLanguage);
              setScreen(languageReturnScreen);
            }}
          />
        )}

        {screen === "processing" && <SearchStatusScreen kind="processing" query={tagSearch ? t(tagSearch.name) : query} onBack={openSearch} onRetry={tagSearch ? () => searchTag(tagSearch) : submit} />}
        {screen === "no-results" && <SearchStatusScreen kind="empty" query={tagSearch ? t(tagSearch.name) : query} message={aiAnswer} onBack={openSearch} onRetry={tagSearch ? () => searchTag(tagSearch) : submit} />}
        {screen === "answer" && <SearchStatusScreen kind="answer" query={query} message={aiAnswer} onBack={openSearch} onRetry={submit} />}
        {screen === "error" && <SearchStatusScreen kind="connection" query={query} onBack={openSearch} onRetry={submit} />}

        {screen === "results" && (
          <main className="relative h-[1920px] bg-white">
            <MapView shops={visibleResults.map(result => result.shop)} iconShops={effectiveShops} selectedShop={selectedShop} onSelectShop={trackShopSelection} selectedViewportY={0.3} bottomOverlayHeight={KIOSK_PANEL_HEIGHT.results} topOverlayHeight={208} initialOverview overviewBottomPadding={!tagSearch && aiAnswer ? 144 : 0} numberedShops={visibleResults} />
            <FloatingSearchBar value={tagSearch ? t(tagSearch.name) : query} onClick={openSearch} onSearchAgain={openSearch} />
            <ResultsPanel
              results={orderedResults}
              sortMode={resultSortMode}
              onSortModeChange={changeResultSort}
              page={currentResultPage}
              onPageChange={changeResultPage}
              answer={tagSearch ? "" : aiAnswer}
              selectedId={selectedShopId}
              onSelect={trackShopSelection}
              onSearchAgain={openSearch}
              onDirections={() => { if (selectedShop) { recordKioskEvent(analyticsSession.current, "DIRECTIONS", language, "touch", [selectedShop.id]); setDirectionsOrigin("results"); setScreen("directions"); } }}
            />
          </main>
        )}

        {screen === "directions" && selectedShop && (
          <main className="relative h-[1920px] bg-white">
            <MapView shops={directionsOrigin === "map" ? effectiveShops : resultShops} iconShops={effectiveShops} selectedShop={selectedShop} onSelectShop={trackShopSelection} showRoute bottomOverlayHeight={KIOSK_PANEL_HEIGHT.directions} topOverlayHeight={208} />
            <FloatingSearchBar value={directionsOrigin === "map" ? t(selectedShop.name) : tagSearch ? t(tagSearch.name) : query} onClick={openSearch} onSearchAgain={openSearch} />
            <DirectionsPanel shopName={selectedShop.name} direction={getRouteDirectionForShop(selectedShop)} distanceMeters={getRouteDistanceForShop(selectedShop)} onBack={() => setScreen(directionsOrigin)} onHome={returnToWelcome} />
          </main>
        )}

        {screen === "map" && (
          <main className="relative h-[1920px] bg-white">
            <MapView shops={effectiveShops} selectedShop={selectedShop} onSelectShop={trackShopSelection} selectedViewportY={0.4} bottomOverlayHeight={selectedShop ? KIOSK_PANEL_HEIGHT.mapSelected : KIOSK_PANEL_HEIGHT.map} topOverlayHeight={208} />
            <FloatingSearchBar value={selectedShop ? t(selectedShop.name) : undefined} onClick={openSearch} onSearchAgain={openSearch} />
            <MarketMapPanel
              shop={selectedShop}
              distanceMeters={selectedShop ? getRouteDistanceForShop(selectedShop) : 0}
              onHome={returnToWelcome}
              onSearch={openSearch}
              onDirections={() => { if (selectedShop) { recordKioskEvent(analyticsSession.current, "DIRECTIONS", language, "touch", [selectedShop.id]); setDirectionsOrigin("map"); setScreen("directions"); } }}
            />
          </main>
        )}

        {screen === "search" && (
          <main className="flex h-[1800px] flex-col px-[48px] pt-[56px]" style={{ paddingBottom: KIOSK_BOTTOM_INSET }}>
            {voiceState !== "error" && (
              <section className="shrink-0 text-[#0a3825]">
                <h1 className="text-[80px] font-bold leading-[1.3]">{language === "ko" ? <>{title[0]}<br />{title[1]}</> : t(title.join(" "))}</h1>
                <p className="mt-[16px] text-[36px] font-medium leading-[44px]">{t("가게와 시장 정보를 쉽고 빠르게 찾아보세요.")}</p>
              </section>
            )}

            {voiceState === "error" ? (
              <VoicePanel
                state={voiceState}
                transcript={transcript}
                onStart={startVoice}
                onRetry={() => { setVoiceState("idle"); startVoice(); }}
                onKeyboard={() => { setMode("keyboard"); setVoiceState("idle"); }}
              />
            ) : (
              <div className="mt-[100px] flex min-h-0 flex-1 flex-col">
                <MethodTabs mode={mode} onChange={changeInputMode} />

                {mode === "voice" ? (
                  <div className="mt-[40px] flex min-h-0 flex-1 flex-col">
                    <VoicePanel state={voiceState} transcript={transcript} onStart={startVoice} onRetry={() => { clearInput(); startVoice(); }} secondsLeft={autoSearchReady ? secondsLeft : null} />
                    <div className="mt-[40px] flex shrink-0 gap-[24px]">
                      <button type="button" onClick={clearInput} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px] leading-[52px]">{t("지우기")}</button>
                      <PrimaryButton disabled={voiceState !== "confirmed" || !query.trim()} onClick={submit} className="flex-1">{t("검색하기")}</PrimaryButton>
                    </div>
                  </div>
                ) : mode === "keyboard" ? (
                  <div className="mt-[40px] flex min-h-0 flex-1 flex-col">
                    <SearchField value={query} onChange={setQuery} />
                    <div className="mt-[24px]"><CategoryChips onChoose={searchTag} configuredTags={experience?.searchTags} /></div>
                    <div className="mt-auto">
                      <TouchKeyboard key={language} value={query} onChange={setQuery} onSubmit={submit} />
                      <div className="mt-[40px] flex gap-[24px]">
                        <button type="button" onClick={clearInput} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px] leading-[52px]">{t("지우기")}</button>
                        <PrimaryButton disabled={!query.trim()} onClick={submit} className="flex-1">{t("검색하기")}</PrimaryButton>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-[40px] flex min-h-0 flex-1 flex-col">
                    {handwritingRecognized ? <RecognitionConfirmation kind="handwriting" text={query} secondsLeft={autoSearchReady ? secondsLeft : null} onRetry={clearInput} /> : (
                      <div className="min-h-0 flex-1">
                        <HandwritingPad key={handwritingResetKey} language={language} recognizing={handwritingRecognizing} onRecognizingChange={setHandwritingRecognizing} onRecognized={onHandwritingRecognized} />
                      </div>
                    )}
                    <div className="mt-[40px] flex shrink-0 gap-[24px]">
                      <button type="button" onClick={clearInput} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px] leading-[52px]">{t("지우기")}</button>
                      <PrimaryButton disabled={!handwritingRecognized || handwritingRecognizing || !query.trim()} onClick={submit} className="flex-1">{t("검색하기")}</PrimaryButton>
                    </div>
                  </div>
                )}
              </div>
            )}
          </main>
        )}
      </div>
    </div>
  );

  if (experience?.operationMode === "PROMOTION" && experience.promotions.length > 0) {
    return <KioskLocaleContext.Provider value={{ language, t }}><KioskPromotionPlayer contents={experience.promotions} /></KioskLocaleContext.Provider>;
  }
  if (autoPromotionReady && autoPromoting && experience) {
    return <KioskLocaleContext.Provider value={{ language, t }}><KioskPromotionPlayer contents={experience.promotions} onExit={() => setAutoPromoting(false)} /></KioskLocaleContext.Provider>;
  }
  return <KioskLocaleContext.Provider value={{ language, t }}>{canvas}</KioskLocaleContext.Provider>;
}
