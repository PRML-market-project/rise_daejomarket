import { create } from 'zustand';

type StartMicOptions = { lang?: string };

interface VoiceStore {
  isCovered: boolean;
  setIsCovered: (isCovered: boolean) => void;

  isMicOn: boolean;

  startMic: (opts?: StartMicOptions) => Promise<void> | void;
  stopMic: () => Promise<void> | void;

  startHotwordDetection: () => Promise<void> | void;
  stopHotwordDetection: () => Promise<void> | void;
}

export const useVoiceStore = create<VoiceStore>((set) => ({
  isCovered: true,
  setIsCovered: (isCovered) => set({ isCovered }),

  isMicOn: false,

  // 원래 마이크 시작 로직이 있으면 여기에 연결
  startMic: async (_opts) => {
    set({ isMicOn: true });
  },
  stopMic: async () => {
    set({ isMicOn: false });
  },

  startHotwordDetection: async () => {},
  stopHotwordDetection: async () => {},
}));
