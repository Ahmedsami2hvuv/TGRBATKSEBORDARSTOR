/**
 * تطبيع أرقام الهاتف لروابط واتساب: يقبل أي شكل (مسافات، +، أصفار أولية…).
 * الافتراضي: العراق 964 — عيّن NEXT_PUBLIC_WHATSAPP_DEFAULT_CC لتغيير كود الدولة.
 *
 * روابط wa.me و whatsapp:// تدعم ?text= لملء صندوق الرسالة مسبقاً.
 */

import { normalizeDigits } from "@/lib/money-alf";

function defaultCountryDigits(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_WHATSAPP_DEFAULT_CC
      : undefined;
  const cc = normalizeDigits(fromEnv ?? "964");
  return cc || "964";
}

/** أرقام فقط بعد إزالة الرموز */
export function digitsOnly(raw: string): string {
  return normalizeDigits(raw);
}

/** رابط اتصال هاتفي — يستخدم الأرقام فقط */
export function telHref(phone: string): string {
  const d = digitsOnly(phone);
  if (!d) return "#";
  return `tel:${d}`;
}

/**
 * يحوّل الإدخال إلى صيغة واتساب (رقم دولة + رقم وطني بدون +).
 * أمثلة مع العراق: 07733921468، +964 771 243 0593، 9647712430593
 */
export function normalizePhoneDigits(raw: string): string {
  let d = digitsOnly(raw);
  if (!d) return "";

  while (d.startsWith("00")) {
    d = d.slice(2);
  }

  const cc = defaultCountryDigits();

  if (d.startsWith(cc)) {
    return d;
  }

  if (cc === "964") {
    if (d.length === 11 && d.startsWith("07")) {
      return cc + d.slice(1);
    }
    if (d.length === 10 && d.startsWith("7")) {
      return cc + d;
    }
  }

  if (d.length >= 11) {
    return d;
  }

  return d;
}

/**
 * يحوّل إدخالاً عراقياً بأي شكل شائع (+964، مسافات، 07…، 10 أرقام تبدأ بـ 7)
 * إلى صيغة التخزين المحلية: 11 رقماً تبدأ بـ 07.
 */
export function normalizeIraqMobileLocal11(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  const normalized = normalizePhoneDigits(t);
  if (normalized.startsWith("964") && normalized.length === 13) {
    const rest = normalized.slice(3);
    if (rest.length === 10 && rest.startsWith("7")) {
      return `0${rest}`;
    }
    return null;
  }

  let d = digitsOnly(t);
  while (d.startsWith("00")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("07")) return d;
  if (d.length === 10 && d.startsWith("7")) return `0${d}`;
  return null;
}

export function isPlausibleWhatsAppNumber(digits: string): boolean {
  return digits.length >= 10 && digits.length <= 15;
}

function appendTextParam(base: string, text: string | undefined): string {
  const t = text?.trim();
  if (!t) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}text=${encodeURIComponent(t)}`;
}

/**
 * رابط wa.me — يفتح في المتصفح أو يمرّر للتطبيق.
 * إن وُجد `text` يُملأ حقل الرسالة تلقائياً.
 */
export function whatsappMeUrl(phone: string, text?: string): string {
  const d = normalizePhoneDigits(phone);
  if (!d || !isPlausibleWhatsAppNumber(d)) return "#";
  return appendTextParam(`https://wa.me/${d}`, text);
}

/**
 * رابط تطبيق واتساب مباشرة (الهاتف).
 * إن وُجد `text` تُحمَّل الرسالة في صندوق الإرسال.
 */
export function whatsappAppUrl(phone: string, text?: string): string {
  const d = normalizePhoneDigits(phone);
  if (!d || !isPlausibleWhatsAppNumber(d)) return "#";
  const base = `whatsapp://send?phone=${d}`;
  return appendTextParam(base, text);
}

/**
 * يفتح wa.me / https / tel: من تفاعل المستخدم — بدون `window.open` الذي يُحظر أو يُعطّل
 * كثيراً على Safari/iOS ومتصفحات الجوال عند فتح واتساب أو تبويب جديد.
 */
