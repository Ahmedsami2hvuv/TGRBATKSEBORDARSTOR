import { prisma } from "./prisma";
import { getCachedRegions } from "./ai-data-cache";
import { cleanAndNormalizePhone, normalizeArabic, calculateSimilarity } from "./ai-order-wizard";

export type CustomerDraftState = {
  step?: "waiting_phone" | "waiting_region" | "waiting_extra" | null;
  phone?: string | null;
  regionId?: string | null;
  regionName?: string | null;
  locationUrl?: string | null;
  landmark?: string | null;
};

/**
 * حفظ وتثبيت بروفايل الزبون في قاعدة البيانات
 */
export async function finalizeAndCreateCustomer(
  draft: CustomerDraftState
): Promise<{ handled: boolean; reply: string; nextDraft: null }> {
  const phone = draft.phone?.trim();
  const regionId = draft.regionId?.trim();

  if (!phone || !regionId) {
    return {
      handled: true,
      reply: "⚠️ يا أبو الأكبر: رقم هاتف الزبون والمنطقة ضروريان لتسجيل الزبون!",
      nextDraft: null
    };
  }

  const locationUrl = draft.locationUrl?.trim() || "";
  const landmark = draft.landmark?.trim() || "";

  // إنشاء أو تحديث بروفايل الزبون المركزي
  const profile = await prisma.customerPhoneProfile.upsert({
    where: {
      phone_regionId: {
        phone,
        regionId
      }
    },
    update: {
      locationUrl: locationUrl || undefined,
      landmark: landmark || undefined,
      updatedAt: new Date()
    },
    create: {
      phone,
      regionId,
      locationUrl,
      landmark
    },
    include: {
      region: true
    }
  });

  const regName = profile.region?.name || draft.regionName || "المنطقة";

  return {
    handled: true,
    reply: `تم يا أبو الأكبر! حفظت بروفايل الزبون بنجاح 🎉\n📞 **الهاتف:** ${phone}\n📍 **المنطقة:** ${regName}\n🗺️ **اللوكيشن:** ${locationUrl ? "مضاف ✅" : "بدون لوكيشن"}\n🏢 **النقطة الدالة:** ${landmark || "بدون نقطة دالة"} 🚀`,
    nextDraft: null
  };
}

/**
 * معالجة الإدخال متعدد الحقول المباشر للزبون
 */
export async function parseMultiFieldCustomerInput(
  rawText: string,
  existingDraft: CustomerDraftState,
  allRegions: Array<{ id: string; name: string }>
): Promise<{ updatedDraft: CustomerDraftState; fieldsFoundCount: number }> {
  const draft: CustomerDraftState = { ...existingDraft };
  let fieldsFoundCount = 0;

  // 1. استخراج رقم الهاتف
  const phone = cleanAndNormalizePhone(rawText);
  if (phone && !draft.phone) {
    draft.phone = phone;
    fieldsFoundCount++;
  }

  // 2. استخراج رابط اللوكيشن إن وجد
  const urlMatch = rawText.match(/https?:\/\/(?:maps\.app\.goo\.gl|maps\.google\.com|goo\.gl\/maps)\/[^\s]+/i) ||
                   rawText.match(/https?:\/\/\S+/i);
  if (urlMatch && !draft.locationUrl) {
    draft.locationUrl = urlMatch[0];
    fieldsFoundCount++;
  }

  // 3. مطابقة المنطقة من بين المناطق المسجلة
  const cleanRaw = normalizeArabic(rawText);
  if (!draft.regionId) {
    let bestMatch: { region: { id: string; name: string }; score: number } | null = null;
    for (const r of allRegions) {
      const cleanR = normalizeArabic(r.name);
      if (cleanRaw.includes(cleanR)) {
        const score = cleanR.length / cleanRaw.length + 0.8;
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { region: r, score };
        }
      }
    }
    if (bestMatch && bestMatch.score >= 0.8) {
      draft.regionId = bestMatch.region.id;
      draft.regionName = bestMatch.region.name;
      fieldsFoundCount++;
    }
  }

  // 4. استخراج النقطة الدالة إن وجدت (مثل: قرب، مقابل، خلف، فرع، شارع، عمارة)
  const landmarkMatch = rawText.match(/(?:قرب|مقابل|خلف|يم|بصف|شارع|فرع|عمارة|مجمع|بيت|قطعة)\s+[^,\n;]+/i);
  if (landmarkMatch && !draft.landmark) {
    draft.landmark = landmarkMatch[0].trim();
    fieldsFoundCount++;
  }

  return { updatedDraft: draft, fieldsFoundCount };
}

/**
 * المعالج التفاعلي لإنشاء وتسجيل الزبون خطوة بخطوة
 */
