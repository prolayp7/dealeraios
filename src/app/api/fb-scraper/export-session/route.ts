import { NextResponse } from "next/server";
import { ScraperError } from "@/lib/fb-scraper/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  try {
    const { getMultiloginConfig, startMultiloginProfile, stopMultiloginProfile } =
      await import("@/lib/fb-scraper/multilogin");
    const { connectMultiloginBrowser } = await import("@/lib/fb-scraper/browser-connect");
    const { isLoggedIn, exportCookies } = await import("@/lib/fb-scraper/fb-auth");
    const { saveFbCookies } = await import("@/lib/fb-scraper/cookies");

    const config = await getMultiloginConfig();

    try {
      const session = await startMultiloginProfile(config);
      const browser = await connectMultiloginBrowser(session);

      try {
        const context = browser.contexts()[0];
        if (!context) {
          throw new ScraperError(
            "No browser context from Multilogin profile",
            "MULTILOGIN"
          );
        }
        const page = context.pages()[0] ?? (await context.newPage());

        await page.goto("https://www.facebook.com/marketplace", {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });
        await page.waitForLoadState("networkidle").catch(() => {});

        if (!(await isLoggedIn(page))) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Not logged in in the Multilogin profile. Connect via VNC, log into Facebook in that browser window, then try again.",
            },
            { status: 401 }
          );
        }

        const cookies = await exportCookies(page);
        await saveFbCookies(cookies);

        const fbCookieNames = cookies
          .filter((c) => c.domain.includes("facebook.com"))
          .map((c) => c.name);

        return NextResponse.json({
          success: true,
          message: `Session exported: ${fbCookieNames.length} Facebook cookies saved to data/fb-session.json.`,
          cookieNames: fbCookieNames,
        });
      } finally {
        await browser.close().catch(() => {});
      }
    } finally {
      await stopMultiloginProfile(config);
    }
  } catch (error) {
    console.error("POST /api/fb-scraper/export-session:", error);

    if (error instanceof ScraperError) {
      const statusMap: Record<ScraperError["code"], number> = {
        CONFIG: 500,
        LOGIN: 401,
        TWO_FACTOR: 403,
        BLOCKED: 429,
        MULTILOGIN: 502,
        GOLOGIN: 502,
        SCRAPE: 500,
        PUBLISH: 500,
      };

      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: statusMap[error.code] ?? 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to export Facebook session" },
      { status: 500 }
    );
  }
}
