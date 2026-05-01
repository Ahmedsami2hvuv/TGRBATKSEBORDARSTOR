import { isLottieDirectAssetUrl } from "./icon-utils";

export type IconConfig = {
  url: string;
  type: 'image' | 'lottie' | 'svg' | 'emoji' | 'gif';
  width?: number;
  height?: number;
  renderMode?: "no_upscale" | "fill";
};

export type GlobalIconsConfig = Record<string, IconConfig>;

export { isLottieDirectAssetUrl };

const CLIENT_ICONS_CACHE_KEY = "kse:global-icons-cache:v1";
const CLIENT_ICONS_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const SERVER_ICONS_CACHE_MAX_AGE_MS = 60 * 1000;

const DEFAULT_ICONS: GlobalIconsConfig = {
  "loading_main": {
    url: "https://lottie.host/54e33590-d50d-495c-9c99-4a0050868a2d/7vGv1DkXy9.json",
    type: "lottie"
  },
  "order_received": {
    url: "💵",
    type: "emoji"
  },
  "order_delivered": {
    url: "🚚",
    type: "emoji"
  },
  "preparer_delegate": {
    url: "👤",
    type: "emoji"
  },
  "admin_pricing": {
    url: "💰",
    type: "emoji"
  },
  "admin_delete": {
    url: "🗑️",
    type: "emoji"
  },
  "store_cart": {
    url: "🛒",
    type: "emoji"
  },
  "store_favorites": {
    url: "❤️",
    type: "emoji"
  },
  "store_favorites_empty": {
    url: "🤍",
    type: "emoji"
  },
  "ui_whatsapp": {
    url: "💬",
    type: "emoji"
  },
  "ui_link": {
    url: "🔗",
    type: "emoji"
  },
  "ui_copy": {
    url: "📋",
    type: "emoji"
  },
  "ui_error": {
    url: "❌",
    type: "emoji"
  },
  "ui_package": {
    url: "📦",
    type: "emoji"
  },
  "ui_edit": {
    url: "✏️",
    type: "emoji"
  },
  "ui_delete": {
    url: "🗑️",
    type: "emoji"
  },
  "ui_visibility_on": {
    url: "👁️",
    type: "emoji"
  },
  "ui_visibility_off": {
    url: "🕶️",
    type: "emoji"
  },
  "ui_success": {
    url: "✅",
    type: "emoji"
  },
  "ui_warning": {
    url: "⚠️",
    type: "emoji"
  },
  "ui_search": {
    url: "🔍",
    type: "emoji"
  },
  "ui_location": {
    url: "📍",
    type: "emoji"
  },
  "ui_user": {
    url: "👤",
    type: "emoji"
  },
  "ui_home": {
    url: "🏠",
    type: "emoji"
  },
  "ui_time": {
    url: "🕒",
    type: "emoji"
  },
  "wallet_out": {
    url: "📤",
    type: "emoji"
  },
  "wallet_in": {
    url: "📥",
    type: "emoji"
  },
  "wallet_pending": {
    url: "🔄",
    type: "emoji"
  },
  "wallet_remain": {
    url: "💰",
    type: "emoji"
  },
  "wallet_cash": {
    url: "💵",
    type: "emoji"
  },
  "wallet_earnings": {
    url: "💰",
    type: "emoji"
  },
  "wallet_admin": {
    url: "🏛️",
    type: "emoji"
  },
  "wallet_tips_daily": {
    url: "🎁",
    type: "emoji"
  },
  "wallet_tips_monthly": {
    url: "🗓️",
    type: "emoji"
  },
  "ui_alert": {
    url: "🚨",
    type: "emoji"
  },
  "ui_number": {
    url: "🔢",
    type: "emoji"
  },
  "ui_call": {
    url: "📞",
    type: "emoji"
  },
  "ui_play": {
    url: "▶️",
    type: "emoji"
  },
  "ui_pause": {
    url: "⏸",
    type: "emoji"
  },
  "ui_close": {
    url: "✕",
    type: "emoji"
  },
  "ui_external_link": {
    url: "↗",
    type: "emoji"
  },
  "ui_audio": {
    url: "🎤",
    type: "emoji"
  },
  "ui_shop": {
    url: "🏢",
    type: "emoji"
  },
  "ui_note": {
    url: "📝",
    type: "emoji"
  },
  "ui_tasks": {
    url: "📋",
    type: "emoji"
  },
  "ui_flash": {
    url: "⚡",
    type: "emoji"
  },
  "ui_chevron_up": {
    url: "▲",
    type: "emoji"
  },
  "ui_chevron_down": {
    url: "▼",
    type: "emoji"
  },
  "ui_add": {
    url: "➕",
    type: "emoji"
  },
  "ui_box": {
    url: "📦",
    type: "emoji"
  },
  "ui_settings": {
    url: "⚙️",
    type: "emoji"
  },
  "ui_globe": {
    url: "🌐",
    type: "emoji"
  },
  "ui_chart": {
    url: "📊",
    type: "emoji"
  },
  "ui_print": {
    url: "🖨️",
    type: "emoji"
  },
  "ui_refresh": {
    url: "🔄",
    type: "emoji"
  },
  "ui_tag": {
    url: "🏷️",
    type: "emoji"
  },
  "ui_salary": {
    url: "💰",
    type: "emoji"
  },
  "ui_shops": {
    url: "🏪",
    type: "emoji"
  },
  "ui_inbox": {
    url: "📥",
    type: "emoji"
  },
  "ui_announcement": {
    url: "📣",
    type: "emoji"
  },
  "ui_user_add": {
    url: "👤➕",
    type: "emoji"
  },
  "ui_users": {
    url: "👥",
    type: "emoji"
  },
  "ui_courier": {
    url: "🏍️",
    type: "emoji"
  },
  "ui_map": {
    url: "🗺️",
    type: "emoji"
  },
  "ui_preparer": {
    url: "👨‍🍳",
    type: "emoji"
  },
  "ui_supplier": {
    url: "🍎",
    type: "emoji"
  },
  "ui_employee": {
    url: "🧑‍💼",
    type: "emoji"
  },
  "ui_ai": {
    url: "🤖",
    type: "emoji"
  },
  "ui_admin_crown": {
    url: "👑",
    type: "emoji"
  },
  "ui_notification": {
    url: "🔔",
    type: "emoji"
  },
  "ui_wallet": {
    url: "👛",
    type: "emoji"
  },
  "ui_star": {
    url: "⭐",
    type: "emoji"
  },
  "ui_camera": {
    url: "📷",
    type: "emoji"
  },
  "ui_gallery": {
    url: "🖼️",
    type: "emoji"
  },
  "ui_undo": {
    url: "↩️",
    type: "emoji"
  },
  "finance_deficit": {
    url: "🔴",
    type: "emoji"
  },
  "finance_excess": {
    url: "🟢",
    type: "emoji"
  },
  "finance_sader_deficit": {
    url: "📉",
    type: "emoji"
  },
  "finance_sader_excess": {
    url: "📈",
    type: "emoji"
  },
  "ui_arrow_right": {
    url: "←",
    type: "emoji"
  },
  "wallet": {
    url: "👛",
    type: "emoji"
  },
  "ui_gps": {
    url: "📍",
    type: "emoji"
  },
  "ui_image": {
    url: "🖼️",
    type: "emoji"
  },
  "ui_eye": {
    url: "👁️",
    type: "emoji"
  },
  "ui_eye_off": {
    url: "🕶️",
    type: "emoji"
  },
  "ui_earnings": {
    url: "💰",
    type: "emoji"
  },
  "ui_plus": {
    url: "➕",
    type: "emoji"
  }
};

