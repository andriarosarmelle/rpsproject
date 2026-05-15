import { NextRequest, NextResponse } from "next/server";

const publicRoutes = ["/login", "/signup", "/forgot-password", "/survey-response"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/trpc") ||
    pathname.startsWith("/webhook/") ||
    pathname === "/survey-responses" ||
    pathname === "/report/export-docx"
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|css|js)$/)
  ) {
    return NextResponse.next();
  }

  const authToken = request.cookies.get("auth_token")?.value;
  if (authToken) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
