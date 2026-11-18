type PortalSearchParams = Record<string, string | string[] | undefined>;

export function buildPortalStartUrl(
  pathname: string,
  searchParams: PortalSearchParams
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

export function buildPortalManifestUrl(
  startUrl: string,
  name: string,
  shortName: string
): string {
  const params = new URLSearchParams({
    start_url: startUrl,
    name,
    short_name: shortName,
  });

  return `/api/manifest?${params.toString()}`;
}
