import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const hasSession = req.cookies.has("__Secure-next-auth.session-token") || req.cookies.has("next-auth.session-token");
  if (hasSession) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/auth|_next|icons|manifest.webmanifest|sw.js|workbox-.*|swe-worker-.*|~offline|favicon.ico).*)"],
};
