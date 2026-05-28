import { create } from 'zustand';
import { useCartStore } from '@/store/cartStore';
import { useVoiceStore } from './voiceStore';
import SpeechRecognition from 'react-speech-recognition';

interface OrderStore {
  showOrderModal: boolean;
  setShowOrderModal: (show: boolean) => void;
  handleOrderConfirmation: () => void;
}

export const useOrderStore = create<OrderStore>((set) => ({
  showOrderModal: false,
  setShowOrderModal: (show) => set({ showOrderModal: show }),
  handleOrderConfirmation: () => {
    const clearCart = useCartStore.getState().clearCart;
    const setIsCovered = useVoiceStore.getState().setIsCovered;

    setIsCovered(true);
    SpeechRecognition.stopListening();
    clearCart();
    set({ showOrderModal: false });
  },
}));
