import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import SpeechRecognition from 'react-speech-recognition';
import { useLanguageStore } from '@/store/languageStore';
import { useMenuStore } from '@/store/menuStore';
import { useNavigationStore } from '@/store/navigationStore';
import HandwritingPad from './HandwritingPad';
import {
  Language,
  languageLabels,
  localizedValue,
  speechRecognitionLocales,
  t,
} from '@/i18n/language';

const normalizeSearchText = (value: string) =>
  value.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');

const editDistance = (left: string, right: string) => {
  const distances = Array.from(
    { length: right.length + 1 },
    (_, index) => index
  );

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = distances[0];
    distances[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = distances[rightIndex];
      distances[rightIndex] = Math.min(
        distances[rightIndex] + 1,
        distances[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }

  return distances[right.length];
};

const getSearchScore = (query: string, candidate: string) => {
  const normalizedCandidate = normalizeSearchText(candidate);
  if (!query || !normalizedCandidate) return 0;
  if (normalizedCandidate === query) return 100;
  if (normalizedCandidate.startsWith(query)) return 90;
  if (normalizedCandidate.includes(query)) return 80;
  if (query.length < 2) return 0;

  const similarity =
    1 -
    editDistance(query, normalizedCandidate) /
      Math.max(query.length, normalizedCandidate.length);
  const threshold = query.length <= 3 ? 0.66 : 0.55;

  return similarity >= threshold ? Math.round(similarity * 70) : 0;
};

type SearchResult = {
  key: string;
  type: 'shop' | 'menu';
  categoryId: number;
  categoryType: string;
  menuId: number | null;
  name: string;
  shopName?: string;
  score: number;
};

const INITIALS = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const VOWELS = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
];
const FINALS = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
];
const COMBINED_VOWELS: Record<string, string> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
  'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ',
  'ㅏㅣ': 'ㅐ', 'ㅑㅣ': 'ㅒ', 'ㅓㅣ': 'ㅔ', 'ㅕㅣ': 'ㅖ',
};
const SPLIT_VOWELS: Record<string, string> = Object.fromEntries(
  Object.entries(COMBINED_VOWELS).map(([parts, combined]) => [
    combined,
    parts[0],
  ])
);
const COMBINED_FINALS: Record<string, string> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ',
  'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ',
  'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ',
};
const SPLIT_FINALS: Record<string, [string, string]> = Object.fromEntries(
  Object.entries(COMBINED_FINALS).map(([parts, combined]) => [
    combined,
    [parts[0], parts[1]],
  ])
);
const DOUBLE_INITIALS: Record<string, string> = {
  'ㄱㄱ': 'ㄲ',
  'ㄷㄷ': 'ㄸ',
  'ㅂㅂ': 'ㅃ',
  'ㅅㅅ': 'ㅆ',
  'ㅈㅈ': 'ㅉ',
};

const makeSyllable = (initial: string, vowel: string, final = '') =>
  String.fromCharCode(
    0xac00 +
      (INITIALS.indexOf(initial) * 21 + VOWELS.indexOf(vowel)) * 28 +
      FINALS.indexOf(final)
  );

const getSyllableParts = (character: string) => {
  const code = character.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return null;
  return {
    initial: INITIALS[Math.floor(code / 588)],
    vowel: VOWELS[Math.floor((code % 588) / 28)],
    final: FINALS[code % 28],
  };
};

