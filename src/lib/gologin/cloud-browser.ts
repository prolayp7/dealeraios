import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser } from "playwright-core";

chromium.use(StealthPlugin());

const CLOUD_BROWSER_WS = "wss://cloudbrowser.gologin.com/connect";

export async function connectGologinCloudBrowser(
  profileId: string,
  apiToken: string
): Promise<Browser> {
  const wsUrl = `${CLOUD_BROWSER_WS}?token=${encodeURIComponent(apiToken)}&profile=${encodeURIComponent(profileId)}`;
  return chromium.connectOverCDP(wsUrl, { timeout: 30000 });
}
