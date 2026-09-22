import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "대조시장 관리자",
  description: "대조시장 가게 정보와 키오스크 운영 관리",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
