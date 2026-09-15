import { prisma } from "./prisma";

export type CustomElementConfig = {
  imageUrl?: string;
  scale?: number;       // معامل التكبير/التصغير (1 = 100%)
  width?: number;       // عرض مخصص بالبكسل أو النسبة
  height?: number;      // ارتفاع مخصص بالبكسل
  offsetX?: number;     // إزاحة أفقية (بالموجب = يمين، بالسالب = يسار)
  offsetY?: number;     // إزاحة رأسية (بالموجب = أسفل، بالسالب = أعلى)
  hidden?: boolean;     // إخفاء العنصر
  visibility?: "all" | "admin" | "admin_mandoub" | "admin_mandoub_preparer"; // نطاق الظهور
};

export type OrderCardDesignerConfig = {
  // كارت المحل (المرسل)
  shopCard: {
    frameBgUrl?: string;
    headerShopInfo?: CustomElementConfig;
    headerShopPhoto?: CustomElementConfig;
    iconShopName?: CustomElementConfig;
    iconCustomerName?: CustomElementConfig;
    iconRegion?: CustomElementConfig;
    iconPhone?: CustomElementConfig;
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
    headerCustomerInfo?: CustomElementConfig;
    headerDoorPhoto?: CustomElementConfig;
    iconCustomerName?: CustomElementConfig;
    iconRegion?: CustomElementConfig;
    iconPhone?: CustomElementConfig;
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
    iconCustomerName: { scale: 1, offsetX: 0, offsetY: 0 },
    iconRegion: { scale: 1, offsetX: 0, offsetY: 0 },
    iconPhone: { scale: 1, offsetX: 0, offsetY: 0 },
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
    iconRegion: { scale: 1, offsetX: 0, offsetY: 0 },
    iconPhone: { scale: 1, offsetX: 0, offsetY: 0 },
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

export async function getOrderCardsDesignerConfig(): Promise<OrderCardDesignerConfig> {
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
      return DEFAULT_DESIGNER_CONFIG;
    }

    const saved = row.config as any;
    return {
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
  } catch (error) {
    console.error("Error reading order cards designer config:", error);
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
