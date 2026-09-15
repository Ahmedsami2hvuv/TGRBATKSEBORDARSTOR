import { prisma } from "./prisma";
import type React from "react";

export type CustomElementConfig = {
  imageUrl?: string;
  scale?: number;          // معامل التكبير/التصغير العام (1 = 100%)
  scaleX?: number;         // معامل التكبير/التصغير الأفقي (العرض)
  scaleY?: number;         // معامل التكبير/التصغير العمودي (الارتفاع)
  rotate?: number;         // زاوية التدوير بالدرجات (0 إلى 360)
  width?: number;          // عرض مخصص بالبكسل
  height?: number;         // ارتفاع مخصص بالبكسل
  offsetX?: number;        // إزاحة أفقية (الموجب = يمين، السالب = يسار)
  offsetY?: number;        // إزاحة رأسية (الموجب = أسفل، السالب = أعلى)
  transformOrigin?: string;// نقطة ارتكاز التكبير والتدوير (center, right, left, top, bottom, etc.)
  hidden?: boolean;        // إخفاء العنصر
  visibility?: "all" | "admin" | "admin_mandoub" | "admin_mandoub_preparer"; // نطاق الظهور
};

export function getElementStyle(cfg?: CustomElementConfig): React.CSSProperties {
  if (!cfg) return {};
  const style: React.CSSProperties = {};
  const transforms: string[] = [];

  const baseScale = cfg.scale ?? 1;
  const sX = (cfg.scaleX ?? 1) * baseScale;
  const sY = (cfg.scaleY ?? 1) * baseScale;

  if (sX !== 1 || sY !== 1) {
    transforms.push(`scale(${sX}, ${sY})`);
  }

  if (cfg.rotate !== undefined && cfg.rotate !== 0) {
    transforms.push(`rotate(${cfg.rotate}deg)`);
  }

  if (cfg.offsetX !== undefined && cfg.offsetX !== 0) {
    transforms.push(`translateX(${cfg.offsetX}px)`);
  }
  if (cfg.offsetY !== undefined && cfg.offsetY !== 0) {
    transforms.push(`translateY(${cfg.offsetY}px)`);
  }

  if (transforms.length > 0) {
    style.transform = transforms.join(" ");
  }

  if (cfg.transformOrigin) {
    style.transformOrigin = cfg.transformOrigin;
  }

  if (cfg.width) {
    style.width = `${cfg.width}px`;
  }
  if (cfg.height) {
    style.height = `${cfg.height}px`;
  }

  if (cfg.hidden) {
    style.display = "none";
  }

  return style;
}

export type CustomFrameConfig = {
  bgUrl?: string;
  scale?: number;          // معامل تكبير الكارت ككل (1 = 100%)
  scaleX?: number;         // تمديد عرض الكارت (تعريض أو ضغط)
  scaleY?: number;         // تمديد طول الكارت (تطويل أو تقصير)
  maxWidth?: number;       // العرض الأقصى بالبكسل
  minHeight?: number;      // الارتفاع الأدنى بالبكسل
  paddingX?: number;       // هوامش داخلية أفقية بالبكسل
  paddingY?: number;       // هوامش داخلية رأسية بالبكسل
  borderRadius?: number;   // تدوير زوايا الكارت بالبكسل
  rotate?: number;         // زاوية تدوير الكارت
};