let clientIconsCache: GlobalIconsConfig | null = null;
let clientIconsCacheAt = 0;
let clientIconsPromise: Promise<GlobalIconsConfig> | null = null;
let serverIconsCache: GlobalIconsConfig | null = null;
let serverIconsCacheAt = 0;

function mergeWithDefaults(data: unknown): GlobalIconsConfig {
  if (!data || typeof data !== "object") {
    return DEFAULT_ICONS;
  }
  return { ...DEFAULT_ICONS, ...(data as GlobalIconsConfig) };
}

function getClientCachedIcons(): GlobalIconsConfig | null {
  const now = Date.now();
  if (clientIconsCache && now - clientIconsCacheAt < CLIENT_ICONS_CACHE_MAX_AGE_MS) {
    return clientIconsCache;
  }
  try {
    const raw = window.sessionStorage.getItem(CLIENT_ICONS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t?: number; data?: unknown };
    if (!parsed || typeof parsed.t !== "number") return null;
    if (now - parsed.t >= CLIENT_ICONS_CACHE_MAX_AGE_MS) return null;
    const merged = mergeWithDefaults(parsed.data);
    clientIconsCache = merged;
    clientIconsCacheAt = parsed.t;
    return merged;
  } catch {
    return null;
  }
}

function setClientCachedIcons(data: GlobalIconsConfig) {
  const now = Date.now();
  clientIconsCache = data;
  clientIconsCacheAt = now;
  try {
    window.sessionStorage.setItem(CLIENT_ICONS_CACHE_KEY, JSON.stringify({ t: now, data }));
  } catch {
    // Ignore storage failures silently (private mode/quota).
  }
}

