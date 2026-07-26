export function isAuthorizedCronRequest(
  authHeader: string | null,
  expectedSecret: string | undefined
): boolean {
  if (!expectedSecret) return false;
  if (!authHeader?.startsWith("Bearer ")) return false;
  return authHeader.slice("Bearer ".length) === expectedSecret;
}
