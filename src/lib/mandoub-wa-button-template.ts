export type MandoubWaButtonVariableValues = Record<string, string>;

const TRIPLE_TOKEN_RE = /\{\{\{([a-zA-Z0-9_]+)\}\}\}/g;
const SINGLE_TOKEN_RE = /\{([a-zA-Z0-9_]+)\}/g;

export function applyMandoubWaTemplate(
  templateText: string,
  vars: MandoubWaButtonVariableValues,
): string {
  if (!templateText) return "";

  const getValue = (key: string): string => {
    const k = key.toLowerCase();
    if (k === "delivery" || k === "courier") {
      return vars.delivery || vars.courier || vars.courierName || vars.deliveryName || "";
    }
    if (k === "clientshop" || k === "shop" || k === "sendername") {
      return vars.clientshop || vars.shop || vars.shopName || vars.clientName || vars.senderName || "";
    }
    if (k === "city" || k === "region" || k === "recipientregion") {
      return vars.city || vars.region || vars.regionLine || vars.recipientRegion || "";
    }
    if (k === "total_price" || k === "total" || k === "price") {
      return vars.total_price || vars.total || vars.totalPrice || "";
    }
    if (k === "location_url" || k === "location") {
      return vars.location_url || vars.locationUrl || vars.location || "";
    }
    if (k === "landmark") {
      return vars.landmark || vars.nearestLandmark || vars.customerLandmark || "";
    }
    if (k === "order_number" || k === "ordernumber") {
      return vars.order_number || vars.orderNumber || vars.orderId || "";
    }
    if (k === "customer_phone" || k === "recipientphone" || k === "phone") {
      return vars.customer_phone || vars.recipientPhone || vars.phone || "";
    }
    if (k === "customer_phone2") {
      return vars.customer_phone2 || vars.customerPhone2 || "";
    }
    if (k === "shop_phone" || k === "senderphone") {
      return vars.shop_phone || vars.senderPhone || vars.shopPhone || "";
    }
    if (
      k === "driver_review_url" ||
      k === "review_url" ||
      k === "rating_url" ||
      k === "rate_url" ||
      k === "driverreviewurl" ||
      k === "reviewurl"
    ) {
      return (
        vars.driver_review_url ||
        vars.review_url ||
        vars.rating_url ||
        vars.rate_url ||
        vars.driverReviewUrl ||
        ""
      );
    }
    return vars[key] ?? vars[k] ?? "";
  };

  // استبدال النمط الأقواس الثلاثية أولاً {{{var}}}
  let result = templateText.replace(TRIPLE_TOKEN_RE, (_, key: string) => getValue(key));

  // استبدال النمط الأقواس الأحادية {var} ثانياً
  result = result.replace(SINGLE_TOKEN_RE, (_, key: string) => getValue(key));

  return result;
}

/**
 * يدعم إدخال عدة نماذج داخل نفس الحقل بفاصل سطر مستقل يحتوي `---`.
 * إذا لم يُستخدم الفاصل، يرجع نموذجاً واحداً فقط.
 */
export function splitMandoubWaTemplateVariants(templateText: string): string[] {
  return templateText
    .split(/\n\s*---\s*\n/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseStatusesCsv(statusesCsv: string): string[] {
  return statusesCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatCsvString(statuses: string[]): string {
  return statuses
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");
}

