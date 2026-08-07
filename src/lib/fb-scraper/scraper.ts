import type { Browser, BrowserContext, Cookie, Page } from "playwright-core";
import { ensureLoggedIn, isBlockedPage } from "./fb-auth";
import {
  humanScroll,
  randomDelay,
} from "./human-behavior";
import {
  getMultiloginConfig,
  startMultiloginProfile,
  stopMultiloginProfile,
} from "./multilogin";
import { connectMultiloginBrowser } from "./browser-connect";
import { listingMatchesSearch } from "./listing-match";
import {
  FbListing,
  FbSearchParams,
  FbSearchResult,
  ScraperError,
} from "./types";

function parsePrice(text: string): number | null {
  const match = text.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  return match ? Math.round(parseFloat(match[1])) : null;
}

function parseMileage(text: string): number | null {
  const match = text.match(/(\d[\d,]*)\s*(?:mi\b|miles?\b|km\b)/i);
  if (!match) return null;
  const value = parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function parseDaysListed(text: string): number | null {
  const lower = text.toLowerCase();
  if (lower.includes("just listed") || lower.includes("today")) return 0;
  const match = lower.match(/(\d+)\s*(?:day|week|month|hour)/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (lower.includes("week")) return n * 7;
  if (lower.includes("month")) return n * 30;
  if (lower.includes("hour")) return 0;
  return n;
}

function parseYearFromTitle(title: string): number | null {
  const match = title.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

function buildSearchQuery(params: FbSearchParams): string {
  const parts: string[] = [];
  if (params.yearFrom && params.yearTo && params.yearFrom === params.yearTo) {
    parts.push(String(params.yearFrom));
  }
  if (params.make) parts.push(params.make);
  if (params.model) parts.push(params.model);
  return parts.join(" ").trim();
}

const LISTING_SELECTORS = [
  'div[data-testid="marketplace-search-feed-item"]',
  'div[class*="x9f619"][class*="x1n2onr6"]',
  'a[href*="/marketplace/item/"]',
] as const;

// Facebook's marketplace feed is a client-rendered SPA whose render time
// varies run-to-run (cold profile load, account switch, network jitter) — a
// fixed sleep either wastes time or, worse, resolves before results have
// actually rendered, causing extraction to see an empty feed even though the
// search genuinely has matches. Wait for the real condition instead.
async function waitForMarketplaceListings(page: Page, timeoutMs = 15000): Promise<void> {
  await page
    .waitForSelector('a[href*="/marketplace/item/"]', { timeout: timeoutMs })
    .catch(() => {
      console.warn(
        `No marketplace item links appeared within ${timeoutMs}ms — feed may genuinely be empty`
      );
    });
}

async function logListingSelectorCounts(page: Page): Promise<void> {
  for (const selector of LISTING_SELECTORS) {
    const count = await page.locator(selector).count();
    console.log(`Selector "${selector}" found ${count} elements`);
  }
}

async function loginToFacebook(page: Page, cookies?: Cookie[]): Promise<void> {
  await ensureLoggedIn(page, cookies);
}

async function setMarketplaceLocation(
  page: Page,
  location: string,
  radius: number
): Promise<void> {
  if (!location.trim()) return;

  try {
    // On the real desktop layout the location/radius control is an always-visible
    // pill in the sidebar (e.g. "Stroudsburg, Pennsylvania · Within 39 mi"), not
    // an input hidden behind a "Filters" button — click it to open the editor
    // popup that actually contains the editable location input.
    const locationPill = page.getByText(/within\s+\d+\s*(mi|km)/i).first();
    const pillVisible = await locationPill
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (pillVisible) {
      const pillBox = await locationPill.boundingBox().catch(() => null);
      console.log("Location pill bounding box:", JSON.stringify(pillBox));

      const pillClicked = await locationPill
        .click({ timeout: 5000 })
        .then(() => true)
        .catch(async (error) => {
          console.warn("Location pill found but click failed/timed out:", error);
          await page
            .screenshot({ path: "/tmp/fb-location-pill-click-fail.png", timeout: 10000 })
            .catch((screenshotError) =>
              console.warn("Debug screenshot for pill-click failure also failed:", screenshotError)
            );
          return false;
        });
      if (pillClicked) {
        await randomDelay(1000, 1800);
      }
    } else {
      console.warn(
        'Marketplace location pill ("Within X mi") not found — trying to find the location input directly as a fallback'
      );
    }

    const locationInput = page
      .locator(
        'input[aria-label*="Location"], input[placeholder*="Location"], input[placeholder*="location"]'
      )
      .first();

    const inputVisible = await locationInput
      .waitFor({ state: "visible", timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (!inputVisible) {
      console.warn(
        `Marketplace location input not found after opening the location editor (wanted "${location}") — location filter was not applied`
      );
      return;
    }

    await locationInput.click();
    await randomDelay();
    await locationInput.fill(location);

    const suggestion = page
      .locator('[role="option"], [role="listbox"] [role="option"]')
      .first();
    const suggestionAppeared = await suggestion
      .waitFor({ state: "visible", timeout: 4000 })
      .then(() => true)
      .catch(() => false);

    if (suggestionAppeared) {
      // The dropdown can already be showing a stale/default suggestion (from
      // focus-time, before Facebook's debounced autocomplete re-queries for
      // what was just typed) at the exact moment it becomes "visible" — that
      // race is what previously caused the location filter to silently lock
      // onto an unrelated city (e.g. picking "Ashburn, Virginia" for a
      // requested NJ zip). Poll until the option text stops changing before
      // trusting it, instead of clicking whatever is visible first.
      let suggestionText = await suggestion.innerText().catch(() => "");
      for (let i = 0; i < 4; i++) {
        await randomDelay(300, 500);
        const nextText = await suggestion.innerText().catch(() => suggestionText);
        if (nextText === suggestionText) break;
        suggestionText = nextText;
      }

      await suggestion.click();
      await randomDelay();
      console.log(
        `Marketplace location set via suggestion: "${suggestionText}" (requested "${location}")`
      );
    } else {
      await page.keyboard.press("Enter");
      await randomDelay();
      console.warn(
        `No location suggestion dropdown appeared for "${location}" — pressed Enter as fallback, filter may not have applied correctly`
      );
    }

    const radiusSelect = page
      .locator('[role="combobox"], button, [aria-haspopup="listbox"]')
      .filter({ hasText: /\d+\s*(mi|miles|km)\b/i })
      .first();
    if ((await radiusSelect.count()) > 0) {
      await radiusSelect.click();
      await randomDelay();

      // Facebook only offers a fixed set of radius increments (e.g. 20, 39, 40,
      // 60...) — there is usually no exact match for an arbitrary requested
      // value, so pick the closest available option instead of demanding one.
      const optionLocator = page.locator('[role="option"]');
      const availableOptions = await optionLocator.allInnerTexts().catch(() => []);

      const parsed = availableOptions
        .map((text, index) => {
          const match = text.match(/(\d+)\s*(mi|miles|km)\b/i);
          return match ? { index, value: parseInt(match[1], 10) } : null;
        })
        .filter((entry): entry is { index: number; value: number } => entry !== null);

      if (parsed.length > 0) {
        const notExceeding = parsed.filter((entry) => entry.value <= radius);
        const best = (notExceeding.length > 0 ? notExceeding : parsed).reduce(
          (closest, entry) =>
            Math.abs(entry.value - radius) < Math.abs(closest.value - radius)
              ? entry
              : closest
        );

        await optionLocator.nth(best.index).click();
        await randomDelay();
        console.log(
          `Radius requested "${radius} mi" — no exact option, selected closest available: "${availableOptions[best.index]}"`
        );
      } else {
        console.warn(
          `No parseable radius options found in dropdown. Available options:`,
          JSON.stringify(availableOptions)
        );
      }
    } else {
      console.warn("Radius selector control not found near location input");
    }

    const currentValue = await locationInput.inputValue().catch(() => null);
    console.log(
      `Marketplace location input value after selection: "${currentValue}"`
    );

    // The location/radius selections take effect live, but the "Change
    // location" modal itself stays open until its own Apply button is
    // clicked — and its backdrop blocks every click to the rest of the page
    // until it's closed, breaking every step that runs after this one.
    // Facebook's "Apply" here is a styled div[role="button"], not a native
    // <button>, so use the ARIA-aware role locator rather than a CSS tag
    // selector that would never match it.
    const modalApplyButton = page.getByRole("button", { name: "Apply", exact: true });
    if (await clickIfVisible(modalApplyButton, "Change location modal Apply button")) {
      await randomDelay(1000, 1800);
    }
  } catch (error) {
    console.warn("Could not set marketplace location:", error);
  }
}

async function clickIfVisible(
  locator: ReturnType<Page["locator"]>,
  label: string
): Promise<boolean> {
  const visible = await locator
    .first()
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (!visible) {
    console.warn(`${label} not found/visible`);
    return false;
  }

  return locator
    .first()
    .click({ timeout: 3000 })
    .then(() => true)
    .catch((error) => {
      console.warn(`${label} matched but click failed/timed out:`, error);
      return false;
    });
}

async function fillFilterField(
  page: Page,
  labels: string[],
  value: string | number
): Promise<void> {
  for (const label of labels) {
    const field = page.getByLabel(label, { exact: false }).first();
    if ((await field.count()) > 0) {
      await field.fill(String(value));
      await randomDelay(300, 700);
      return;
    }
  }
}

async function applyMarketplaceFilters(
  page: Page,
  params: FbSearchParams
): Promise<void> {
  try {
    // Some layouts still gate extra filters behind a "Filters" button, but on
    // the standard desktop search-results page Price/Location are already
    // visible in the sidebar with no button to click — treat this as
    // best-effort rather than a hard prerequisite.
    const filtersButton = page.locator(
      'button:has-text("Filters"), [aria-label*="Filters"], a:has-text("Filters")'
    );

    if (await clickIfVisible(filtersButton, "Filters button")) {
      await randomDelay(1500, 2500);
    }

    await setMarketplaceLocation(page, params.location, params.radius);

    // Year/mileage fields aren't in the generic keyword-search sidebar, and
    // switching into Facebook's "Vehicles" category to look for them lands on
    // the unfiltered category browse page — discarding the make/model search
    // query entirely and leaking unrelated listings into the results. Year,
    // mileage, price, make, and model are all enforced afterwards in
    // extractListings instead, so no UI-level filter fields are needed here.

    if (params.priceMin > 0) {
      await fillFilterField(page, ["Min price", "Minimum price", "Price from"], params.priceMin);
    }
    if (params.priceMax > 0) {
      await fillFilterField(page, ["Max price", "Maximum price", "Price to"], params.priceMax);
    }
    if (params.yearFrom > 0) {
      await fillFilterField(page, ["Min year", "Year from", "From year"], params.yearFrom);
    }
    if (params.yearTo > 0) {
      await fillFilterField(page, ["Max year", "Year to", "To year"], params.yearTo);
    }
    if (params.mileageMax > 0) {
      await fillFilterField(
        page,
        ["Max mileage", "Maximum mileage", "Mileage"],
        params.mileageMax
      );
    }

    const applyButton = page.locator(
      'button:has-text("Apply"), button:has-text("Show results"), [aria-label*="Apply"]'
    );
    if (await clickIfVisible(applyButton, "Apply/Show results button")) {
      await randomDelay(2000, 3500);
    }
  } catch (error) {
    console.warn("Could not apply all marketplace filters via UI:", error);
  }
}

async function extractListings(
  page: Page,
  params: FbSearchParams
): Promise<FbSearchResult> {
  const seen = new Set<string>();
  const results: FbListing[] = [];
  const skipCount = params.resultBatch * params.resultLimit;
  let skipped = 0;
  let scrollAttempts = 0;
  let feedExhausted = false;
  const maxScrollAttempts = Math.max(
    15,
    Math.ceil((skipCount + params.resultLimit) / 8) + 10
  );

  while (results.length < params.resultLimit) {
    const batch = await page.evaluate(() => {
      const items: Array<{
        title: string;
        priceText: string;
        locationText: string;
        daysText: string;
        url: string;
      }> = [];
      const seenUrls = new Set<string>();

      const addFromAnchor = (link: Element) => {
        const anchor = link as HTMLAnchorElement;
        const href = anchor.href?.split("?")[0];
        if (!href || !href.includes("/marketplace/item/") || seenUrls.has(href)) {
          return;
        }
        seenUrls.add(href);

        const aria = anchor.getAttribute("aria-label") || "";
        const card =
          anchor.closest('[data-testid="marketplace-search-feed-item"]') ||
          anchor.closest('[data-testid="marketplace-item"]') ||
          anchor.closest('[role="article"]') ||
          anchor.parentElement?.parentElement;

        const cardText = card?.textContent?.replace(/\s+/g, " ").trim() || "";
        const combined = `${aria} ${cardText}`.trim();

        const priceMatch = combined.match(/\$[\d,]+(?:\.\d{2})?/);
        const title =
          aria.split(".")[0]?.trim() ||
          combined.split("$")[0]?.trim() ||
          "Marketplace listing";

        items.push({
          title,
          priceText: priceMatch?.[0] || "",
          locationText: combined,
          daysText: combined,
          url: href,
        });
      };

      document
        .querySelectorAll(
          'div[data-testid="marketplace-search-feed-item"] a[href*="/marketplace/item/"]'
        )
        .forEach(addFromAnchor);

      document.querySelectorAll('a[href*="/marketplace/item/"]').forEach(addFromAnchor);

      return items;
    });

    // A real make/model search on Facebook Marketplace essentially never
    // returns zero raw item links on the very first pass, even for a narrow
    // query — it pads with nearby/similar listings. Seeing none here (after
    // waitForMarketplaceListings already gave the feed up to 15s to render)
    // is a strong signal the account is being rate-limited/soft-blocked by
    // Facebook rather than that there are genuinely no matching vehicles —
    // surface that distinction instead of silently reporting "0 listings".
    if (scrollAttempts === 0 && batch.length === 0 && (params.make || params.model)) {
      throw new ScraperError(
        "Facebook Marketplace returned an empty feed for this search. This usually means the account is temporarily rate-limited or soft-blocked rather than that there are no matching listings — wait a while before retrying, or rotate to a different marketplace account.",
        "BLOCKED"
      );
    }

    for (const item of batch) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);

      if (skipped < skipCount) {
        skipped++;
        continue;
      }

      if (!listingMatchesSearch(item.title, params.make, params.model)) continue;

      const price = parsePrice(item.priceText);
      const mileage = parseMileage(item.title + " " + item.locationText);
      const daysListed = parseDaysListed(item.daysText);
      const year =
        parseYearFromTitle(item.title) ||
        (params.yearFrom === params.yearTo ? params.yearFrom : null);

      if (params.priceMin > 0 && price != null && price < params.priceMin) continue;
      if (params.priceMax > 0 && price != null && price > params.priceMax) continue;
      if (params.mileageMax > 0 && mileage != null && mileage > params.mileageMax) {
        continue;
      }
      if (year != null) {
        if (params.yearFrom > 0 && year < params.yearFrom) continue;
        if (params.yearTo > 0 && year > params.yearTo) continue;
      }

      results.push({
        title: item.title,
        price,
        mileage,
        location: extractLocation(item.locationText),
        daysListed,
        url: item.url,
        year,
        make: params.make || null,
        model: params.model || null,
      });

      if (results.length >= params.resultLimit) break;
    }

    if (results.length >= params.resultLimit) break;

    const previousCount = seen.size;
    await humanScroll(page, 3);
    await randomDelay(1500, 2500);
    scrollAttempts++;

    const newCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href*="/marketplace/item/"]').length;
    });

    if (newCount <= previousCount || scrollAttempts >= maxScrollAttempts) {
      feedExhausted = true;
      break;
    }
  }

  if (skipped < skipCount) {
    feedExhausted = true;
  }

  const listings = results.slice(0, params.resultLimit);
  return {
    results: listings,
    resultBatch: params.resultBatch,
    skipCount,
    hasMore: listings.length >= params.resultLimit && !feedExhausted,
  };
}

