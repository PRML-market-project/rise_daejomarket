import { useLanguageStore } from '@/store/languageStore';
import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SpeechRecognition from 'react-speech-recognition';

const Header = () => {
  const { language, toggleLanguage } = useLanguageStore();
  const { kioskId, kioskNumber } = useParams();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDeactivate = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/kiosk/deactivate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ kioskId }),
        }
      );

      if (response.ok) {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to deactivate kiosk:', error);
    }
  };

  return (
    // [변경] bg-[url...] 유지하되, 배경색과 테두리는 테마 변수 사용
    <header className="w-full h-14 bg-background/95 backdrop-blur-sm border-b border-border flex items-center justify-between px-4 sticky top-0 z-50">
      <div className='flex items-center justify-center gap-2'>
        {/* [변경] 로고 아이콘: Indigo -> Primary(Gold) Gradient */}
        <div
          className='w-9 aspect-square text-sm rounded-full bg-gradient-to-br from-ml-yellow-light to-ml-yellow
              text-black font-extrabold tracking-tight flex items-center justify-center
              border border-ml-yellow relative overflow-hidden'
          style={{
            // CSS 파일에서 정의한 변수 사용 (이름은 기존 유지하되 값은 Gold로 변경됨)
            boxShadow: '0 0 15px var(--color-indigo-shadow)', 
          }}
        >
          <span
            style={{
              background: `linear-gradient(135deg, #000 0%, #333 100%)`, // 골드 배경 위라 글자는 어둡게
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            DM
          </span>
        </div>
        
        {/* [변경] 타이틀 텍스트: Indigo -> Foreground (자동 적응) */}
        <h1 className='text-lg font-extrabold text-foreground tracking-tight whitespace-nowrap'>
          {language === 'en' ? 'Daejo Market Kiosk' : '대조시장 키오스크'}
        </h1>

        {/* Settings Button */}
        <div className='relative' ref={dropdownRef}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            // [변경] 호버 효과: Indigo -> Accent
            className='p-2 hover:bg-accent text-muted-foreground hover:text-accent-foreground rounded-full transition-colors'
            aria-label='Settings'
          >
            {/* SVG 색상을 현재 텍스트 색상(currentColor)으로 따라가게 하거나 필터 적용 필요 */}
            <img src='/settings.svg' alt='Settings' className='w-5 h-5 opacity-70 hover:opacity-100 dark:invert' />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            // [변경] 메뉴 배경: White -> Popover (다크모드 대응)
            <div className='absolute top-full left-0 mt-2 w-48 bg-popover border border-border rounded-lg shadow-lg py-2 z-50'>
              <button
                onClick={handleDeactivate}
                // [변경] 메뉴 아이템 호버: Indigo -> Accent
                className='w-full px-4 py-2 text-left text-popover-foreground hover:bg-accent hover:text-accent-foreground transition-colors'
              >
                {language === 'en' ? 'Deactivate Kiosk' : '키오스크 비활성화'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className='flex items-center gap-2'>
        {/* [변경] 텍스트 색상: Indigo -> Foreground/Muted */}
        <div className='text-sm font-semibold text-foreground flex items-center gap-2'>
          <span className='hidden xs:inline'>{language === 'en' ? 'Kiosk:' : '키오스크:'}</span>
          
          {/* [변경] 번호 뱃지: Indigo -> Primary (Gold) */}
          <span className='bg-primary/20 border border-primary/50 w-8 h-8 rounded-full flex items-center justify-center text-base text-primary font-bold shadow-sm select-none'>
            {kioskNumber}
          </span>
        </div>

        {/* 언어 토글 버튼 */}
        <button
          onClick={() => {
            console.log('한영 전환');
            toggleLanguage();
            SpeechRecognition.stopListening();
            return SpeechRecognition.startListening({
              continuous: true,
              language: language === 'ko' ? 'en-US' : 'ko-KR',
            });
          }}
          // [변경] 버튼 색상: Indigo -> Secondary (Black/Gray or Light Beige)
          className='bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border font-semibold py-1 px-3 rounded transition-colors'
          aria-label='Toggle language'
        >
          {language === 'en' ? 'KO' : 'ENG'}
        </button>
      </div>
    </header>
  );
};

export default Header;