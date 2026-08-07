function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Facebook's own marketplace keyword search is loose enough to surface
 * unrelated makes/models (e.g. a "mercedes glc300" search returning a Honda
 * Accord), so results must be re-verified against the requested make/model
 * before being returned to the user.
 */
export function listingMatchesSearch(
  title: string,
  make: string,
  model: string
): boolean {
  const normalizedTitle = normalizeForMatch(title);
  if (make && !normalizedTitle.includes(normalizeForMatch(make))) return false;
  if (model && !normalizedTitle.includes(normalizeForMatch(model))) return false;
  return true;
}
