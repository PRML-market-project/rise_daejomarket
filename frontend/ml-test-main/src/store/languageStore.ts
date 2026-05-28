import { create } from 'zustand';

type LanguageState = {
  language: 'ko' | 'en';
  toggleLanguage: () => void;
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'ko',
  toggleLanguage: () =>
    set((state) => ({ language: state.language === 'ko' ? 'en' : 'ko' })),
}));
