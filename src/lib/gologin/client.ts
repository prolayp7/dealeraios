import { ScraperError } from "../fb-scraper/types";

const GOLOGIN_API = "https://api.gologin.com";

function getApiToken(): string {
  const token = process.env.GOLOGIN_API_TOKEN;
  if (!token) {
    throw new ScraperError("Missing GOLOGIN_API_TOKEN in environment", "CONFIG");
  }
  return token;
}

export async function createGologinProfile(label: string): Promise<string> {
  const token = getApiToken();

  const response = await fetch(`${GOLOGIN_API}/browser`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ name: label, os: "lin" }),
  });

  const rawText = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch {
    // body stays {}; rawText below still carries whatever the server sent
  }

  if (!response.ok) {
    throw new ScraperError(
      `GoLogin profile creation failed (HTTP ${response.status}): ${rawText || "(empty body)"}`,
      "GOLOGIN"
    );
  }

  // GoLogin's create-profile response shape has been observed to vary across
  // API versions (flat `id` vs nested under `data`) — same defensive
  // extraction pattern as createMultiloginProfile in multilogin.ts. Confirm
  // the exact field name against the linked Postman collection
  // (documenter.getpostman.com/view/21126834/Uz5GnvaL) the first time this
  // runs against the real API.
  const data = body?.data as Record<string, unknown> | undefined;
  const profileId = body?.id ?? data?.id ?? body?.profileId;
  if (!profileId || typeof profileId !== "string") {
    throw new ScraperError(
      `GoLogin profile creation did not return a profile id (HTTP ${response.status}): ${rawText || "(empty body)"}`,
      "GOLOGIN"
    );
  }

  return profileId;
}

export async function deleteGologinProfile(profileId: string): Promise<void> {
  const token = getApiToken();

  const response = await fetch(`${GOLOGIN_API}/browser/${profileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new ScraperError(
      `GoLogin profile deletion failed (HTTP ${response.status}): ${body || "(empty body)"}`,
      "GOLOGIN"
    );
  }
}

export async function verifyGologinToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`${GOLOGIN_API}/browser/v2`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