export async function handleCustomerCreationWizard(
  userText: string,
  draft: CustomerDraftState
): Promise<{ handled: boolean; reply: string; nextDraft: CustomerDraftState | null; buttons?: Array<{ text: string; action: string }> }> {
  const clean = userText.replace(/[.،,؟!؟]/g, "").trim().toLowerCase();

  // 1. إلغاء العملية
  if (clean.includes("الغاء") || clean.includes("إلغاء") || clean.includes("كنسل") || clean.includes("بطلت") || clean.includes("مسح")) {
    return {
      handled: true,
      reply: "تم إلغاء تسجيل الزبون ومسح المسودة بنجاح يا غالي 🌸",
      nextDraft: null
    };
  }

  const allRegions = await getCachedRegions();

  // 2. فحص إذا تم إرسال معلومات مجمعة
  const { updatedDraft, fieldsFoundCount } = await parseMultiFieldCustomerInput(userText, draft, allRegions);

  // إذا توفر الهاتف والمنطقة مباشرة
  if (updatedDraft.phone && updatedDraft.regionId) {
    // إذا كان في خطوة extra أو ذكر نقطة دالة/لوكيشن
    if (draft.step === "waiting_extra" || fieldsFoundCount >= 2 || clean.includes("تخطي") || clean.includes("ماكو") || clean.includes("لا يوجد")) {
      return await finalizeAndCreateCustomer(updatedDraft);
    }

    // إذا اكتمل الهاتف والمنطقة ونسأله عن الإضافات (اللوكيشن والنقطة الدالة)
    const extraButtons = [
      { text: "⚡ تخطي وتثبيت الزبون", action: "تخطي وتثبيت" },
      { text: "❌ إلغاء", action: "إلغاء" }
    ];

    return {
      handled: true,
      reply: `تمام يا غالي! مسجل عندي:\n📞 **الهاتف:** ${updatedDraft.phone}\n📍 **المنطقة:** ${updatedDraft.regionName}\n\nعندك رابط لوكيشن أو أقرب نقطة دالة للزبون؟ 🗺️ (اختياري - أو انقر تخطي)`,
      buttons: extraButtons,
      nextDraft: {
        ...updatedDraft,
        step: "waiting_extra"
      }
    };
  }

  // 3. معالجة الخطوات بالتسلسل
  switch (draft.step) {
    case "waiting_phone": {
      const phone = cleanAndNormalizePhone(userText);
      if (phone) {
        const next: CustomerDraftState = { ...draft, phone, step: "waiting_region" };
        const popularRegions = allRegions.slice(0, 4).map(r => ({
          text: `📍 ${r.name}`,
          action: `📍 ${r.name}`
        }));

        return {
          handled: true,
          reply: `عاشت إيدك (${phone})! لأي منطقة هذا الزبون يا أبو الأكبر؟ 📍 (ضروري)`,
          buttons: popularRegions,
          nextDraft: next
        };
      }

      return {
        handled: true,
        reply: "يا أبو الأكبر، يرجى تزويدي برقم هاتف الزبون الصحيح 📞 (مثال: 07701234567)",
        nextDraft: draft
      };
    }

    case "waiting_region": {
      let cleanUser = clean
        .replace(/^الى\s+منطقة\s+/g, "")
        .replace(/^الي\s+منطقة\s+/g, "")
        .replace(/^منطقة\s+/g, "")
        .replace(/^منطقه\s+/g, "")
        .replace(/^📍\s*/g, "")
        .replace(/نار\s*خوز/gi, "نهر خوز")
        .replace(/أعلنها\s*الخوز/gi, "نهر خوز")
        .replace(/اعلنها\s*الخوز/gi, "نهر خوز")
        .trim();

      const scoredRegions = allRegions.map(r => {
        const cleanR = normalizeArabic(r.name);
        let score = 0;
        if (cleanR === cleanUser) score = 1.0;
        else if (cleanR.includes(cleanUser) || cleanUser.includes(cleanR)) score = 0.85;
        else score = calculateSimilarity(cleanR, cleanUser);
        return { region: r, score };
      }).sort((a, b) => b.score - a.score);

      const best = scoredRegions[0];

      if (best && best.score >= 0.6) {
        const matched = best.region;
        const next: CustomerDraftState = {
          ...draft,
          regionId: matched.id,
          regionName: matched.name,
          step: "waiting_extra"
        };

        const extraButtons = [
          { text: "⚡ تخطي وتثبيت الزبون", action: "تخطي وتثبيت" },
          { text: "❌ إلغاء", action: "إلغاء" }
        ];

        return {
          handled: true,
          reply: `ممتاز (${matched.name})! عندك رابط لوكيشن خريطة أو أقرب نقطة دالة؟ 🗺️ (اختياري - أو انقر تخطي)`,
          buttons: extraButtons,
          nextDraft: next
        };
      }

      const topRegions = scoredRegions.slice(0, 4).map(item => item.region);
      const buttons = topRegions.map(r => ({
        text: `📍 ${r.name}`,
        action: `📍 ${r.name}`
      }));

      return {
        handled: true,
        reply: `يا أبو الأكبر، قصدك أي منطقة من هذولي للزبون؟ 👇`,
        buttons,
        nextDraft: draft
      };
    }

    case "waiting_extra": {
      if (
        clean.includes("تخطي") ||
        clean.includes("ماكو") ||
        clean.includes("لا يوجد") ||
        clean.includes("بدون") ||
        clean.includes("تثبيت") ||
        clean.includes("تم")
      ) {
        return await finalizeAndCreateCustomer(draft);
      }

      // التقاط اللوكيشن أو النقطة الدالة
      const urlMatch = userText.match(/https?:\/\/\S+/i);
      let loc = draft.locationUrl || "";
      let land = draft.landmark || "";

      if (urlMatch) {
        loc = urlMatch[0];
      } else {
        land = userText.trim();
      }

      const finalDraft: CustomerDraftState = {
        ...draft,
        locationUrl: loc,
        landmark: land
      };

      return await finalizeAndCreateCustomer(finalDraft);
    }

    default: {
      return {
        handled: true,
        reply: "يا هلا بأبو الأكبر! انطيني رقم هاتف الزبون 📞 (ضروري)",
        nextDraft: { step: "waiting_phone" }
      };
    }
  }
}