function extractLocation(text: string): string | null {
  const patterns = [
    /(?:in|at)\s+([A-Za-z\s]+,\s*[A-Z]{2})/i,
    /([A-Za-z\s]+,\s*[A-Z]{2}\s*\d{0,5})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

async function logMarketplaceSearchState(page: Page): Promise<void> {
  try {
    await page.screenshot({ path: "/tmp/fb-marketplace.png", timeout: 10000 });
  } catch (error) {
    console.warn(
      "Debug screenshot failed (non-fatal):",
      error instanceof Error ? error.message : error
    );
  }
  console.log("Marketplace URL:", page.url());
  console.log("Marketplace title:", await page.title());
  await logListingSelectorCounts(page);
}

async function runMarketplaceSearch(
  page: Page,
  params: FbSearchParams
): Promise<void> {
  if (!page.url().includes("marketplace")) {
    throw new ScraperError(
      "Not on Facebook Marketplace after cookie injection",
      "LOGIN"
    );
  }

  const query = buildSearchQuery(params);
  if (!query) {
    console.log("No search query provided, using current marketplace page");
    await page.waitForLoadState("networkidle").catch(() => {});
    await waitForMarketplaceListings(page);
    await logMarketplaceSearchState(page);
    return;
  }

  console.log(`Searching marketplace in-page for: ${query}`);

  const marketplaceSearch = page
    .locator('input[aria-label="Search Marketplace"]')
    .first();

  if ((await marketplaceSearch.count()) === 0) {
    console.log("Search Marketplace input not found, trying search icon...");
    const searchIcon = page
      .locator(
        '[aria-label*="Search"], button[aria-label*="Search"], [role="button"][aria-label*="Search"]'
      )
      .first();

    if ((await searchIcon.count()) > 0) {
      await searchIcon.click({ force: true });
      await page.waitForTimeout(1000);
    }
  }

  let searchInput = page
    .locator('input[aria-label="Search Marketplace"]')
    .first();

  if ((await searchInput.count()) === 0) {
    searchInput = page
      .locator('input[placeholder*="Search"], input[aria-label*="Search"]')
      .first();
  }

  if ((await searchInput.count()) === 0) {
    throw new ScraperError(
      "Could not find marketplace search box on current page",
      "SCRAPE"
    );
  }

  await searchInput.click({ force: true });
  await searchInput.fill(query);
  await page.waitForTimeout(1000);
  await page.keyboard.press("Enter");
  await waitForMarketplaceListings(page);

  if (page.url().includes("login")) {
    throw new ScraperError(
      "Lost Facebook session during in-page marketplace search",
      "LOGIN"
    );
  }

  await logMarketplaceSearchState(page);
}

async function scrapeWithPage(
  page: Page,
  params: FbSearchParams,
  isRetry: boolean,
  cookies?: Cookie[]
): Promise<FbSearchResult> {
  await page.setViewportSize({
    width: 1366 + Math.floor(Math.random() * 200),
    height: 768 + Math.floor(Math.random() * 100),
  });

  await loginToFacebook(page, cookies);

  console.log("Staying on marketplace page, searching in-page...");
  console.log("Current URL:", page.url());

  await runMarketplaceSearch(page, params);

  if (await isBlockedPage(page)) {
    if (!isRetry) {
      console.warn("Blocked on marketplace, waiting and retrying once...");
      await randomDelay(5000, 8000);
      return scrapeWithPage(page, params, true, cookies);
    }
    throw new ScraperError(
      "Facebook blocked marketplace access. Wait and try again.",
      "BLOCKED"
    );
  }

  await applyMarketplaceFilters(page, params);

  // Changing location/radius triggers an async feed refresh — give Facebook
  // time to swap in the new results before scrolling/collecting, otherwise
  // extraction can capture a mix of stale (pre-change) and fresh listing
  // cards, or even an empty feed if it scrapes mid-reload.
  await page.waitForLoadState("networkidle").catch(() => {});
  await waitForMarketplaceListings(page);
  await randomDelay(500, 1000);

  await humanScroll(page, 2);

  return extractListings(page, params);
}

async function getBrowserContext(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
}> {
  const context = browser.contexts()[0];
  if (!context) {
    throw new ScraperError(
      "No browser context from Multilogin profile",
      "MULTILOGIN"
    );
  }

  const page = context.pages()[0] ?? (await context.newPage());
  return { context, page };
}

export async function scrapeFacebookMarketplace(
  params: FbSearchParams,
  dealershipId: string
): Promise<FbSearchResult> {
  const { createServerClient } = await import("@/lib/supabase/server");
  const { getNextActiveAccount, markAccountUsed } = await import(
    "@/lib/marketplace-accounts/rotation"
  );
  const { getMultiloginConfigForProfile } = await import("./multilogin");

  const supabase = await createServerClient();

  let account: Awaited<ReturnType<typeof getNextActiveAccount>> = null;
  let config: Awaited<ReturnType<typeof getMultiloginConfig>>;
  try {
    account = await getNextActiveAccount(supabase, dealershipId);
    config = account
      ? await getMultiloginConfigForProfile(account.multiloginProfileId, account.multiloginFolderId)
      : await getMultiloginConfig();
  } catch (error) {
    console.error("Marketplace account rotation failed, falling back to env-var config:", error);
    account = null;
    config = await getMultiloginConfig();
  }

  let browser: Browser | null = null;

  try {
    const session = await startMultiloginProfile(config);
    await randomDelay(2000, 3000);

    browser = await connectMultiloginBrowser(session);

    const { page } = await getBrowserContext(browser);
    const searchResult = await scrapeWithPage(page, params, false, account?.cookies);

    console.log(
      `FB scraper: found ${searchResult.results.length} listings (batch ${params.resultBatch}, skipped ${searchResult.skipCount}) for ${params.make} ${params.model}`
    );

    return searchResult;
  } catch (error) {
    if (error instanceof ScraperError) throw error;
    console.error("FB scraper error:", error);
    throw new ScraperError(
      error instanceof Error ? error.message : "Unknown scraping error",
      "SCRAPE"
    );
  } finally {
    if (account) {
      await markAccountUsed(supabase, account.id).catch((err) =>
        console.error("Failed to record marketplace account usage (non-fatal):", err)
      );
    }
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error("Error closing browser:", error);
      }
    }
    await stopMultiloginProfile(config);
  }
}

export function parseSearchParams(body: Record<string, unknown>): FbSearchParams {
  return {
    make: String(body.make ?? "").trim(),
    model: String(body.model ?? "").trim(),
    yearFrom: Number(body.yearFrom) || 0,
    yearTo: Number(body.yearTo) || 0,
    mileageMax: Number(body.mileageMax) || 0,
    priceMin: Number(body.priceMin) || 0,
    priceMax: Number(body.priceMax) || 0,
    location: String(body.location ?? "").trim(),
    radius: Number(body.radius) || 25,
    resultLimit: Number(body.resultLimit) || 25,
    resultBatch: Math.max(0, Number(body.resultBatch) || 0),
  };
}
