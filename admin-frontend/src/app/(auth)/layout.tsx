export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className='w-screen h-screen flex bg-white text-black '>
      {/* 왼쪽 영역: 브랜드 및 로고 */}
      <div className='w-1/2 relative flex flex-col items-center justify-center bg-indigo-50'>
        {/* 왼쪽 상단 브랜드명 */}
        <h1 className='absolute top-6 left-8 text-indigo-900 text-2xl font-semibold tracking-tight'>
          Market
        </h1>

        {/* 로고 */}
        <div
          className='w-48 h-48 rounded-full bg-gradient-to-br from-indigo-200 to-indigo-400
            text-indigo-900 font-extrabold text-7xl tracking-tight flex items-center justify-center
            shadow-[0_10px_30px_rgba(99,102,241,0.4)] border border-indigo-300 relative'
          style={{
            fontFamily: "'Pretendard', sans-serif",
            letterSpacing: '-1.5px',
          }}
        >
          {/* 텍스트 그라데이션 효과 */}
          <span
            style={{
              background: 'linear-gradient(135deg, #5c6ac4 0%, #3b43a9 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.15))',
            }}
          >
            ML
          </span>

          {/* 반투명 빛나는 원 효과 */}
          <div
            className='absolute top-[-30%] left-[-30%] w-[180%] h-[180%] rounded-full
            bg-gradient-to-tr from-indigo-400/30 to-indigo-200/20
            animate-pulse'
            style={{ filter: 'blur(40px)' }}
          />

          {/* 내부 그림자 (inset shadow) */}
          <div
            className='absolute inset-0 rounded-full pointer-events-none'
            style={{
              boxShadow:
                'inset 0 0 15px 5px rgba(255, 255, 255, 0.15), inset 0 5px 10px rgba(0,0,0,0.1)',
            }}
          />
        </div>

        {/* 로고 하단 문구 */}
        <p className='text-indigo-700 text-lg font-medium tracking-tight text-center px-6 mt-6'>
          부드러운 주문의 시작
        </p>
      </div>

      {/* 오른쪽 영역: 로그인 입력 */}
      <div className='w-1/2 h-screen flex flex-col items-center justify-start'>
        <div className='w-full max-w-md px-8'>{children}</div>
      </div>
    </div>
  );
}
