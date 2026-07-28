import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import SpeechRecognition from 'react-speech-recognition';
import { useLanguageStore } from '@/store/languageStore';
import { useMenuStore } from '@/store/menuStore';
import { useNavigationStore } from '@/store/navigationStore';
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
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
  }, [isSearchOpen]);

  useLayoutEffect(() => {
    if (titleTextRef.current) {
      setTitleWidth(titleTextRef.current.scrollWidth);
    }
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
      setIsSearchOpen(false);
      return;
    }

    // 터치 이벤트 처리 중 입력창을 실제 DOM에 만든 뒤 바로 포커스해야
    // 모바일/키오스크의 화면 키보드가 안정적으로 열린다.
    flushSync(() => setIsSearchOpen(true));
    searchInputRef.current?.focus({ preventScroll: true });
  };

  const handleSearchResultClick = (result: SearchResult) => {
    setCurrentView('menu');
    setCurrentCategoryType(result.categoryType);
    setCurrentCategory(result.categoryId);
    setCurrentMenu(result.menuId);
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  return (
    <header
      ref={searchRef}
      className='w-full bg-background/95 backdrop-blur-sm border-b border-border sticky top-0 z-50'
    >
      <div className='flex h-14 items-center justify-between gap-2 px-4'>
        <div className='flex items-center justify-center gap-2'>
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
              className='p-2 hover:bg-accent text-muted-foreground hover:text-accent-foreground rounded-full transition-colors'
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
              : '76px'
            : '0px',
        }}
      >
        <div>
          <div
            id='header-search-panel'
            className={`relative border-t border-border bg-background px-4 py-3 transition-all duration-300 ease-in-out ${
              isSearchOpen
                ? 'translate-y-0 opacity-100'
                : '-translate-y-3 opacity-0'
            }`}
          >
            <label className='relative block'>
              <input
                ref={searchInputRef}
                type='search'
                inputMode='search'
                enterKeyHint='search'
                autoComplete='off'
                autoCapitalize='none'
                spellCheck={false}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setIsSearchOpen(false);
                  if (event.key === 'Enter' && searchResults[0]) {
                    handleSearchResultClick(searchResults[0]);
                  }
                }}
                placeholder='상점명 또는 상품명 검색'
                className='h-12 w-full rounded-xl border-2 border-border bg-card px-4 text-lg text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20'
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
    </header>
  );
};

export default Header;
