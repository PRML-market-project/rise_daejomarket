import { create } from 'zustand';

export interface Message {
  text: string;
  isUser: boolean;
  timestamp: number;
}

interface ChatStore {
  messages: Message[];
  addMessage: (message: Message) => void;
  updateLastMessage: (text: string) => void;
  isCapturing: boolean;
  setIsCapturing: (isCapturing: boolean) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  updateLastMessage: (text) =>
    set((state) => ({
      messages: state.messages.map((msg, index) =>
        index === state.messages.length - 1 ? { ...msg, text } : msg
      ),
    })),
  isCapturing: false,
  setIsCapturing: (isCapturing) => set({ isCapturing }),
}));
