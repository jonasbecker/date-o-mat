import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

// Optimistic check only: no session cookie → straight to the login page.
// The real check (is the session valid?) happens in the data access layer.
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the login page, API routes (they check auth themselves)
  // and static files.
  matcher: ["/((?!login|api|_next/static|_next/image|icon|apple-icon|manifest|sw\\.js|offline\\.html|.*\\.(?:svg|png|jpg|webp|ico)$).*)"],
};
