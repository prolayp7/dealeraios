import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

function isPublicPath(pathname: string): boolean {
  // API routes own their auth checks and return 401/403 JSON instead of a
  // redirect — a redirect would hand a fetch() caller an HTML login page.
  if (pathname.startsWith("/api/")) return true;

  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let { data: { user }, error: getUserError } = await supabase.auth.getUser();

  // getUser() calls out to Supabase's Auth server on every request. A
  // transient network hiccup reaching it surfaces as AuthRetryableFetchError
  // — that means "couldn't verify," not "no session" — so one retry before
  // falling back, same distinction Supabase's own client makes internally
  // for retryable vs. terminal auth errors.
  if (getUserError?.name === "AuthRetryableFetchError") {
    ({ data: { user }, error: getUserError } = await supabase.auth.getUser());
  }

  // Still unresolved after the retry: we genuinely don't know if this user
  // is authenticated, so don't bounce a possibly-valid session to /login —
  // let the request through un-gated rather than fail closed on our own
  // connectivity issue.
  if (getUserError?.name === "AuthRetryableFetchError") {
    return response;
  }

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const redirectUrl = new URL("/login", request.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