export function getCardContainerStyle(
  frameCfg?: CustomFrameConfig,
  defaultBg: string = "/images/order-luxury/shop-card/shop-card-frame.webp"
): React.CSSProperties {
  const bg = frameCfg?.bgUrl || defaultBg;
  const style: React.CSSProperties = {
    backgroundImage: bg ? `url('${bg}')` : undefined,
  };

  if (!frameCfg) return style;

  const transforms: string[] = [];
  const baseScale = frameCfg.scale ?? 1;
  const sX = (frameCfg.scaleX ?? 1) * baseScale;
  const sY = (frameCfg.scaleY ?? 1) * baseScale;

  if (sX !== 1 || sY !== 1) {
    transforms.push(`scale(${sX}, ${sY})`);
  }
  if (frameCfg.rotate !== undefined && frameCfg.rotate !== 0) {
    transforms.push(`rotate(${frameCfg.rotate}deg)`);
  }
  if (transforms.length > 0) {
    style.transform = transforms.join(" ");
  }

  if (frameCfg.maxWidth) {
    style.maxWidth = `${frameCfg.maxWidth}px`;
  }
  if (frameCfg.minHeight) {
    style.minHeight = `${frameCfg.minHeight}px`;
  }
  if (frameCfg.paddingX !== undefined) {
    style.paddingLeft = `${frameCfg.paddingX}px`;
    style.paddingRight = `${frameCfg.paddingX}px`;
  }
  if (frameCfg.paddingY !== undefined) {
    style.paddingTop = `${frameCfg.paddingY}px`;
    style.paddingBottom = `${frameCfg.paddingY}px`;
  }
  if (frameCfg.borderRadius !== undefined) {
    style.borderRadius = `${frameCfg.borderRadius}px`;
  }

  return style;
}

export type OrderCardDesignerConfig = {
  // كارت المحل (المرسل)
  shopCard: {
    frameBgUrl?: string;
    frameConfig?: CustomFrameConfig;
    headerShopInfo?: CustomElementConfig;
    headerShopPhoto?: CustomElementConfig;
    iconShopName?: CustomElementConfig;
    textShopName?: CustomElementConfig;
    iconCustomerName?: CustomElementConfig;
    textCustomerName?: CustomElementConfig;
    iconRegion?: CustomElementConfig;
    textRegion?: CustomElementConfig;
    iconPhone?: CustomElementConfig;
    textPhone?: CustomElementConfig;
    btnShopLocation?: CustomElementConfig;
    photoContainer?: CustomElementConfig;
    placeholderNoPhoto?: CustomElementConfig;
    btnCall?: CustomElementConfig;
    btnWhatsapp?: CustomElementConfig;
    btnCamera?: CustomElementConfig;
    btnGallery?: CustomElementConfig;
  };

  // كارت الزبون (المستلم)
  customerCard: {
    frameBgUrl?: string;
    frameConfig?: CustomFrameConfig;
    headerCustomerInfo?: CustomElementConfig;
    headerDoorPhoto?: CustomElementConfig;
    iconCustomerName?: CustomElementConfig;
    textCustomerName?: CustomElementConfig;
    iconRegion?: CustomElementConfig;
    textRegion?: CustomElementConfig;
    iconPhone?: CustomElementConfig;
    textPhone?: CustomElementConfig;
    btnLocation?: CustomElementConfig;
    photoContainer?: CustomElementConfig;
    placeholderNoPhoto?: CustomElementConfig;
    btnCall?: CustomElementConfig;
    btnWhatsapp?: CustomElementConfig;
    btnCamera?: CustomElementConfig;
    btnGallery?: CustomElementConfig;
  };

  // أزرار الواتساب المخصصة
  waButtonsConfig?: Record<string, CustomElementConfig>;
};

