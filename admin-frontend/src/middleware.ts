import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hasToken = Boolean(request.cookies.get("accessToken")?.value);
  const isLogin = request.nextUrl.pathname.startsWith("/login");
  const isProtected = request.nextUrl.pathname === "/" || request.nextUrl.pathname.startsWith("/dashboard");

  if (isLogin && hasToken) return NextResponse.redirect(new URL("/dashboard", request.url));
  if (isProtected && !hasToken) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico)$).*)"],
};