export function openUrlFromUserGesture(url: string): void {
  if (typeof window === "undefined" || !url || url === "#") return;
  const a = document.createElement("a");
  a.href = url;
  if (url.startsWith("https://") || url.startsWith("http://")) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * رسالة واتساب لإرسال رابط إدخال الطلب لموظف المحل (عميل المحل / مُدخل الطلب — ليس الزبون ولا المندوب).
 */
export function buildShopStaffOrderShareMessage(opts: {
  shopName: string;
  locationUrl: string;
  employeeName: string;
  /** رابط صفحة /client/order لموظف المحل */
  orderPortalUrl: string;
}): string {
  const { shopName, locationUrl, employeeName, orderPortalUrl } = opts;
  const custom =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_WHATSAPP_ORDER_SHARE_TEMPLATE?.trim() ||
        process.env.NEXT_PUBLIC_WHATSAPP_SHARE_TEMPLATE?.trim()
      : undefined;
  if (custom) {
    return custom
      .replaceAll("{shop}", shopName)
      .replaceAll("{link}", locationUrl)
      .replaceAll("{portal}", orderPortalUrl)
      .replaceAll("{orderPortal}", orderPortalUrl)
      .replaceAll("{employee}", employeeName)
      .replaceAll("\\n", "\n");
  }
  return [
    `مرحبا (  ${employeeName} ) 🌸`,
    `من (  ${shopName}  ) 📦`,
    `هذا 👇🏻رابط🔗 حسابكم الخاص🧾:`,
    "",
    orderPortalUrl,
    "",
    "الآن تكدر ترفع📤 طلبياتك بكل سهولة وسرعة👌🏻:",
    "✅ بدون تحميل ⤵️ تطبيق 📵",
    "✅ بدون كتابة 📝 يوزر نيم 🔡",
    "✅ بدون كتابة 📝 رقم سري 🔢",
    "الجديد بموقعنا صار يسهل شغلك أكثر:",
    "🎤 تكدر تسجل بصمة صوت داخل الطلبية بدل الكتابة.",
    "📸 تكدر تلتقط صور لطلبيتك وترفقها بكل سهولة.",
    "🔄 وفرنا الك زر الطلب العكسي صار متاح وموجود بالموقع.",
    "فقط انقر 🤳 الرابط 🔗 ",
    "وادخل ♿️ لكتابة ⌨️ معلومات طلبيتك 📦، ",
    "لأن الموقع 📲 سيتعرف 👁 عليك 🫵🏻 مباشرة 🏹.",
    "",
    "نتشرف بخدمتكم دائماً ✨",
  ].join("\n");
}

/** رسالة واتساب لإرسال رابط بوابة موظف الإدارة/الشركة */
export function buildStaffEmployeeShareMessage(opts: {
  staffEmployeeName: string;
  staffPortalUrl: string;
}): string {
  const { staffEmployeeName, staffPortalUrl } = opts;
  return [
    "السلام عليكم ورحمة الله وبركاته",
    "أبو الأكبر للتوصيل",
    "",
    "رابط بوابة الموظف:",
    staffPortalUrl,
    "",
    `الموظف: ${staffEmployeeName}`,
  ].join("\n");
}

/** رسالة واتساب لإرسال رابط لوحة المندوب — من قسم المندوبين فقط */
export function buildCourierShareMessage(opts: {
  courierName: string;
  delegatePortalUrl: string;
}): string {
  const { courierName, delegatePortalUrl } = opts;
  return [
    "السلام عليكم ورحمة الله وبركاته",
    "أبو الأكبر للتوصيل",
    "",
    "رابط لوحة المندوب — الطلبات التي تُحوَّل إليك من الإدارة:",
    delegatePortalUrl,
    "",
    `المندوب: ${courierName}`,
    "",
    "هذا الرابط منفصل عن موظفي المحلات (رفع الطلبات للزبائن).",
  ].join("\n");
}

/** تحية قصيرة عند فتح المحادثة مباشرة (لزر «فتح الرابط مباشرة»). */
export function buildEmployeeChatGreeting(opts: { employeeName: string }): string {
  const { employeeName } = opts;
  const line =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_WHATSAPP_DIRECT_GREETING?.trim()
      : undefined;
  if (line) {
    return line.replaceAll("{employee}", employeeName);
  }
  return `السلام عليكم، معك ${employeeName} من أبو الأكبر للتوصيل.\nكيف يمكننا خدمتك؟`;
}
