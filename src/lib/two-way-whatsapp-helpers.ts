export const TWO_WAY_TEMPLATE_VARIABLES = [
  "{orderNumber}",
  "{senderName}",
  "{senderPhone}",
  "{recipientName}",
  "{recipientPhone}",
  "{senderRegion}",
  "{recipientRegion}",
  "{subtotal}",
  "{delivery}",
  "{total}",
  "{notes}",
] as const;

export type LocationCondition = "all" | "has_location" | "no_location" | "gps_uploaded";
export type OrderStatusCondition = "pending" | "assigned" | "delivering" | "delivered" | "cancelled" | "archived";
export type TargetParty = "sender_1" | "sender_2" | "recipient_1" | "recipient_2" | "any";

export type TwoWayButtonRule = {
  id: string;
  title: string;
  targetParty: TargetParty;
  actionType: "whatsapp" | "call" | "location_request" | "notify";
  template: string;
  locationConditions: LocationCondition[];
  statusConditions: OrderStatusCondition[];
  active: boolean;
};

export type TwoWayTemplatesConfig = {
  locationSenderTemplate: string;
  locationRecipientTemplate: string;
  notifySenderTemplate: string;
  notifyRecipientTemplate: string;
  chatSenderTemplate: string;
  chatRecipientTemplate: string;
  buttonRules?: TwoWayButtonRule[];
};

export function getDefaultTwoWayLocationSenderTemplate(): string {
  return [
    "مرحباً (المرسل)،",
    "نرجو تزويدنا بموقعك الجغرافي (اللوكيشن) لاستلام الطلبية رقم {orderNumber}.",
    "منطقة الاستلام: {senderRegion}",
    "شكراً لتعاونكم مع شركة أبو الأكبر للتوصيل.",
  ].join("\n");
}

export function getDefaultTwoWayLocationRecipientTemplate(): string {
  return [
    "السلام عليكم 👋",
    "وياكم كابتن {{{delivery}}} 👨🏻✈️",
    "من خدمة أبو الأكبر للتوصيل 🚚",
    "عدكم طلبية من {{{clientshop}}} 🏪",
    "متجهة لمنطقة {{{city}}} 📍",
    "المبلغ الكلي هو {{{total_price}}} 💰",
    "يا ريت ترسلون الموقع 📲",
    "بأسرع وقت ممكن ⚡",
    ".",
    "وبالنسبة للدفع 💵،",
    "تكدرون تدفعون عبر:📲",
    "💳 ماستر كارد:",
    "1973159153",
    "باسم: (أحمد سامي)",
    "📱 زين كاش:",
    "07733921468",
    "باسم: (أحمد سامي)",
  ].join("\n");
}

export function getDefaultTwoWayNotifySenderTemplate(): string {
  return [
    "مرحباً (المرسل)،",
    "نحيطكم علماً بأنه تم استلام الطلبية رقم {orderNumber} من موقعكم بنجاح وهي في الطريق للتوصيل إلى: {recipientRegion}.",
    "شكراً لاختياركم شركة أبو الأكبر للتوصيل.",
  ].join("\n");
}

export function getDefaultTwoWayNotifyRecipientTemplate(): string {
  return [
    "مرحباً (المستلم)،",
    "المندوب في الطريق إليك لتسليم الطلبية رقم {orderNumber}.",
    "منطقة التوصيل: {recipientRegion}",
    "المبلغ الكلي المطلوب: {total} د.ع",
    "يرجى التواجد واستلام الطلبية.",
  ].join("\n");
}

export function getDefaultTwoWayChatSenderTemplate(): string {
  return "";
}

export function getDefaultTwoWayChatRecipientTemplate(): string {
  return "";
}

export function getDefaultTwoWayButtonRules(): TwoWayButtonRule[] {
  return [
    {
      id: "btn_loc_sender_1",
      title: "طلب لوكيشن المرسل الأول",
      targetParty: "sender_1",
      actionType: "location_request",
      template: getDefaultTwoWayLocationSenderTemplate(),
      locationConditions: ["no_location"],
      statusConditions: ["pending", "assigned", "delivering"],
      active: true,
    },
    {
      id: "btn_loc_sender_2",
      title: "طلب لوكيشن المرسل الثاني",
      targetParty: "sender_2",
      actionType: "location_request",
      template: getDefaultTwoWayLocationSenderTemplate(),
      locationConditions: ["no_location"],
      statusConditions: ["pending", "assigned", "delivering"],
      active: true,
    },
    {
      id: "btn_loc_rec_1",
      title: "طلب لوكيشن المستلم الأول",
      targetParty: "recipient_1",
      actionType: "location_request",
      template: getDefaultTwoWayLocationRecipientTemplate(),
      locationConditions: ["no_location"],
      statusConditions: ["pending", "assigned", "delivering"],
      active: true,
    },
    {
      id: "btn_loc_rec_2",
      title: "طلب لوكيشن المستلم الثاني",
      targetParty: "recipient_2",
      actionType: "location_request",
      template: getDefaultTwoWayLocationRecipientTemplate(),
      locationConditions: ["no_location"],
      statusConditions: ["pending", "assigned", "delivering"],
      active: true,
    },
    {
      id: "btn_not_sender_1",
      title: "تبليغ المرسل الأول",
      targetParty: "sender_1",
      actionType: "notify",
      template: getDefaultTwoWayNotifySenderTemplate(),
      locationConditions: ["has_location"],
      statusConditions: ["pending", "assigned", "delivering"],
      active: true,
    },
    {
      id: "btn_not_sender_2",
      title: "تبليغ المرسل الثاني",
      targetParty: "sender_2",
      actionType: "notify",
      template: getDefaultTwoWayNotifySenderTemplate(),
      locationConditions: ["has_location"],
      statusConditions: ["pending", "assigned", "delivering"],
      active: true,
    },
    {
      id: "btn_not_rec_1",
      title: "تبليغ المستلم الأول",
      targetParty: "recipient_1",
      actionType: "notify",
      template: getDefaultTwoWayNotifyRecipientTemplate(),
      locationConditions: ["has_location"],
      statusConditions: ["assigned", "delivering"],
      active: true,
    },
    {
      id: "btn_not_rec_2",
      title: "تبليغ المستلم الثاني",
      targetParty: "recipient_2",
      actionType: "notify",
      template: getDefaultTwoWayNotifyRecipientTemplate(),
      locationConditions: ["has_location"],
      statusConditions: ["assigned", "delivering"],
      active: true,
    },
    {
      id: "btn_chat_sender_1",
      title: "مراسلة المرسل الأول",
      targetParty: "sender_1",
      actionType: "whatsapp",
      template: "",
      locationConditions: ["all"],
      statusConditions: ["pending", "assigned", "delivering", "delivered", "cancelled"],
      active: true,
    },
    {
      id: "btn_chat_rec_1",
      title: "مراسلة المستلم الأول",
      targetParty: "recipient_1",
      actionType: "whatsapp",
      template: "",
      locationConditions: ["all"],
      statusConditions: ["pending", "assigned", "delivering", "delivered", "cancelled"],
      active: true,
    },
  ];
}

