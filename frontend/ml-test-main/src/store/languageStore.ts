import { create } from 'zustand';
import { Language } from '@/i18n/language';

type LanguageState = {
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'ko',
  setLanguage: (language) => set({ language }),
  toggleLanguage: () =>
    set((state) => ({
      language:
        state.language === 'ko' ? 'en' : state.language === 'en' ? 'vi' : 'ko',
    })),
}));
