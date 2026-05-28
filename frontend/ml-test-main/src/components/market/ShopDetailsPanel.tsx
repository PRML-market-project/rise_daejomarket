import React from "react";
import { Shop } from "@/types/shop";

interface ShopDetailsPanelProps {
  shop: Shop | null;
  isNavigating: boolean;
  onStartNavigation: () => void;
  onClose?: () => void;
}

export function ShopDetailsPanel({
  shop,
  isNavigating,
  onStartNavigation,
  onClose,
}: ShopDetailsPanelProps) {
  if (!shop) return null;

  return (
    <div
      // ✅ 수정 1: shadow 관련 클래스 제거
      // ✅ 수정 2: 애니메이션 추가 (animate-in slide-in-from-right-full)
      //    -> slide-in-from-right-full: 자신의 너비(100%)만큼 오른쪽에서 시작해서 들어옴
      className="w-full h-full flex flex-col bg-white/95 backdrop-blur-md
                 rounded-[120px] border-[6px] border-gray-200 overflow-hidden
                 animate-in slide-in-from-right-full fade-in duration-500 ease-out"
    >
      {/* --- 상단 정보 영역 --- */}
      <div className="p-[80px] pb-0 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-[50px] right-[50px] p-[20px] text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-[60px] h-[60px]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <span className="inline-block px-[30px] py-[10px] bg-amber-100 text-amber-800 text-[45px] font-bold rounded-full mb-[30px] border-[3px] border-amber-200">
          {shop.number}
        </span>

        <h2 className="text-[120px] font-black text-gray-900 leading-tight tracking-tight">
          {shop.name}
        </h2>

        <p className="text-[50px] text-gray-500 mt-[20px] font-medium">{shop.category}</p>
      </div>

      {/* --- 하단 컨텐츠 영역 --- */}
      <div className="p-[80px] overflow-y-auto space-y-[40px]">
        <button
          onClick={onStartNavigation}
          // ✅ 수정 3: 버튼 그림자(shadow-md) 제거 -> border로 깔끔하게 처리
          className={`w-full py-[40px] rounded-[40px] font-bold text-[60px] transition-all flex items-center justify-center gap-[20px] border-[4px] ${
            isNavigating
              ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
              : "bg-gray-900 text-white border-transparent hover:bg-gray-800"
          }`}
        >
          {isNavigating ? (
            <>
              <svg className="w-[60px] h-[60px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              안내 종료
            </>
          ) : (
            <>
              <svg className="w-[60px] h-[60px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              길안내 시작
            </>
          )}
        </button>

        <div className="grid grid-cols-2 gap-[30px]">
          <div className="bg-gray-50 rounded-[40px] p-[40px] border-[3px] border-gray-100">
            <h4 className="text-[40px] font-bold text-gray-400 uppercase mb-[10px] tracking-widest">
              상세 위치
            </h4>
            <p className="text-gray-800 font-bold text-[55px]">{shop.section}</p>
          </div>

          <div className="bg-gray-50 rounded-[40px] p-[40px] border-[3px] border-gray-100">
            <h4 className="text-[40px] font-bold text-gray-400 uppercase mb-[10px] tracking-widest">
              운영 정보
            </h4>
            <p className="text-gray-800 font-bold text-[55px]">
              {shop.hours || "08:00 - 19:00"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}