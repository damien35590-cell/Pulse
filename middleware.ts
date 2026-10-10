import { withAuth } from "next-auth/middleware";

export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: ["/((?!login|api/auth|_next|icons|manifest.webmanifest|sw.js|workbox-.*|swe-worker-.*|~offline|favicon.ico).*)"],
};