export async function getGlobalIcons(): Promise<GlobalIconsConfig> {
  if (typeof window !== "undefined") {
    if (clientIconsPromise) return clientIconsPromise;

    clientIconsPromise = (async () => {
      try {
        const res = await fetch("/api/admin/settings/icons", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) {
          const cached = getClientCachedIcons();
          return cached ?? DEFAULT_ICONS;
        }
        const data = (await res.json()) as GlobalIconsConfig;
        const merged = mergeWithDefaults(data);
        setClientCachedIcons(merged);
        return merged;
      } catch (e) {
        console.error("Failed to fetch global icons (client):", e);
        const cached = getClientCachedIcons();
        return cached ?? DEFAULT_ICONS;
      } finally {
        clientIconsPromise = null;
      }
    })();

    return clientIconsPromise;
  }

  const now = Date.now();
  if (serverIconsCache && now - serverIconsCacheAt < SERVER_ICONS_CACHE_MAX_AGE_MS) {
    return serverIconsCache;
  }

  try {
    const { prisma } = await import("./prisma");
    const setting = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: { target: "global", section: "icons" }
      }
    });

    const merged = mergeWithDefaults(setting?.config);
    serverIconsCache = merged;
    serverIconsCacheAt = now;
    return merged;
  } catch (e) {
    console.error("Failed to fetch global icons:", e);
    return DEFAULT_ICONS;
  }
}

export async function saveGlobalIcons(config: GlobalIconsConfig) {
  const { prisma } = await import("./prisma");

  const sanitized: GlobalIconsConfig = Object.fromEntries(
    Object.entries(config || {}).map(([key, value]) => {
      const safeValue: IconConfig = {
        ...(value || { url: "", type: "image" }),
      };
      if (typeof safeValue.url === "string" && safeValue.url.startsWith("data:image/")) {
        safeValue.url = "";
      }
      return [key, safeValue];
    }),
  );

  const saved = await prisma.uISystemSetting.upsert({
    where: {
      target_section: { target: "global", section: "icons" }
    },
    update: { config: sanitized as any },
    create: { target: "global", section: "icons", config: sanitized as any }
  });

  const merged = mergeWithDefaults(sanitized);
  serverIconsCache = merged;
  serverIconsCacheAt = Date.now();
  clientIconsCache = merged;
  clientIconsCacheAt = Date.now();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(
        CLIENT_ICONS_CACHE_KEY,
        JSON.stringify({ t: Date.now(), data: merged }),
      );
    } catch {
      // Ignore storage failures silently.
    }
  }
  return saved;
}