const appendHangul = (text: string, key: string) => {
  if (!text) return key;
  const last = text.at(-1) || '';
  const prefix = text.slice(0, -1);
  const parts = getSyllableParts(last);
  const isVowel = VOWELS.includes(key);

  if (isVowel) {
    if (parts) {
      if (!parts.final) {
        const combined = COMBINED_VOWELS[parts.vowel + key];
        return combined
          ? prefix + makeSyllable(parts.initial, combined)
          : text + key;
      }

      const splitFinal = SPLIT_FINALS[parts.final];
      const remainingFinal = splitFinal?.[0] || '';
      const nextInitial = splitFinal?.[1] || parts.final;
      return (
        prefix +
        makeSyllable(parts.initial, parts.vowel, remainingFinal) +
        makeSyllable(nextInitial, key)
      );
    }

    if (INITIALS.includes(last)) {
      return prefix + makeSyllable(last, key);
    }
    const combined = COMBINED_VOWELS[last + key];
    return combined ? prefix + combined : text + key;
  }

  if (parts) {
    if (!parts.final && FINALS.includes(key)) {
      return prefix + makeSyllable(parts.initial, parts.vowel, key);
    }
    if (parts.final) {
      const combined = COMBINED_FINALS[parts.final + key];
      if (combined) {
        return prefix + makeSyllable(parts.initial, parts.vowel, combined);
      }
    }
    return text + key;
  }

  if (INITIALS.includes(last)) {
    const doubled = DOUBLE_INITIALS[last + key];
    return doubled ? prefix + doubled : text + key;
  }
  return text + key;
};

const removeLastHangulKey = (text: string) => {
  if (!text) return text;
  const last = text.at(-1) || '';
  const prefix = text.slice(0, -1);
  const parts = getSyllableParts(last);
  if (!parts) return prefix;

  if (parts.final) {
    const splitFinal = SPLIT_FINALS[parts.final];
    return prefix + makeSyllable(
      parts.initial,
      parts.vowel,
      splitFinal?.[0] || ''
    );
  }
  const simpleVowel = SPLIT_VOWELS[parts.vowel];
  return simpleVowel
    ? prefix + makeSyllable(parts.initial, simpleVowel)
    : prefix + parts.initial;
};

const ENGLISH_KEYS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
const KOREAN_KEYS = [
  ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'],
  ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'],
  ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ'],
];

