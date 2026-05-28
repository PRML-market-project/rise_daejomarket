import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKioskStore } from '../../../store/kioskStore';
import { toast } from 'sonner';

import { useNavigationStore } from '@/store/navigationStore';
import { useVoiceStore } from '../store/voiceStore';

// ✅ 추가
import { flushSync } from 'react-dom';

const StoreEntry = () => {
  const [storeName, setStoreName] = useState('');
  const [kioskNumber, setTableNumber] = useState('');
  const navigate = useNavigate();
  const setKioskData = useKioskStore((state) => state.setKioskData);

  const { resetNavigation } = useNavigationStore();
  const { setIsCovered } = useVoiceStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/kiosk/activate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storeName,
            kioskNumber: parseInt(kioskNumber, 10),
          }),
        }
      );

      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}.`);

      const data = await response.json();

      // ✅ 핵심: 이동 전에 "커버 ON + 네비 리셋"을 먼저 확정
      flushSync(() => {
        resetNavigation();
        setIsCovered(true);
        setKioskData(data);
      });

      navigate(`/${data.adminId}/${data.kioskId}/${kioskNumber}/order`, { replace: true });
      toast.success('Kiosk activated successfully!');
    } catch (error: any) {
      console.error('API communication failed:', error);
      toast.error('API communication failed. Using local data.');

      try {
        const mockResponse = await fetch('/mock-kiosk-data.json');
        const mockData = await mockResponse.json();
        if (!mockResponse.ok) throw new Error('Failed to load local mock data.');

        flushSync(() => {
          resetNavigation();
          setIsCovered(true);
          setKioskData(mockData);
        });

        navigate(`/${mockData.adminId}/${mockData.kioskId}/${kioskNumber}/order`, { replace: true });
        toast.success('Kiosk activated with local data!');
      } catch (localError: any) {
        toast.error(localError.message || 'Failed to activate kiosk');
      }
    }
  };

  return (
    <div className='w-screen h-screen flex flex-col md:flex-row bg-background'>
      <div className='w-full md:w-1/2 flex flex-col justify-center items-center px-10 space-y-6 bg-card/30'>
        <h1 className='text-5xl font-bold text-primary mb-8'>Daejo Market</h1>

        <form onSubmit={handleSubmit} className='w-full max-w-sm space-y-5'>
          <div>
            <label
              htmlFor='store-name'
              className='block text-sm font-medium text-muted-foreground mb-1'
            >
              가게 이름
            </label>
            <input
              id='store-name'
              name='store-name'
              type='text'
              required
              className='w-full px-4 py-3 bg-background border border-input rounded-lg shadow-sm text-foreground
                         focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring placeholder:text-muted-foreground/50'
              placeholder='가게 이름을 입력하세요'
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor='table-number'
              className='block text-sm font-medium text-muted-foreground mb-1'
            >
              키오스크 번호
            </label>
            <input
              id='table-number'
              name='table-number'
              type='number'
              required
              className='w-full px-4 py-3 bg-background border border-input rounded-lg shadow-sm text-foreground
                         focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring placeholder:text-muted-foreground/50'
              placeholder='키오스크 번호를 입력하세요'
              value={kioskNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            />
          </div>

          <button
            type='submit'
            className='w-full py-3 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-lg shadow-md
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring transition-colors'
          >
            키오스크 등록
          </button>
        </form>
      </div>

      <div className='w-full md:w-1/2 bg-secondary flex items-center justify-center border-l border-border'>
        <div
          className='w-48 h-48 rounded-full bg-gradient-to-br from-ml-yellow-light to-ml-yellow
              text-black font-extrabold text-7xl tracking-tight flex items-center justify-center
              border border-ml-yellow relative overflow-hidden'
          style={{ boxShadow: '0 0 40px var(--color-indigo-shadow)' }}
        >
          <span
            style={{
              background: `linear-gradient(135deg, #000 0%, #333 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: `drop-shadow(0 2px 2px rgba(255,255,255,0.2))`,
            }}
          >
            DM
          </span>
        </div>
      </div>
    </div>
  );
};

export default StoreEntry;
