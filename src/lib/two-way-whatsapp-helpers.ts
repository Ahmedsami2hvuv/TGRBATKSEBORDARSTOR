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

export type TwoWayTemplatesConfig = {
  locationSenderTemplate: string;
  locationRecipientTemplate: string;
  notifySenderTemplate: string;
  notifyRecipientTemplate: string;
  chatSenderTemplate: string;
  chatRecipientTemplate: string;
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
    "مرحباً (المستلم)،",
    "نرجو تزويدنا بموقعك الجغرافي (اللوكيشن) لتوصيل الطلبية رقم {orderNumber}.",
    "منطقة التوصيل: {recipientRegion}",
    "شكراً لتعاونكم مع شركة أبو الأكبر للتوصيل.",
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
  return [
    "السلام عليكم،",
    "تواصل بخصوص الطلب رقم {orderNumber} (الوجهة الأولى - المرسل).",
    "يرجى التأكيد.",
  ].join("\n");
}

export function getDefaultTwoWayChatRecipientTemplate(): string {
  return [
    "السلام عليكم،",
    "تواصل بخصوص الطلب رقم {orderNumber} (الوجهة الثانية - المستلم).",
    "يرجى التأكيد.",
  ].join("\n");
}

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
}): string {
  let text = input.template.trim();
  const replacements: Record<string, string> = {
    "{orderNumber}": String(input.orderNumber || ""),
    "{senderName}": input.senderName || "المرسل",
    "{senderPhone}": input.senderPhone || "",
    "{recipientName}": input.recipientName || "المستلم",
    "{recipientPhone}": input.recipientPhone || "",
    "{senderRegion}": input.senderRegion || "غير مسمى",
    "{recipientRegion}": input.recipientRegion || "غير مسمى",
    "{subtotal}": String(input.subtotal || "0"),
    "{delivery}": String(input.delivery || "0"),
    "{total}": String(input.total || "0"),
    "{notes}": input.notes || "لا يوجد",
    "\\n": "\n",
  };

  Object.entries(replacements).forEach(([k, v]) => {
    text = text.replaceAll(k, v);
  });

  return text;
}
