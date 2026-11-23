"use client";

import { OPERATION_MODE_LABELS, type OperationModeLabel } from "./kioskExperienceApi";

export default function AdminOperationPanel({ current, selected, onSelect, onApply, disabled = false, hasPendingChanges = false, loadFailed = false, onRetry }: {
  current: OperationModeLabel | null;
  selected: OperationModeLabel | null;
  onSelect: (mode: OperationModeLabel) => void;
  onApply: () => void;
  disabled?: boolean;
  hasPendingChanges?: boolean;
  loadFailed?: boolean;
  onRetry?: () => void;
}) {
  const ready = current !== null && selected !== null;
  const buttonClass = "flex h-[48px] shrink-0 items-center justify-center rounded-full px-[20px] text-[16px] font-medium leading-[23px] transition hover:brightness-[.98] disabled:cursor-default disabled:opacity-50";
  const canApply = ready && !disabled && (selected !== current || hasPendingChanges);
  return <section aria-label="운영 모드" aria-busy={!ready && !loadFailed} className="flex h-[115px] shrink-0 items-center justify-between rounded-[20px] border border-[#ebebeb] bg-white p-[20px]">
    <div className="flex gap-[40px]">
      <div className="flex w-[280px] shrink-0 flex-col gap-[16px]">
        <span className="text-[14px] font-medium leading-[20px]">현재 운영 중</span>
        <strong role="status" className="flex items-center gap-[4px] text-[24px] leading-[29px] text-[#116543]">
          <span className={`h-[8px] w-[8px] shrink-0 rounded-full ${current ? "bg-[#168259]" : "bg-[#a1a1a1]"}`} />
          {current ? `${current} 서비스` : loadFailed ? "운영 상태 확인 실패" : "불러오는 중…"}
        </strong>
      </div>
      <div className="flex flex-col gap-[8px]">
        <span className="text-[14px] font-medium leading-[20px]">모드 변경하기</span>
        <div className="flex gap-[8px]">
          {OPERATION_MODE_LABELS.map((mode) => <button type="button" key={mode} aria-pressed={selected === mode} disabled={!ready || disabled} onClick={() => onSelect(mode)} className={`${buttonClass} w-[128px] ${selected === mode ? "bg-[#116543] text-white" : "bg-[#ebebeb] text-[#19211c]"}`}>{mode}</button>)}
        </div>
      </div>
    </div>
    {loadFailed && onRetry
      ? <button type="button" onClick={onRetry} className={`${buttonClass} w-[180px] bg-[#ebebeb] text-[#19211c]`}>다시 불러오기</button>
      : <button type="button" disabled={!canApply} onClick={onApply} className={`${buttonClass} w-[180px] ${canApply ? "bg-[#116543] text-white" : "bg-[#ebebeb] text-[#19211c]"}`}>운영 모드 적용</button>}
  </section>;
}