import { applyMandoubWaTemplate, splitMandoubWaTemplateVariants } from "./mandoub-wa-button-template";

export function renderTwoWayTemplate(input: {
  template: string;
  orderNumber?: string | number;
  senderName?: string;
  senderPhone?: string;
  recipientName?: string;
  recipientPhone?: string;
  senderRegion?: string;
  recipientRegion?: string;
  subtotal?: string | number;
  delivery?: string | number;
  total?: string | number;
  notes?: string;
  deliveryName?: string;
  courierName?: string;
}): string {
  if (!input.template || !input.template.trim()) return "";
  const variants = splitMandoubWaTemplateVariants(input.template.trim());
  const tpl = variants.length > 0 ? variants[Math.floor(Math.random() * variants.length)] : input.template.trim();

  const deliveryStr =
    input.deliveryName ||
    input.courierName ||
    (typeof input.delivery === "string" && isNaN(Number(input.delivery)) ? input.delivery : "") ||
    "";
  const totalStr = input.total != null && input.total !== "" ? String(input.total) : "";
  const shopStr = input.senderName || "";
  const regionStr = input.recipientRegion || "";

  // التطبيق الأولي للمتغيرات الشائعة
  let text = applyMandoubWaTemplate(tpl, {
    delivery: deliveryStr,
    courier: deliveryStr,
    clientshop: shopStr,
    shop: shopStr,
    city: regionStr,
    region: regionStr,
    total_price: totalStr,
    total: totalStr,
    order_number: String(input.orderNumber || ""),
    customer_phone: input.recipientPhone || "",
    shop_phone: input.senderPhone || "",
  });

  const replacements: Record<string, string> = {
    "{orderNumber}": String(input.orderNumber || ""),
    "{senderName}": shopStr || "المرسل",
    "{senderPhone}": input.senderPhone || "",
    "{recipientName}": input.recipientName || "المستلم",
    "{recipientPhone}": input.recipientPhone || "",
    "{senderRegion}": input.senderRegion || "غير مسمى",
    "{recipientRegion}": regionStr || "غير مسمى",
    "{subtotal}": String(input.subtotal || "0"),
    "{delivery}": deliveryStr || String(input.delivery || "0"),
    "{total}": totalStr || String(input.total || "0"),
    "{notes}": input.notes || "لا يوجد",
    "\\n": "\n",
  };

  Object.entries(replacements).forEach(([k, v]) => {
    text = text.replaceAll(k, v);
  });

  return text;
}

/**
 * فحص شروط إظهار الزر طبقاً لحالة الطلب وحالة اللوكيشن للطرف
 */
export function shouldShowButtonRule(
  rule: TwoWayButtonRule,
  currentOrderStatus: string,
  partyLocationStatus: { hasLocation: boolean; gpsUploaded: boolean }
): boolean {
  if (!rule.active) return false;

  // 1. فحص حالة الطلب
  const normalizedStatus = (currentOrderStatus || "pending").toLowerCase();
  if (rule.statusConditions && rule.statusConditions.length > 0) {
    if (!rule.statusConditions.includes(normalizedStatus as OrderStatusCondition)) {
      return false;
    }
  }

  // 2. فحص حالة اللوكيشن
  if (rule.locationConditions && rule.locationConditions.length > 0) {
    if (rule.locationConditions.includes("all")) {
      return true;
    }

    let match = false;
    if (rule.locationConditions.includes("has_location") && partyLocationStatus.hasLocation) {
      match = true;
    }
    if (rule.locationConditions.includes("no_location") && !partyLocationStatus.hasLocation) {
      match = true;
    }
    if (rule.locationConditions.includes("gps_uploaded") && partyLocationStatus.gpsUploaded) {
      match = true;
    }

    return match;
  }

  return true;
}
