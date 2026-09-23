import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRouteDistanceForShop, MapView } from "@/components/market/MapView";
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

type InputMode = "keyboard" | "handwriting" | "voice";
type VoiceState = "idle" | "listening" | "recognizing" | "confirmed" | "error";
type Screen = "welcome" | "search" | "processing" | "results" | "directions" | "map" | "no-results" | "error" | "language";
type Language = "ko" | "en" | "vi";

const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;
const INACTIVITY_TIMEOUT_MS = 30_000;
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
  return (
    <header className="flex h-[120px] shrink-0 items-center justify-between border-b-2 border-[#ebebeb] px-[52px]">
      <img src="/figma/daecho-logo.svg" alt="대조시장" className="h-[44px] w-[142px]" />
      <div className="flex gap-[16px]">
        <button
          type="button"
          onClick={onMap}
          className="flex h-[68px] items-center gap-[8px] rounded-full bg-[#ebebeb] px-[32px] text-[24px] font-medium text-[#19211c]"
        >
          <img src="/figma/map.svg" alt="" className="h-[28px] w-[28px]" />
          시장지도
        </button>
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

function PrimaryButton({
  children,
  disabled = false,
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[120px] min-h-[112px] items-center justify-center rounded-full px-[24px] text-[40px] font-normal transition active:scale-[0.99] disabled:bg-[#ebebeb] disabled:text-[#a1a1a1] ${className}`}
      style={!disabled ? { backgroundImage: GREEN, color: "white" } : undefined}
    >
      {children}
    </button>
  );
}

function MethodTabs({ mode, onChange }: { mode: InputMode; onChange: (mode: InputMode) => void }) {
  const tabs: Array<[InputMode, string]> = [
    ["keyboard", "키보드로 검색"],
    ["handwriting", "손글씨로 검색"],
    ["voice", "음성으로 검색"],
  ];

  return (
    <div className="flex h-[120px] w-full gap-[8px] rounded-full bg-[#ebebeb] p-[8px]">
      {tabs.map(([value, label]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`flex-1 whitespace-nowrap rounded-full text-[36px] font-medium leading-[48px] ${
            mode === value ? "text-white" : "text-[#a1a1a1]"
          }`}
          style={mode === value ? { backgroundImage: GREEN } : undefined}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex h-[120px] w-full items-center gap-[16px] rounded-full bg-[#ebebeb] px-[48px]">
      <img src="/figma/search.svg" alt="" className="h-[40px] w-[40px]" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="search"
        autoComplete="off"
        autoCorrect="off"
        placeholder="검색어를 입력하세요"
        className="min-w-0 flex-1 bg-transparent text-[40px] leading-[52px] text-[#19211c] outline-none placeholder:text-[#a1a1a1]"
      />
    </label>
  );
}

function CategoryChips({ onChoose, configuredTags }: { onChoose: (value: string) => void; configuredTags?: KioskExperience["searchTags"] }) {
  const defaults = [
    ["주변식당", "/figma/restaurant.svg", "#ff9500"],
    ["반찬가게", "/figma/side-dish.svg", "#ff85ba"],
    ["간식가게", "/figma/snack.svg", "#0062ff"],
  ];
  const chips = configuredTags?.filter((tag) => tag.visible).slice(0, 3).map((tag, index) => [tag.name, tag.iconUrl ? `${(import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/$/, "")}${tag.iconUrl}` : defaults[index]?.[1] ?? "/figma/restaurant.svg", defaults[index]?.[2] ?? "#116543", tag.keywords]) ?? defaults;
  return (
    <div className="flex gap-[8px]">
      {chips.map(([label, icon, color, keywords]) => (
        <button
          type="button"
          key={label}
          onClick={() => onChoose(keywords || label)}
          className="flex h-[76px] items-center gap-[12px] rounded-full border-2 border-[#ebebeb] px-[32px] text-[36px] text-[#19211c]"
        >
          <span className="flex h-[40px] w-[40px] items-center justify-center rounded-full" style={{ backgroundColor: color }}>
            <img src={icon} alt="" className="h-[28px] w-[28px]" />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}

function TouchKeyboard({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => void }) {
  const [layout, setLayout] = useState<KeyboardLayout>("ko");
  const [alphaLayout, setAlphaLayout] = useState<Exclude<KeyboardLayout, "number">>("ko");
  const [shifted, setShifted] = useState(false);
  const keyClass = "flex h-[104px] shrink-0 items-center justify-center whitespace-nowrap rounded-[12px] bg-[#f8fbf8] text-[36px] font-medium leading-[48px] text-[#19211c] shadow-[0_2px_0_rgba(0,0,0,.12)] active:translate-y-[2px] active:shadow-none";
  const rows = (shifted ? shiftedKeyboardLayouts : keyboardLayouts)[layout];
  const append = (key: string) => onChange(value + key);
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
  const usesEnglishLabels = layout === "en" || (layout === "number" && alphaLayout === "en");
  const shiftLabel = layout === "ko" ? "쌍자음" : layout === "en" ? "Shift" : "기호";

  return (
    <div className="flex h-[584px] w-full flex-col gap-[12px] rounded-[24px] bg-[#ebebeb] px-[24px] py-[48px]">
      {rows.slice(0, 2).map((row, index) => (
        <div key={index} className="flex justify-center gap-[8px]">
          {row.map((key) => <button type="button" key={key} onClick={() => append(key)} className={`${keyClass} w-[86.4px]`}>{key}</button>)}
        </div>
      ))}
      <div className="flex justify-center gap-[8px]">
        <button type="button" aria-pressed={shifted} onClick={() => setShifted((current) => !current)} className={`${keyClass} w-[133.6px] gap-[4px] text-[20px] leading-[32px] ${shifted ? "bg-[#d8e8df] text-[#116543]" : ""}`}><span className="text-[24px]">⇧</span><span>{shiftLabel}</span></button>
        {rows[2].map((key) => <button type="button" key={key} onClick={() => append(key)} className={`${keyClass} w-[86.4px]`}>{key}</button>)}
        <button type="button" onClick={() => onChange(value.slice(0, -1))} className={`${keyClass} w-[133.6px] gap-[4px] text-[20px] leading-[32px]`}><span className="text-[24px]">⌫</span><span>{usesEnglishLabels ? "Del" : "삭제"}</span></button>
      </div>
      <div className="flex justify-center gap-[8px]">
        <button type="button" aria-pressed={layout === "number"} onClick={toggleNumbers} className={`${keyClass} w-[124px] text-[24px] leading-[36px]`}>{layout === "number" ? (alphaLayout === "ko" ? "가나다" : "ABC") : "123"}</button>
        <button type="button" onClick={toggleLanguage} className={`${keyClass} w-[124px] text-[24px] leading-[36px]`}>한/영</button>
        <button type="button" onClick={() => append(" ")} className={`${keyClass} w-[456px] text-[24px] leading-[36px]`}>{usesEnglishLabels ? "Space" : "띄어쓰기"}</button>
        <button type="button" onClick={onSubmit} className="h-[104px] w-[208px] shrink-0 whitespace-nowrap rounded-[12px] bg-[#363636] text-[28px] font-bold leading-[40px] text-white shadow-[0_2px_0_rgba(0,0,0,.12)]">{usesEnglishLabels ? "Confirm" : "확인"}</button>
      </div>
    </div>
  );
}

type InkPoint = { x: number; y: number; t: number; pressure: number };
type InkStroke = { points: InkPoint[] };
type RecognitionResponse = { candidates?: string[]; detail?: string; error?: string };

const HANDWRITING_API_URL = import.meta.env.VITE_HANDWRITING_API_URL ?? "http://127.0.0.1:17832";
const HANDWRITING_IDLE_MS = 1500;
const HANDWRITING_WIDTH = 984;
const HANDWRITING_HEIGHT = 780;

function HandwritingPad({ language, recognized, onRecognized }: { language: Language; recognized: boolean; onRecognized: (text: string) => void }) {
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
  }, []);

  const recognize = useCallback(async () => {
    if (!strokesRef.current.length) return;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    try {
      const response = await fetch(`${HANDWRITING_API_URL}/recognize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strokes: strokesRef.current, language }),
        signal: controller.signal,
      });
      const result = (await response.json()) as RecognitionResponse;
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
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
    }
  }, [language, onRecognized, redraw]);

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
    <div className="relative h-full min-h-0 overflow-hidden rounded-[28px] bg-[#ebebeb]">
      {!recognized && <img src="/figma/handwriting-guide.png" alt="" className="pointer-events-none absolute inset-0 h-full w-full rounded-[28px] object-cover object-bottom opacity-15" />}
      {!hasInk && (
        <p className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-[36px] font-medium leading-[48px] ${recognized ? "text-[#a1a1a1]" : "text-[#0a3825]"}`}>검색할 내용을 손가락으로 적어주세요</p>
      )}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-20 h-full w-full touch-none"
        aria-label="손글씨 입력 영역"
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
    </div>
  );
}

function VoicePanel({ state, transcript, onStart, onRetry, onKeyboard }: { state: VoiceState; transcript: string; onStart: () => void; onRetry: () => void; onKeyboard?: () => void }) {
  if (state === "error") {
    return (
      <div className="flex flex-1 flex-col items-center pt-[240px] text-center">
        <img src="/figma/voice-error.png" alt="" className="mb-[36px] h-[150px] w-[150px] object-contain" />
        <h2 className="text-[56px] font-bold text-[#0a3825]">제대로 듣지 못했어요</h2>
        <p className="mt-[12px] text-[32px] text-[#0a3825]">조금 더 가까이에서 천천히 말씀해주세요.</p>
        <PrimaryButton onClick={onRetry} className="mt-[80px] w-full">다시 말하기</PrimaryButton>
        <button type="button" onClick={onKeyboard} className="mt-[24px] h-[120px] w-full rounded-full bg-[#ebebeb] text-[40px] text-[#19211c]">키보드로 검색하기</button>
      </div>
    );
  }

  if (state === "confirmed") {
    return (
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[28px]">
        <img src="/figma/voice-confirm-bg.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative z-10 text-center text-white">
          <p className="text-[48px]">“{transcript}”</p>
          <button type="button" onClick={onRetry} className="mt-[40px] rounded-full border-2 border-[#ebebeb] bg-white/30 px-[32px] py-[16px] text-[32px]">↻ 다시 말하기</button>
        </div>
      </div>
    );
  }

  const active = state === "listening" || state === "recognizing";
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
      <button
        type="button"
        onClick={onStart}
        className={`flex h-[320px] w-[320px] items-center justify-center rounded-full ${active ? "bg-[#00af55] shadow-[0_0_100px_rgba(0,190,95,.55)]" : "bg-[#168259]"}`}
      >
        <img src="/figma/mic.svg" alt="음성 입력" className="h-[84px] w-[84px]" />
      </button>
      <p className="mt-[24px] text-[36px] font-medium leading-[48px] text-[#0a3825]">
        {state === "idle" ? "원을 터치한 뒤 말씀해주세요" : state === "listening" ? "듣고 있어요..." : `“${transcript || "단팥빵을 사고..."}”`}
      </p>
    </div>
  );
}

export default function KioskSearchApp() {
  const [language, setLanguage] = useState<Language>("ko");
  const [scale, setScale] = useState(1);
  const [screen, setScreen] = useState<Screen>("welcome");
  const [mode, setMode] = useState<InputMode>("keyboard");
  const [query, setQuery] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [handwritingResetKey, setHandwritingResetKey] = useState(0);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [pendingLanguage, setPendingLanguage] = useState<Language>(language);
  const [languageReturnScreen, setLanguageReturnScreen] = useState<Screen>("welcome");
  const [experience, setExperience] = useState<KioskExperience | null>(null);
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
    const unsubscribe = subscribeToKioskExperience((value) => { if (!disposed) updateExperience(value); });
    const timer = window.setInterval(() => { controller.abort(); controller = load(); }, 30_000);
    return () => { disposed = true; controller.abort(); unsubscribe(); window.clearInterval(timer); };
  }, [updateExperience]);

  const effectiveShops = useMemo(() => {
    const managed = new Map((experience?.shops ?? []).map((shop) => [shop.id, shop]));
    return marketShops.map((shop) => {
      const override = managed.get(shop.id);
      return override ? { ...shop, name: override.name, category: override.tags[0] || shop.category, searchKeywords: override.keywords, icon: override.icon } : shop;
    });
  }, [experience?.shops]);

  const resultShops = useMemo(() => {
    const normalized = query.replace(/\s/g, "").toLowerCase();
    if (["주변식당", "주변음식점", "음식점", "식당"].some((term) => normalized.includes(term))) {
      return effectiveShops.filter((shop) => shop.category === "식당").slice(0, 12);
    }
    const category = normalized.includes("반찬") || normalized.includes("간식") ? "식품" : normalized;
    return effectiveShops.filter((shop) =>
      shop.name.replace(/\s/g, "").toLowerCase().includes(normalized)
      || shop.category.replace(/\s/g, "").toLowerCase().includes(category)
      || ("searchKeywords" in shop && String(shop.searchKeywords).replace(/\s/g, "").toLowerCase().includes(normalized))
    ).slice(0, 12);
  }, [effectiveShops, query]);

  const selectedShop = useMemo(
    () => effectiveShops.find((shop) => shop.id === selectedShopId) ?? null,
    [effectiveShops, selectedShopId],
  );

  const returnToWelcome = useCallback(() => {
    setScreen("welcome");
    setMode("keyboard");
    setQuery("");
    setTranscript("");
    setVoiceState("idle");
    setSelectedShopId(null);
  }, []);

  useEffect(() => {
    const resize = () => setScale(Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT));
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (screen === "welcome") return;

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
  }, [returnToWelcome, screen]);

  useEffect(() => {
    if (screen !== "processing") return;
    const timeoutId = window.setTimeout(() => {
      if (/연결|오류/.test(query)) setScreen("error");
      else setScreen(resultShops.length ? "results" : "no-results");
    }, 900);
    return () => window.clearTimeout(timeoutId);
  }, [query, resultShops.length, screen]);

  const title = useMemo(() => {
    if (mode === "handwriting") return ["가게 정보를", "손가락으로 적어주세요."];
    if (mode === "voice" && voiceState === "confirmed") return ["이렇게", "말씀하셨나요?"];
    if (mode === "voice") return ["가게 정보를", "말씀해주세요."];
    return ["어떤 가게를", "찾고계신가요?"];
  }, [mode, voiceState]);

  const startVoice = () => {
    setVoiceState("listening");
    setTranscript("");
    const SpeechRecognition = (window as typeof window & { webkitSpeechRecognition?: new () => any; SpeechRecognition?: new () => any }).SpeechRecognition
      || (window as typeof window & { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      window.setTimeout(() => setVoiceState("error"), 900);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;
    recognition.onresult = (event: any) => {
      const text = Array.from(event.results).map((result: any) => result[0].transcript).join("");
      setTranscript(text);
      setVoiceState(event.results[event.results.length - 1].isFinal ? "confirmed" : "recognizing");
      if (event.results[event.results.length - 1].isFinal) setQuery(text);
    };
    recognition.onerror = () => setVoiceState("error");
    recognition.onend = () => setVoiceState((current) => current === "listening" ? "error" : current);
    recognition.start();
  };

  const submit = () => {
    if (!query.trim()) return;
    setSelectedShopId(null);
    setScreen("processing");
  };

  const clearInput = () => {
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
        className="absolute left-1/2 top-1/2 h-[1920px] w-[1080px] origin-center overflow-hidden bg-[#f8fbf8] font-['Noto_Sans_KR',sans-serif] text-[#19211c]"
        style={{ transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        {!(["results", "directions", "map"] as Screen[]).includes(screen) && (
          <Header
            language={language}
            onMap={() => setScreen("map")}
            onLanguage={() => {
              setPendingLanguage(language);
              setLanguageReturnScreen(screen);
              setScreen("language");
            }}
          />
        )}

        {screen === "welcome" && (
          <main className="relative flex h-[1800px] flex-col items-center overflow-hidden pt-[220px]">
            <div className="z-10 text-center text-[#0a3825]">
              <h1 className="text-[64px] font-bold leading-[1.4]">가게를 찾고계신가요?<br />화면을 터치해보세요</h1>
              <PrimaryButton onClick={() => setScreen("search")} className="mx-auto mt-[56px] w-[660px] text-[36px] font-medium">대조시장 길 찾기</PrimaryButton>
            </div>
            <img src="/figma/map-character.png" alt="지도를 들고 있는 대조시장 캐릭터" className="absolute bottom-[-20px] left-0 h-[1220px] w-full object-cover object-top" />
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

        {screen === "processing" && <SearchStatusScreen kind="processing" query={query} onBack={() => setScreen("search")} onRetry={submit} />}
        {screen === "no-results" && <SearchStatusScreen kind="empty" query={query} onBack={() => setScreen("search")} onRetry={submit} />}
        {screen === "error" && <SearchStatusScreen kind="connection" query={query} onBack={() => setScreen("search")} onRetry={submit} />}

        {screen === "results" && (
          <main className="relative h-[1920px] bg-white">
            <MapView shops={resultShops} selectedShop={selectedShop} onSelectShop={setSelectedShopId} />
            <FloatingSearchBar value={query} onClick={() => setScreen("search")} />
            <ResultsPanel
              shops={resultShops}
              selectedId={selectedShopId}
              onSelect={setSelectedShopId}
              onSearchAgain={() => setScreen("search")}
              onDirections={() => selectedShop && setScreen("directions")}
            />
          </main>
        )}

        {screen === "directions" && selectedShop && (
          <main className="relative h-[1920px] bg-white">
            <MapView shops={resultShops} selectedShop={selectedShop} onSelectShop={setSelectedShopId} showRoute />
            <FloatingSearchBar value={query} onClick={() => setScreen("search")} />
            <DirectionsPanel shopName={selectedShop.name} distanceMeters={getRouteDistanceForShop(selectedShop)} onBack={() => setScreen("results")} onHome={returnToWelcome} />
          </main>
        )}

        {screen === "map" && (
          <main className="relative h-[1920px] bg-white">
            <MapView shops={effectiveShops} selectedShop={selectedShop} onSelectShop={setSelectedShopId} />
            <FloatingSearchBar onClick={() => setScreen("search")} />
            <MarketMapPanel onHome={returnToWelcome} onSearch={() => setScreen("search")} />
          </main>
        )}

        {screen === "search" && (
          <main className="flex h-[1800px] flex-col px-[48px] pb-[160px] pt-[56px]">
            {voiceState !== "error" && (
              <section className="shrink-0 text-[#0a3825]">
                <h1 className="text-[80px] font-bold leading-[1.3]">{title[0]}<br />{title[1]}</h1>
                <p className="mt-[16px] text-[36px] font-medium leading-[44px]">가게와 시장 정보를 쉽고 빠르게 찾아보세요.</p>
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
              <div className="mt-[120px] flex min-h-0 flex-1 flex-col">
                <MethodTabs mode={mode} onChange={changeInputMode} />

                {mode === "voice" ? (
                  <div className="mt-[40px] flex min-h-0 flex-1 flex-col">
                    <VoicePanel state={voiceState} transcript={transcript} onStart={startVoice} onRetry={() => setVoiceState("idle")} />
                    <div className="mt-[40px] flex shrink-0 gap-[24px]">
                      <button type="button" onClick={clearInput} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px]">지우기</button>
                      <PrimaryButton disabled={voiceState !== "confirmed" || !query.trim()} onClick={submit} className="flex-1">검색하기</PrimaryButton>
                    </div>
                  </div>
                ) : mode === "keyboard" ? (
                  <div className="mt-[24px] flex min-h-0 flex-1 flex-col">
                    <SearchField value={query} onChange={setQuery} />
                    <div className="mt-[24px]"><CategoryChips onChoose={setQuery} configuredTags={experience?.searchTags} /></div>
                    <div className="mt-auto">
                      <TouchKeyboard value={query} onChange={setQuery} onSubmit={submit} />
                      <div className="mt-[40px] flex gap-[24px]">
                        <button type="button" onClick={clearInput} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px]">지우기</button>
                        <PrimaryButton disabled={!query.trim()} onClick={submit} className="flex-1">검색하기</PrimaryButton>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-[24px] flex min-h-0 flex-1 flex-col">
                    <SearchField value={query} onChange={setQuery} />
                    <div className="mt-[40px] min-h-0 flex-1">
                      <HandwritingPad key={handwritingResetKey} language={language} recognized={Boolean(query.trim())} onRecognized={setQuery} />
                    </div>
                    <div className="mt-[40px] flex shrink-0 gap-[24px]">
                      <button type="button" onClick={clearInput} className="h-[120px] w-[320px] rounded-full bg-[#ebebeb] text-[40px]">지우기</button>
                      <PrimaryButton disabled={!query.trim()} onClick={submit} className="flex-1">검색하기</PrimaryButton>
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
    return <KioskPromotionPlayer contents={experience.promotions} />;
  }
  return canvas;
}
