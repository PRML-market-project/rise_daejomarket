export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="w-screen h-screen flex bg-background text-foreground">
      {/* 왼쪽 영역 */}
      <div
        className="w-1/2 relative flex flex-col items-center justify-center"
        style={{
          background: "var(--ml-auth-left-bg)",
        }}
      >
        {/* 브랜드명 */}
        <h1
          className="absolute top-6 left-8 text-2xl font-semibold tracking-tight"
          style={{ color: "var(--ml-auth-brand)" }}
        >
          Market
        </h1>

        {/* 로고 */}
        <div
          className="w-48 h-48 rounded-full flex items-center justify-center border relative"
          style={{
            fontFamily: "'Pretendard', sans-serif",
            letterSpacing: "-1.5px",
            background: "var(--ml-auth-logo-bg)",
            borderColor: "var(--ml-auth-logo-border)",
            boxShadow: "var(--ml-auth-logo-shadow)",
          }}
        >
          {/* 로고 텍스트 */}
          <span
            className="font-extrabold text-7xl tracking-tight"
            style={{
              color: "rgba(60,50,40,0.85)",
              mixBlendMode: "multiply",
              textShadow: "0 1px 2px rgba(0,0,0,0.25)",
            }}
          >
            ML
          </span>






          {/* 글로우 */}
          <div
            className="absolute top-[-30%] left-[-30%] w-[180%] h-[180%] rounded-full animate-pulse pointer-events-none"
            style={{
              background: "var(--ml-auth-glow)",
              filter: "blur(44px)",
            }}
          />

          {/* 내부 음영 */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: "var(--ml-auth-logo-inset)",
            }}
          />
        </div>

        {/* 문구 */}
        <p
          className="text-lg font-medium tracking-tight text-center px-6 mt-6"
          style={{ color: "var(--ml-auth-subtitle)" }}
        >
          부드러운 주문의 시작
        </p>
      </div>

      {/* 오른쪽 영역 */}
      <div className="w-1/2 h-screen flex flex-col items-center justify-start">
        <div className="w-full max-w-md px-8">{children}</div>
      </div>
    </div>
  );
}
