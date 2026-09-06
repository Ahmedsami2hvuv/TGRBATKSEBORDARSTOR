/**
 * مصفوفة النماذج الافتراضية (فارغة لتمكين المستخدم من إضافة نماذجه الخاصة)
 */
export const DEFAULT_OUTREACH_TEMPLATES: { id: string; title: string; content: string }[] = [];

/**
 * تحويل الأرقام العربية/المشرقية والفارسية إلى أرقام لاتينية 0-9
 */
export function normalizeDigits(input: string): string {
  if (!input) return "";
  const arabicNumerals = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  const persianNumerals = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  let result = input;
  for (let i = 0; i < 10; i++) {
    result = result.replaceAll(arabicNumerals[i], String(i)).replaceAll(persianNumerals[i], String(i));
  }
  return result;
}

/**
 * دالة مساعدة نقية لتنظيف واستخراج الرقم أو اليوزر
 */
export function cleanPhoneOrUsername(input: string): string | null {
  if (!input) return null;
  let text = normalizeDigits(input.trim());

  // 1. إذا كان رابط واتساب بيوزر أو رقم: wa.me/... أو api.whatsapp.com/...
  const waMatch = text.match(/(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=|\/)([a-zA-Z0-9_.+@-]+)/i);
  if (waMatch && waMatch[1]) {
    text = waMatch[1].replace(/[?#].*$/, "");
  }

  // 2. إذا كان رابط تيليجرام: t.me/username
  const tgMatch = text.match(/(?:https?:\/\/)?(?:t\.me\/|telegram\.me\/)([a-zA-Z0-9_]+)/i);
  if (tgMatch && tgMatch[1]) {
    text = tgMatch[1];
  }

  // 3. فحص هل هو يوزر يبدأ بـ @ أو يحتوي على حروف إنجليزية
  const isUsername = /^@?[a-zA-Z0-9_.-]{3,35}$/.test(text) && /[a-zA-Z]/.test(text);
  if (isUsername) {
    let cleanUser = text.replace(/^@/, "").trim();
    if (cleanUser.length >= 3 && cleanUser.length <= 35) {
      return `@${cleanUser}`;
    }
  }

  // 4. إذا كان رقماً هاتفياً
  let cleanedDigits = text.replace(/[^0-9+]/g, "");
  if (cleanedDigits.startsWith("+")) cleanedDigits = cleanedDigits.substring(1);
  else if (cleanedDigits.startsWith("00")) cleanedDigits = cleanedDigits.substring(2);

  if (cleanedDigits.startsWith("07") && cleanedDigits.length === 11) {
    cleanedDigits = "964" + cleanedDigits.substring(1);
  } else if ((cleanedDigits.startsWith("7") || cleanedDigits.startsWith("8")) && cleanedDigits.length === 10) {
    cleanedDigits = "964" + cleanedDigits;
  } else if (cleanedDigits.startsWith("96407") && cleanedDigits.length === 14) {
    cleanedDigits = "964" + cleanedDigits.substring(4);
  }

  if (cleanedDigits.length >= 8 && cleanedDigits.length <= 16) {
    return cleanedDigits;
  }

  return null;
}

/**
 * استخراج كل الأرقام واليوزرات من نص طويل
 */
export function extractPhonesPure(rawText: string): { phone: string; originalInput: string }[] {
  if (!rawText) return [];

  const normalized = normalizeDigits(rawText);
  const lines = normalized.split(/[\r\n,;\t]+/);
  const seen = new Set<string>();
  const results: { phone: string; originalInput: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parsed = cleanPhoneOrUsername(trimmed);
    if (parsed && !seen.has(parsed)) {
      seen.add(parsed);
      results.push({ phone: parsed, originalInput: trimmed });
    } else {
      // البحث عن أي روابط أو أرقام أو يوزرات داخل السطر
      const matches = trimmed.match(/(?:https?:\/\/wa\.me\/[a-zA-Z0-9_.+@-]+|@[a-zA-Z0-9_.-]{3,35}|07[3-9][0-9]{8}|9647[3-9][0-9]{8}|\+9647[3-9][0-9]{8})/g);
      if (matches) {
        for (const m of matches) {
          const p = cleanPhoneOrUsername(m);
          if (p && !seen.has(p)) {
            seen.add(p);
            results.push({ phone: p, originalInput: m });
          }
        }
      }
    }
  }

  return results;
}
