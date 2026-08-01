export interface BrowserExtensionCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expirationDate?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateCookiesField(value: unknown): ValidationResult<BrowserExtensionCookie[]> {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: "cookies must be a non-empty array" };
  }
  const allValid = value.every(
    (c) =>
      isPlainObject(c) &&
      typeof c.name === "string" &&
      typeof c.value === "string" &&
      typeof c.domain === "string" &&
      typeof c.path === "string"
  );
  if (!allValid) {
    return {
      ok: false,
      error: "each cookie must have name, value, domain, and path",
    };
  }
  return { ok: true, value: value as BrowserExtensionCookie[] };
}

export function validateCreateAccountBody(
  body: unknown
): ValidationResult<{
  label: string;
  cookies: BrowserExtensionCookie[];
  multiloginProfileId?: string;
}> {
  if (!isPlainObject(body)) {
    return { ok: false, error: "label is required" };
  }

  const rawLabel = body.label;
  if (typeof rawLabel !== "string" || rawLabel.trim().length === 0) {
    return { ok: false, error: "label is required" };
  }

  const cookiesResult = validateCookiesField(body.cookies);
  if (!cookiesResult.ok) return cookiesResult;

  const value: { label: string; cookies: BrowserExtensionCookie[]; multiloginProfileId?: string } = {
    label: rawLabel.trim(),
    cookies: cookiesResult.value,
  };

  // Optional escape hatch: skip Multilogin's (currently unreliable) profile-create
  // API and attach an existing profile — created by hand in the Multilogin
  // desktop app — directly instead.
  if ("multiloginProfileId" in body && body.multiloginProfileId !== undefined && body.multiloginProfileId !== "") {
    if (typeof body.multiloginProfileId !== "string" || body.multiloginProfileId.trim().length === 0) {
      return { ok: false, error: "multiloginProfileId must be a non-empty string when provided" };
    }
    value.multiloginProfileId = body.multiloginProfileId.trim();
  }

  return { ok: true, value };
}

export function validateUpdateAccountBody(
  body: unknown
): ValidationResult<{ label?: string; cookies?: BrowserExtensionCookie[] }> {
  if (!isPlainObject(body) || (!("label" in body) && !("cookies" in body))) {
    return {
      ok: false,
      error: "at least one of label or cookies must be provided",
    };
  }

  const value: { label?: string; cookies?: BrowserExtensionCookie[] } = {};

  if ("label" in body) {
    if (typeof body.label !== "string" || body.label.trim().length === 0) {
      return { ok: false, error: "label must be a non-empty string" };
    }
    value.label = body.label.trim();
  }

  if ("cookies" in body) {
    const cookiesResult = validateCookiesField(body.cookies);
    if (!cookiesResult.ok) return cookiesResult;
    value.cookies = cookiesResult.value;
  }

  return { ok: true, value };
}
