import { cookies, headers } from "next/headers";

export type StaffPortalSearchParamValue = string | string[] | undefined;
export type StaffPortalSearchParams = { se?: StaffPortalSearchParamValue; exp?: StaffPortalSearchParamValue; s?: StaffPortalSearchParamValue };

function normalizeSearchParam(value: StaffPortalSearchParamValue): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(";").reduce<Record<string, string>>((acc, part) => {
    const [name, ...rest] = part.split("=");
    const key = name?.trim();
    const value = rest.join("=").trim();
    if (key) acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

function getCookieValue(cookieStore: unknown, name: string): string | undefined {
  if (cookieStore && typeof cookieStore === "object") {
    const getter = (cookieStore as { get?: unknown }).get;
    if (typeof getter === "function") {
      const cookie = getter.call(cookieStore, name);
      if (cookie && typeof cookie === "object") {
        return (cookie as { value?: unknown }).value as string | undefined;
      }
    }
  }

  const cookieHeader = headers().get("cookie");
  const parsed = parseCookieHeader(cookieHeader);
  return parsed[name];
}

export async function getStaffPortalAuth(searchParams: StaffPortalSearchParams): Promise<{ se?: string; exp?: string; s?: string }> {
  let cookieStore: unknown;
  try {
    cookieStore = cookies();
  } catch {
    cookieStore = undefined;
  }

  return {
    se: normalizeSearchParam(searchParams.se) ?? getCookieValue(cookieStore, "staff_se"),
    exp: normalizeSearchParam(searchParams.exp) ?? getCookieValue(cookieStore, "staff_exp"),
    s: normalizeSearchParam(searchParams.s) ?? getCookieValue(cookieStore, "staff_s"),
  };
}
