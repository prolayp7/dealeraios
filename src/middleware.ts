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

function hasSupabaseSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
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

  // Still unresolved after the retry. Only extend the benefit of the doubt
  // when a session cookie is actually present (checked locally — no network
  // call, so this isn't itself subject to the same flakiness): a request
  // with a plausible-but-unverifiable cookie might be a valid session we
  // failed to confirm over our own connectivity issue, so let it through
  // rather than bounce it. A request with NO cookie at all is unambiguous
  // regardless of network state and falls through to the normal redirect
  // below. Either way this never grants real data access on its own — every
  // /api/* route re-verifies independently via getSessionDealership() (which
  // fails closed on any getUser() error, network or otherwise), and reads
  // that skip that check rely on Postgres RLS, which verifies the JWT
  // locally and doesn't depend on this server's network to Supabase's Auth
  // API at all.
  if (getUserError?.name === "AuthRetryableFetchError" && hasSupabaseSessionCookie(request)) {
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
