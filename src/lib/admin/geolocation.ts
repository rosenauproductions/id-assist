export type GeoLookup = {
  country: string | null;
  region: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
};

const EMPTY_LOOKUP: GeoLookup = {
  country: null,
  region: null,
  city: null,
  lat: null,
  lng: null,
};

// Loopback/private ranges never resolve to anything useful — skip the
// network call entirely for local dev logins.
function isPrivateOrLoopback(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

/**
 * Looks up an IP's rough location via ipapi.co's free, keyless JSON
 * endpoint — the "external geolocation API, not a bundled database" the
 * roadmap called for. Best-effort only: any failure (network, rate limit,
 * a private/local IP, a malformed response) returns all-null fields
 * rather than throwing, since a login must never be blocked or broken by
 * this lookup.
 */
export async function lookupIpLocation(
  ip: string | null,
): Promise<GeoLookup> {
  if (!ip || isPrivateOrLoopback(ip)) return EMPTY_LOOKUP;

  try {
    const response = await fetch(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) return EMPTY_LOOKUP;
    const data: unknown = await response.json();
    if (!data || typeof data !== "object" || "error" in data) {
      return EMPTY_LOOKUP;
    }
    const record = data as Record<string, unknown>;
    return {
      country: typeof record.country_name === "string" ? record.country_name : null,
      region: typeof record.region === "string" ? record.region : null,
      city: typeof record.city === "string" ? record.city : null,
      lat: typeof record.latitude === "number" ? record.latitude : null,
      lng: typeof record.longitude === "number" ? record.longitude : null,
    };
  } catch {
    return EMPTY_LOOKUP;
  }
}