const Header = () => {
  const { language, setLanguage } = useLanguageStore();
  const categories = useMenuStore((state) => state.categories);
  const {
    setCurrentCategory,
    setCurrentCategoryType,
    setCurrentMenu,
    setCurrentView,
  } = useNavigationStore();
  const { kioskId } = useParams();
  const navigate = useNavigate();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [inputPanelMode, setInputPanelMode] = useState<
    'keyboard' | 'handwriting'
  >('keyboard');
  const [keyboardLanguage, setKeyboardLanguage] = useState<'ko' | 'en'>(
    language === 'ko' ? 'ko' : 'en'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [titleWidth, setTitleWidth] = useState<number>();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const titleTextRef = useRef<HTMLSpanElement>(null);
  const isEnglishSearch =
    /[a-z]/i.test(searchQuery) &&
    !/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(searchQuery);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const isVirtualKeyboardClick = Boolean(
        target.closest('[data-virtual-keyboard]')
      );
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node) &&
        !isVirtualKeyboardClick
      ) {
        setIsSearchOpen(false);
        setIsKeyboardOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
      setIsKeyboardOpen(true);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    setKeyboardLanguage(language === 'ko' ? 'ko' : 'en');
  }, [language]);

  useLayoutEffect(() => {
    const title = titleTextRef.current;
    if (!title) return;

    const updateTitleWidth = () => {
      setTitleWidth(Math.ceil(title.getBoundingClientRect().width));
    };
    const observer = new ResizeObserver(updateTitleWidth);

    updateTitleWidth();
    observer.observe(title);
    void document.fonts?.ready.then(updateTitleWidth);

    return () => observer.disconnect();
  }, [language]);

  const searchResults = useMemo<SearchResult[]>(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);
    if (!normalizedQuery) return [];
    const displayLanguage: Language = isEnglishSearch ? 'en' : language;

    return categories
      .flatMap((category) => {
        const shopName = localizedValue(
          displayLanguage,
          category.categoryName,
          category.categoryNameEn,
          category.categoryNameVi
        );
        const shopScore = Math.max(
          getSearchScore(normalizedQuery, category.categoryName),
          getSearchScore(normalizedQuery, category.categoryNameEn),
          getSearchScore(normalizedQuery, category.categoryNameVi || '')
        );
        const shopResult: SearchResult[] = shopScore
          ? [
              {
                key: `shop-${category.categoryId}`,
                type: 'shop',
                categoryId: category.categoryId,
                categoryType: category.categoryType,
                menuId: null,
                name: shopName,
                score: shopScore,
              },
            ]
          : [];
        const menuResults = category.menus.flatMap<SearchResult>((menu) => {
          const score = Math.max(
            getSearchScore(normalizedQuery, menu.menuName),
            getSearchScore(normalizedQuery, menu.menuNameEn),
            getSearchScore(normalizedQuery, menu.menuNameVi || '')
          );
          if (!score) return [];

          return [
            {
              key: `menu-${category.categoryId}-${menu.menuId}`,
              type: 'menu',
              categoryId: category.categoryId,
              categoryType: category.categoryType,
              menuId: menu.menuId,
              name: localizedValue(
                displayLanguage,
                menu.menuName,
                menu.menuNameEn,
                menu.menuNameVi
              ),
              shopName,
              score,
            },
          ];
        });

        return [...shopResult, ...menuResults];
      })
      .sort(
        (left, right) =>
          right.score - left.score || left.name.localeCompare(right.name)
      )
      .slice(0, 8);
  }, [categories, isEnglishSearch, language, searchQuery]);

  const handleDeactivate = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/kiosk/deactivate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kioskId }),
        }
      );

      if (response.ok) navigate('/');
    } catch (error) {
      console.error('Failed to deactivate kiosk:', error);
    }
  };

  const handleLanguageChange = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    SpeechRecognition.stopListening();
    SpeechRecognition.startListening({
      continuous: true,
      language: speechRecognitionLocales[nextLanguage],
    });
  };

  const handleSearchToggle = () => {
    if (isSearchOpen) {
      searchInputRef.current?.blur();
      setIsKeyboardOpen(false);
      setIsSearchOpen(false);
      return;
    }

    // 터치 이벤트 처리 중 입력창을 실제 DOM에 만든 뒤 바로 포커스해야
    // 모바일/키오스크의 화면 키보드가 안정적으로 열린다.
    flushSync(() => setIsSearchOpen(true));
    searchInputRef.current?.focus({ preventScroll: true });
    setIsKeyboardOpen(true);
  };

  const handleSearchResultClick = (result: SearchResult) => {
    setCurrentView('menu');
    setCurrentCategoryType(result.categoryType);
    setCurrentCategory(result.categoryId);
    setCurrentMenu(result.menuId);
    setSearchQuery('');
    setIsKeyboardOpen(false);
    setIsSearchOpen(false);
  };

  const handleVirtualKey = (key: string) => {
    setSearchQuery((query) =>
      keyboardLanguage === 'ko' ? appendHangul(query, key) : query + key
    );
  };

  const handleVirtualBackspace = () => {
    setSearchQuery((query) =>
      keyboardLanguage === 'ko'
        ? removeLastHangulKey(query)
        : query.slice(0, -1)
    );
  };

  return (
    <header
      ref={searchRef}
      className='w-full bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50'
    >
      <div className='flex h-14 items-center justify-between gap-2 px-4'>
        <div className='flex min-w-0 items-center gap-1'>
          <div
            className='w-9 aspect-square text-sm rounded-full bg-gradient-to-br from-ml-yellow-light to-ml-yellow text-black font-extrabold tracking-tight flex items-center justify-center border border-ml-yellow relative overflow-hidden'
            style={{ boxShadow: '0 0 15px var(--color-indigo-shadow)' }}
          >
            <span
              style={{
                background: 'linear-gradient(135deg, #000 0%, #333 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              DM
            </span>
          </div>

          <h1
            className='overflow-hidden text-lg font-extrabold text-foreground tracking-tight whitespace-nowrap transition-[width] duration-300 ease-in-out'
            style={{ width: titleWidth }}
          >
            <span ref={titleTextRef} className='inline-block whitespace-nowrap'>
              {t(language, 'kioskTitle')}
            </span>
          </h1>

          <div className='relative' ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className='p-1.5 hover:bg-accent text-muted-foreground hover:text-accent-foreground rounded-full transition-colors'
              aria-label='Settings'
            >
              <img
                src='/settings.svg'
                alt='Settings'
                className='w-5 h-5 opacity-70 hover:opacity-100 dark:invert'
              />
            </button>

            {isDropdownOpen && (
              <div className='absolute top-full left-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg py-2 z-50'>
                <button
                  onClick={handleDeactivate}
                  className='w-full px-4 py-2 text-left text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors'
                >
                  {language === 'vi'
                    ? 'Tắt ki-ốt'
                    : language === 'en'
                      ? 'Deactivate Kiosk'
                      : '키오스크 비활성화'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <button
            type='button'
            onClick={handleSearchToggle}
            className={`h-9 shrink-0 px-3 rounded-md border text-sm font-semibold transition-colors ${
              isSearchOpen
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary text-secondary-foreground border-border hover:bg-accent'
            }`}
            aria-expanded={isSearchOpen}
            aria-controls='header-search-panel'
          >
            🔍 검색
          </button>

          <div
            className='flex rounded border border-border overflow-hidden'
            role='group'
            aria-label='Language'
          >
            {(Object.keys(languageLabels) as Language[]).map((code) => (
              <button
                key={code}
                type='button'
                onClick={() => handleLanguageChange(code)}
                className={`font-semibold py-1 px-2 transition-colors ${
                  language === code
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                }`}
                aria-pressed={language === code}
              >
                {languageLabels[code]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className='overflow-hidden transition-[max-height] duration-300 ease-in-out'
        style={{
          maxHeight: isSearchOpen
            ? searchQuery.trim()
              ? '55vh'
              : '96px'
            : '0px',
        }}
      >
        <div>
          <div
            id='header-search-panel'
            className={`relative border-t border-border bg-background px-4 pb-3 pt-4 transition-all duration-300 ease-in-out ${
              isSearchOpen
                ? 'translate-y-0 opacity-100'
                : '-translate-y-3 opacity-0'
            }`}
          >
            <label className='relative block'>
              <input
                ref={searchInputRef}
                type='search'
                inputMode='none'
                enterKeyHint='search'
                autoComplete='off'
                autoCapitalize='none'
                spellCheck={false}
                value={searchQuery}
                onFocus={() => setIsKeyboardOpen(true)}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setIsKeyboardOpen(false);
                    setIsSearchOpen(false);
                  }
                  if (event.key === 'Enter' && searchResults[0]) {
                    handleSearchResultClick(searchResults[0]);
                  }
                }}
                placeholder='상점명 또는 상품명 검색'
                className='relative z-10 h-12 w-full rounded-xl border-2 border-border bg-card px-4 text-lg text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-inset focus:ring-primary/20'
                aria-label='상점명 또는 상품명 검색'
              />
            </label>

            {searchQuery.trim() && (
              <div className='mt-2 max-h-[42vh] overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-xl'>
                {searchResults.length > 0 ? (
                  <div className='space-y-2'>
                    {searchResults.map((result) => (
                      <button
                        key={result.key}
                        type='button'
                        onClick={() => handleSearchResultClick(result)}
                        className='flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-2 text-left transition-colors hover:bg-accent active:bg-accent'
                      >
                        <span className='min-w-0'>
                          <span className='block truncate text-base font-bold text-popover-foreground'>
                            {result.name}
                          </span>
                          {result.shopName && (
                            <span className='block truncate text-sm text-muted-foreground'>
                              {result.shopName}
                            </span>
                          )}
                        </span>
                        <span className='shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-muted-foreground'>
                          {isEnglishSearch
                            ? result.type === 'shop'
                              ? 'Shop'
                              : 'Product'
                            : result.type === 'shop'
                              ? '상점'
                              : '상품'}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className='px-3 py-6 text-center text-base text-muted-foreground'>
                    {isEnglishSearch
                      ? 'No search results.'
                      : '검색 결과가 없습니다.'}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {typeof document !== 'undefined' &&
        createPortal(
          <div
            data-virtual-keyboard
            className={`fixed inset-x-0 bottom-0 z-[200] border-t border-border bg-background/98 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.18)] backdrop-blur-md transition-transform duration-300 ease-in-out ${
              isKeyboardOpen && isSearchOpen
                ? 'translate-y-0'
                : 'pointer-events-none translate-y-full'
            }`}
            aria-hidden={!isKeyboardOpen || !isSearchOpen}
          >
            <div className='mx-auto max-w-4xl'>
              <div className='mb-2 flex items-center justify-between'>
                <div className='flex rounded-lg border border-border bg-secondary p-1'>
                  <button
                    type='button'
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => setInputPanelMode('keyboard')}
                    className={`h-9 rounded-md px-4 text-sm font-bold transition-colors ${
                      inputPanelMode === 'keyboard'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-secondary-foreground'
                    }`}
                  >
                    ⌨ 키보드
                  </button>
                  <button
                    type='button'
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => setInputPanelMode('handwriting')}
                    className={`h-9 rounded-md px-4 text-sm font-bold transition-colors ${
                      inputPanelMode === 'handwriting'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-secondary-foreground'
                    }`}
                  >
                    ✍ 손글씨
                  </button>
                </div>
                <div className='flex items-center gap-2'>
                  {inputPanelMode === 'keyboard' && (
                    <button
                      type='button'
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() =>
                        setKeyboardLanguage((current) =>
                          current === 'ko' ? 'en' : 'ko'
                        )
                      }
                      className='h-9 rounded-lg border border-border bg-secondary px-4 text-sm font-bold text-secondary-foreground active:bg-accent'
                    >
                      {keyboardLanguage === 'ko' ? '한 / 영' : 'EN / 한'}
                    </button>
                  )}
                  <button
                    type='button'
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => {
                      searchInputRef.current?.blur();
                      setIsKeyboardOpen(false);
                    }}
                    className='flex h-9 w-11 items-center justify-center rounded-lg border border-border bg-secondary text-lg font-bold text-secondary-foreground active:bg-accent'
                    aria-label='가상 키보드 닫기'
                  >
                    ✕
                  </button>
                </div>
              </div>

              {inputPanelMode === 'keyboard' ? (
                <>
                  <div className='space-y-1.5'>
                    {(keyboardLanguage === 'ko'
                      ? KOREAN_KEYS
                      : ENGLISH_KEYS
                    ).map((row, rowIndex) => (
                      <div
                        key={rowIndex}
                        className='flex justify-center gap-1.5'
                      >
                        {row.map((key) => (
                          <button
                            key={key}
                            type='button'
                            onPointerDown={(event) => event.preventDefault()}
                            onClick={() => handleVirtualKey(key)}
                            className='h-11 min-w-0 flex-1 rounded-lg border border-border bg-card text-lg font-bold text-card-foreground shadow-sm active:translate-y-px active:bg-accent'
                          >
                            {key}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div className='mt-1.5 flex gap-1.5'>
                    <button
                      type='button'
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() =>
                        setKeyboardLanguage((current) =>
                          current === 'ko' ? 'en' : 'ko'
                        )
                      }
                      className='h-11 w-20 rounded-lg border border-border bg-secondary text-sm font-bold text-secondary-foreground active:bg-accent'
                    >
                      한/영
                    </button>
                    <button
                      type='button'
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => setSearchQuery((query) => query + ' ')}
                      className='h-11 flex-1 rounded-lg border border-border bg-card text-sm font-semibold text-muted-foreground active:bg-accent'
                    >
                      Space
                    </button>
                    <button
                      type='button'
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={handleVirtualBackspace}
                      className='h-11 w-20 rounded-lg border border-border bg-secondary text-xl font-bold text-secondary-foreground active:bg-accent'
                      aria-label='한 글자 지우기'
                    >
                      ⌫
                    </button>
                    <button
                      type='button'
                      onPointerDown={(event) => event.preventDefault()}
                      onClick={() => {
                        if (searchResults[0]) {
                          handleSearchResultClick(searchResults[0]);
                        }
                      }}
                      className='h-11 w-24 rounded-lg bg-primary text-sm font-extrabold text-primary-foreground active:brightness-95'
                    >
                      검색
                    </button>
                  </div>
                </>
              ) : (
                <HandwritingPad
                  language={language}
                  onRecognized={(text) => setSearchQuery(text)}
                />
              )}
            </div>
          </div>,
          document.body
        )}
    </header>
  );
};

export default Header;
