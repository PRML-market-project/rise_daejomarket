import { useKioskLocale } from "./i18n";

export function RecognitionConfirmation({ text, secondsLeft, onRetry, kind }: {
  text: string;
  secondsLeft: number | null;
  onRetry: () => void;
  kind: "voice" | "handwriting";
}) {
  const { t } = useKioskLocale();
  return <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-[40px] overflow-hidden rounded-[28px] bg-[#ebebeb] p-[40px]">
    <img src="/figma/recognition-confirm-bg.png" alt="" className="pointer-events-none absolute inset-0 h-full w-full rounded-[28px] object-cover" />
    <div className="relative z-10 flex w-full flex-col items-center gap-[24px] text-center">
      {secondsLeft !== null && <p role="timer" aria-live="off" className="text-[28px] font-medium leading-[40px] underline [text-underline-position:from-font]" style={{ color: "#cfeadb" }}>{t("{seconds}초 후 검색진행", { seconds: secondsLeft })}</p>}
      <p className="w-full whitespace-pre-wrap break-words text-[56px] font-normal leading-[64px] text-white">“{text}”</p>
    </div>
    <button type="button" onClick={onRetry} className={`relative z-10 flex shrink-0 items-center justify-center gap-[16px] rounded-full border-2 bg-white/30 px-[32px] py-[16px] text-[32px] font-medium leading-[40px] text-white ${kind === "handwriting" ? "border-white" : "border-[#ebebeb]"}`}>
      <img src="/figma/recognition-refresh.svg" alt="" className="shrink-0" />{t(kind === "voice" ? "다시 말하기" : "다시 검색하기")}
    </button>
  </div>;
}
