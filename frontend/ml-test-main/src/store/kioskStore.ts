import { create } from 'zustand';

interface KioskState {
  kioskId: number | null;
  storeName: string;
  kioskNumber: number;
  activated: boolean;
  setKioskData: (data: {
    kioskId: number;
    storeName: string;
    kioskNumber: number;
    activated: boolean;
  }) => void;
}

export const useKioskStore = create<KioskState>((set) => ({
  kioskId: null,
  storeName: '',
  kioskNumber: 0,
  activated: false,
  setKioskData: (data) => set(data),
}));
