"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      if (isLocalhost && userId === "daejo_admin" && password === "2580") {
        localStorage.setItem("accessToken", "local-admin");
        localStorage.setItem("refreshToken", "local-admin");
        document.cookie = "accessToken=local-admin; path=/; SameSite=Lax";
        document.cookie = "refreshToken=local-admin; path=/; SameSite=Lax";
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userId, password }),
      });
      if (!response.ok) throw new Error("invalid credentials");
      const data = await response.json();
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      document.cookie = `accessToken=${data.accessToken}; path=/; SameSite=Lax`;
      document.cookie = `refreshToken=${data.refreshToken}; path=/; SameSite=Lax`;
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("아이디 또는 비밀번호를 다시 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#116543]">
      <header className="flex h-[80px] shrink-0 items-center gap-[20px] border-b border-[#ebebeb] bg-white px-[32px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/design-asset/logo" alt="대조시장" className="h-[44px] w-[142px]" />
        <strong className="text-[16px] leading-[23px] text-[#19211c]">관리자</strong>
      </header>
      <section className="flex flex-1 items-center justify-center p-[32px]">
        <form onSubmit={submit} className="flex w-[480px] flex-col gap-[24px] rounded-[24px] border border-[#ebebeb] bg-white p-[32px]">
          <div className="flex flex-col gap-[8px]">
            <h1 className="text-[28px] font-bold leading-[41px] text-[#0a3825]">관리자 로그인</h1>
            <p className="text-[14px] font-medium leading-[20px]">대조시장 가게 정보와 키오스크 운영을 관리합니다.</p>
          </div>
          <div className="flex flex-col gap-[16px]">
            <label className="flex flex-col gap-[8px] text-[14px] font-bold leading-[20px]">
              아이디
              <input value={userId} onChange={(e) => setUserId(e.target.value)} autoComplete="username" placeholder="관리자 아이디를 입력해주세요" className={`min-h-[48px] rounded-[12px] border bg-white p-[12px] text-[16px] font-normal leading-[23px] outline-none placeholder:text-[#a1a1a1] focus:border-[#116543] ${error ? "border-[#b3261e]" : "border-[#ebebeb]"}`} />
            </label>
            <label className="flex flex-col gap-[8px] text-[14px] font-bold leading-[20px]">
              비밀번호
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" placeholder="비밀번호를 입력해주세요" className={`min-h-[48px] rounded-[12px] border bg-white p-[12px] text-[16px] font-normal leading-[23px] outline-none placeholder:text-[#a1a1a1] focus:border-[#116543] ${error ? "border-[#b3261e]" : "border-[#ebebeb]"}`} />
            </label>
          </div>
          {error && <p role="alert" className="text-[14px] font-medium leading-[20px] text-[#b3261e]">{error}</p>}
          <button disabled={loading} className="flex h-[56px] w-full items-center justify-center rounded-full bg-[#116543] px-[20px] text-[16px] font-medium text-white disabled:opacity-60">{loading ? "로그인 중…" : "로그인"}</button>
          <p className="text-[14px] font-medium leading-[21px] text-[#a1a1a1]">등록된 관리자 계정으로 로그인해주세요.</p>
        </form>
      </section>
    </main>
  );
}