export const DEFAULT_DESIGNER_CONFIG: OrderCardDesignerConfig = {
  shopCard: {
    frameBgUrl: "/images/order-luxury/shop-card/shop-card-frame.webp",
    headerShopInfo: { scale: 1, offsetX: 0, offsetY: 0 },
    headerShopPhoto: { scale: 1, offsetX: 0, offsetY: 0 },
    iconShopName: { scale: 1, offsetX: 0, offsetY: 0 },
    textShopName: { scale: 1, offsetX: 0, offsetY: 0 },
    iconCustomerName: { scale: 1, offsetX: 0, offsetY: 0 },
    textCustomerName: { scale: 1, offsetX: 0, offsetY: 0 },
    iconRegion: { scale: 1, offsetX: 0, offsetY: 0 },
    textRegion: { scale: 1, offsetX: 0, offsetY: 0 },
    iconPhone: { scale: 1, offsetX: 0, offsetY: 0 },
    textPhone: { scale: 1, offsetX: 0, offsetY: 0 },
    btnShopLocation: { scale: 1, offsetX: 0, offsetY: 0 },
    photoContainer: { scale: 1, offsetX: 0, offsetY: 0 },
    placeholderNoPhoto: { scale: 1, offsetX: 0, offsetY: 0 },
    btnCall: { scale: 1, offsetX: 0, offsetY: 0 },
    btnWhatsapp: { scale: 1, offsetX: 0, offsetY: 0 },
    btnCamera: { scale: 1, offsetX: 0, offsetY: 0 },
    btnGallery: { scale: 1, offsetX: 0, offsetY: 0 },
  },
  customerCard: {
    frameBgUrl: "",
    headerCustomerInfo: { scale: 1, offsetX: 0, offsetY: 0 },
    headerDoorPhoto: { scale: 1, offsetX: 0, offsetY: 0 },
    iconCustomerName: { scale: 1, offsetX: 0, offsetY: 0 },
    textCustomerName: { scale: 1, offsetX: 0, offsetY: 0 },
    iconRegion: { scale: 1, offsetX: 0, offsetY: 0 },
    textRegion: { scale: 1, offsetX: 0, offsetY: 0 },
    iconPhone: { scale: 1, offsetX: 0, offsetY: 0 },
    textPhone: { scale: 1, offsetX: 0, offsetY: 0 },
    btnLocation: { scale: 1, offsetX: 0, offsetY: 0 },
    photoContainer: { scale: 1, offsetX: 0, offsetY: 0 },
    placeholderNoPhoto: { scale: 1, offsetX: 0, offsetY: 0 },
    btnCall: { scale: 1, offsetX: 0, offsetY: 0 },
    btnWhatsapp: { scale: 1, offsetX: 0, offsetY: 0 },
    btnCamera: { scale: 1, offsetX: 0, offsetY: 0 },
    btnGallery: { scale: 1, offsetX: 0, offsetY: 0 },
  },
  waButtonsConfig: {},
};

const DESIGNER_SETTING_TARGET = "global";
const DESIGNER_SETTING_SECTION = "order_cards_designer";

let cachedConfig: OrderCardDesignerConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // دقيقة واحدة

export async function getOrderCardsDesignerConfig(): Promise<OrderCardDesignerConfig> {
  const now = Date.now();
  if (cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const row = await prisma.uISystemSetting.findUnique({
      where: {
        target_section: {
          target: DESIGNER_SETTING_TARGET,
          section: DESIGNER_SETTING_SECTION,
        },
      },
    });

    if (!row || !row.config) {
      cachedConfig = DEFAULT_DESIGNER_CONFIG;
      lastFetchTime = now;
      return DEFAULT_DESIGNER_CONFIG;
    }

    const saved = row.config as any;
    const result: OrderCardDesignerConfig = {
      shopCard: {
        ...DEFAULT_DESIGNER_CONFIG.shopCard,
        ...(saved.shopCard || {}),
      },
      customerCard: {
        ...DEFAULT_DESIGNER_CONFIG.customerCard,
        ...(saved.customerCard || {}),
      },
      waButtonsConfig: saved.waButtonsConfig || {},
    };

    cachedConfig = result;
    lastFetchTime = now;
    return result;
  } catch (error) {
    console.error("Error reading order cards designer config:", error);
    if (cachedConfig) return cachedConfig;
    return DEFAULT_DESIGNER_CONFIG;
  }
}

export async function saveOrderCardsDesignerConfig(
  config: Partial<OrderCardDesignerConfig>
): Promise<boolean> {
  try {
    const current = await getOrderCardsDesignerConfig();
    const merged: OrderCardDesignerConfig = {
      shopCard: {
        ...current.shopCard,
        ...(config.shopCard || {}),
      },
      customerCard: {
        ...current.customerCard,
        ...(config.customerCard || {}),
      },
      waButtonsConfig: {
        ...current.waButtonsConfig,
        ...(config.waButtonsConfig || {}),
      },
    };

    cachedConfig = merged;
    lastFetchTime = Date.now();

    await prisma.uISystemSetting.upsert({
      where: {
        target_section: {
          target: DESIGNER_SETTING_TARGET,
          section: DESIGNER_SETTING_SECTION,
        },
      },
      update: {
        config: merged as any,
      },
      create: {
        target: DESIGNER_SETTING_TARGET,
        section: DESIGNER_SETTING_SECTION,
        config: merged as any,
      },
    });

    return true;
  } catch (error) {
    console.error("Error saving order cards designer config:", error);
    return false;
  }
}
