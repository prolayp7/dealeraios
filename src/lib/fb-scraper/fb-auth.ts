import type { Cookie, Page } from "playwright-core";
import { loadFbCookies, saveFbCookies } from "./cookies";
import { ScraperError } from "./types";

export type BrowserExtensionCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

export function mapExtensionCookies(cookies: BrowserExtensionCookie[]): Cookie[] {
  return cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expirationDate ?? -1,
    httpOnly: c.httpOnly ?? false,
    secure: c.secure ?? false,
    sameSite:
      c.sameSite === "no_restriction"
        ? "None"
        : c.sameSite === "lax"
          ? "Lax"
          : c.sameSite === "strict"
            ? "Strict"
            : "None",
  }));
}

export async function isTwoFactorPage(page: Page): Promise<boolean> {
  const url = page.url();
  if (
    url.includes("two_factor") ||
    url.includes("checkpoint") ||
    url.includes("approvals")
  ) {
    return true;
  }
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return (
    /two[- ]factor|login code|authentication app|confirm your identity/i.test(
      bodyText
    ) && !bodyText.toLowerCase().includes("marketplace")
  );
}

export async function isBlockedPage(page: Page): Promise<boolean> {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return /temporarily blocked|unusual activity|confirm it's you|security check/i.test(
    bodyText
  );
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("/login") || url.includes("two_step_verification")) {
    return false;
  }

  // Facebook can render marketplace as a logged-out guest view (with a "Log in
  // to see more" modal) without redirecting away from the current URL, so a
  // URL check alone produces false positives. Require the actual session
  // cookies, and check for the guest-modal copy as a second signal.
  const cookies = await page.context().cookies();
  const hasAuthCookies =
    cookies.some((c) => c.name === "c_user") &&
    cookies.some((c) => c.name === "xs");
  if (!hasAuthCookies) return false;

  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (/log in to see more|create new account|forgotten( your| an)? account/i.test(bodyText)) {
    return false;
  }

  return true;
}

function parseCookiesFromEnv(rawCookies: string): Cookie[] {
  let parsedCookies: BrowserExtensionCookie[];
  try {
    parsedCookies = JSON.parse(rawCookies) as BrowserExtensionCookie[];
  } catch {
    throw new ScraperError(
      "FB_COOKIES is not valid JSON",
      "CONFIG"
    );
  }

  if (!Array.isArray(parsedCookies) || parsedCookies.length === 0) {
    throw new ScraperError(
      "FB_COOKIES must be a non-empty JSON array",
      "CONFIG"
    );
  }

  return mapExtensionCookies(parsedCookies);
}

export async function resolveCookies(): Promise<Cookie[]> {
  // The saved session file is kept fresh by the "Export FB Session" flow
  // (saveFbCookies), so it must win over FB_COOKIES, which is only a
  // bootstrap seed for first run before any session has been exported.
  const savedCookies = await loadFbCookies();
  if (savedCookies.length > 0) {
    return savedCookies;
  }

  const rawCookies = process.env.FB_COOKIES;
  if (rawCookies) {
    return parseCookiesFromEnv(rawCookies);
  }

  throw new ScraperError(
    "Missing FB_COOKIES in environment and no saved session in data/fb-session.json",
    "CONFIG"
  );
}

export async function exportCookies(page: Page): Promise<Cookie[]> {
  return page.context().cookies();
}

export async function applyCookies(page: Page, cookies: Cookie[]): Promise<void> {
  if (cookies.length === 0) return;
  await page.context().addCookies(cookies);
}

export async function injectCookies(page: Page, cookies?: Cookie[]): Promise<void> {
  const resolvedCookies = cookies ?? (await resolveCookies());

  await page.goto("https://www.facebook.com", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.context().clearCookies();
  await page.context().addCookies(resolvedCookies);
}

export async function loginToFacebook(page: Page, cookies?: Cookie[]): Promise<void> {
  await injectCookies(page, cookies);

  await page.goto("https://www.facebook.com/marketplace", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForLoadState("networkidle").catch(() => {});

  try {
    await page.screenshot({ path: "/tmp/fb-cookie-result.png", timeout: 10000 });
  } catch (error) {
    console.warn(
      "Debug screenshot failed (non-fatal):",
      error instanceof Error ? error.message : error
    );
  }
  console.log("Cookie injection result URL:", page.url());

  if (await isLoggedIn(page)) {
    console.log("Cookie injection successful!");
    const contextCookies = await exportCookies(page);
    await saveFbCookies(contextCookies);
    return;
  }

  if (await isTwoFactorPage(page)) {
    throw new ScraperError(
      "Facebook requires two-factor authentication. Update FB_COOKIES with a fresh session.",
      "TWO_FACTOR"
    );
  }

  if (await isBlockedPage(page)) {
    throw new ScraperError(
      "Facebook blocked access. Update FB_COOKIES with a fresh session.",
      "BLOCKED"
    );
  }

  throw new ScraperError(
    "Cookie injection failed. FB_COOKIES may be expired or invalid — Facebook served a logged-out/guest view.",
    "LOGIN"
  );
}

export async function ensureLoggedIn(page: Page, cookies?: Cookie[]): Promise<void> {
  await loginToFacebook(page, cookies);
  if (await isTwoFactorPage(page)) {
    throw new ScraperError(
      "Facebook requires two-factor authentication. Update FB_COOKIES with a fresh session.",
      "TWO_FACTOR"
    );
  }
}
