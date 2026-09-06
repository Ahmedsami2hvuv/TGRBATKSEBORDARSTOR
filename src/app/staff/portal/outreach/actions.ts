"use server";

import { prisma } from "@/lib/prisma";
import { verifyStaffEmployeePortalQuery } from "@/lib/staff-employee-portal-link";
import { revalidatePath } from "next/cache";

/**
 * النماذج الـ 24 الافتراضية للإعلانات والتواصل مع الزبائن
 */
export const DEFAULT_OUTREACH_TEMPLATES = [
  {
    id: "tpl_1",
    title: "نموذج 1: تحية وترحيب عام بالزبون",
    content: "مرحباً بك عزيزي الزبون 🌸\nيسعدنا تواصلك مع أبو الأكبر للتوصيل والخدمات السريعة. نوفر لك أسرع خدمة توصيل وأفضل العروض في بغداد والمحافظات 🚗📦. راسلنا في أي وقت وخدمتك شرفنا!",
  },
  {
    id: "tpl_2",
    title: "نموذج 2: عروض التوصيل والخصومات",
    content: "أهلاً وسهلاً بيك 🌹\nعدنا اليوم عروض خاصة وأسعار توصيل مخفضة ومميزة لجميع مناطق بغداد والمحافظات! للتفاصيل والطلب تواصل معنا ومندوبنا يوصلك للباب 🚀📦",
  },
  {
    id: "tpl_3",
    title: "نموذج 3: خدمة سريعة وفورية للطلبات",
    content: "سلام عليكم يا غالي 💐\nمحتاج توصيل سريع ومضمون لأي غرض أو طلبية؟ فريق أبو الأكبر للتوصيل جاهز لخدمتك بأعلى دقة وسرعة قياسية 🛵💨",
  },
  {
    id: "tpl_4",
    title: "نموذج 4: تذكير بالخدمات والمنتجات",
    content: "أهلاً بك عميلنا المميز 🌺\nنود إعلامك بتوفر أحدث المنتجات والعروض الحصرية وتوصيل مباشر لباب بيتك. يسعدنا استقبال طلباتك واستفساراتك بأي وقت 📦✨",
  },
  {
    id: "tpl_5",
    title: "نموذج 5: سرعة وأمان في التوصيل",
    content: "مرحبا عزيزي الزبون 🌟\nخلي توصيلك علينا! سرعة، أمان، وأسعار تناسب الجميع في جميع المناطق. لا تتردد بالطلب وسنكون بخدمتك فوراً 🤝🚗",
  },
  {
    id: "tpl_6",
    title: "نموذج 6: تجهيز الطلبات من المتجر",
    content: "سلام عليكم 🌸\nوفرنا لك أسهل طريقة للتسوق وتجهيز الطلبات مع خدمة توصيل سريعة ودقيقة. جاهزون لخدمتك ومساعدتك في أي طلب تحتاجه 🛍️📦",
  },
  {
    id: "tpl_7",
    title: "نموذج 7: كادر مخصص لخدمة العملاء",
    content: "أهلاً وسهلاً بحضرتك 🌷\nمعك كادر خدمة الزبائن في أبو الأكبر. نحن هنا للإجابة عن كل استفساراتك وتقديم أفضل تجربة توصيل تلبي احتياجاتك 📱❤️",
  },
  {
    id: "tpl_8",
    title: "نموذج 8: عروض نهاية الأسبوع",
    content: "يسعد أوقاتك يا طيب ✨\nعروضنا مستمرة طيلة الأسبوع مع توصيل فوري ومميز لكل المحافظات والمناطق. راسلنا للطلب واستفيد من العرض الآن 🏷️🚚",
  },
  {
    id: "tpl_9",
    title: "نموذج 9: دعم وتواصل مباشر",
    content: "مرحباً بيك 🌹\nنتشرف بوجود رقمك معنا، ويسرنا تقديم كل جديد في خدمات التوصيل والمبيعات بأسعار تنافسية وخدمة تليق بحضرتك 💫📦",
  },
  {
    id: "tpl_10",
    title: "نموذج 10: توصيل آمن وموثوق",
    content: "سلام عليكم ورحمة الله 🌸\nخدمتكم غايتنا! نوفر لك توصيل سريع ومرن يضمن وصول غرضك بأمان وبأفضل وقت ممكن. اطلب الآن وفريقنا جاهز 🛵👌",
  },
  {
    id: "tpl_11",
    title: "نموذج 11: متابعة الطلبات والاستفسارات",
    content: "أهلاً بك عزيزنا الزبون 🌿\nهل تبحث عن متجر موثوق وتوصيل سريع ومباشر؟ تفضل بزيارة صفحتنا أو راسلنا واستمتع بأفضل تجربة تسوق وتوصيل 🛒📦",
  },
  {
    id: "tpl_12",
    title: "نموذج 12: عروض التوفير المميزة",
    content: "مرحبا يا غالي 💐\nمع أبو الأكبر، وفر وقتك وفلوسك! أسعار خاصة لجميع الطلبات وتوصيل فوري لكل الوجهات. لا تتردد بالتواصل معنا 🚀🎯",
  },
  {
    id: "tpl_13",
    title: "نموذج 13: ترحيب خاص بزبائننا",
    content: "أهلاً وسهلاً بك 🌺\nيسعدنا خدمتكم وتلبية جميع طلباتكم بأسرع وقت وأفضل جودة. نحن بخدمتك على مدار الساعة، تفضل بالسؤال أو الطلب 📱✅",
  },
  {
    id: "tpl_14",
    title: "نموذج 14: تشكيلة جديدة وعروض حصرية",
    content: "سلام عليكم 🌟\nوصلتنا منتجات وعروض جديدة ومميزة جداً مع خدمة التوصيل المباشر لباب منزلك. للاطلاع والطلب راسلنا الآن 🛍️🎉",
  },
  {
    id: "tpl_15",
    title: "نموذج 15: توصيل المحافظات وبغداد",
    content: "مرحباً بحضرتك 🌸\nنوصل لك وين ما تكون داخل بغداد وجميع المحافظات بسرعة وأمان تام. فريقنا بانتظار خدمتك والرد على كل استفساراتك 🚚📦",
  },
  {
    id: "tpl_16",
    title: "نموذج 16: طلبات فورية خلال دقائق",
    content: "أهلاً وسهلاً 🌷\nجاهزون لتنفيذ وتجهيز طلباتك وإرسالها فوراً مع كباتن التوصيل المحترفين. راسلنا الآن لمعرفة التفاصيل 🛵✨",
  },
  {
    id: "tpl_17",
    title: "نموذج 17: متابعة دورية واهتمام بالزبون",
    content: "يسعد صباحك/مساك يا طيب 💐\nشاكرين اهتمامك وثقتك بنا، ويسعدنا دائماً تقديم أفضل الخدمات والعروض الحصرية لك. بخدمتك دائماً 🤝📦",
  },
  {
    id: "tpl_18",
    title: "نموذج 18: أسعار خاصة وتوصيل مضمون",
    content: "سلام عليكم ورحمة الله 🌹\nاطلب الآن واستفد من أسعارنا الحصرية للتوصيل والخدمات السريعة. راحتك ووصول طلبك بأمان أولويتنا 🚗👌",
  },
  {
    id: "tpl_19",
    title: "نموذج 19: تنسيق وتجهيز فوري",
    content: "مرحباً عزيزي 🌿\nإذا كان عندك أي طلب أو غرض تحتاج توصيله أو شرائه، كادرنا جاهز للتنسيق والتجهيز الفوري بدون أي تأخير 📦💨",
  },
  {
    id: "tpl_20",
    title: "نموذج 20: خدمات احترافية متكاملة",
    content: "أهلاً وسهلاً بيك يا غالي 🌸\nنقدم لك تجربة تسوق وتوصيل متكاملة تجمع بين السرعة، الجودة، وأفضل الأسعار. يسعدنا تواصلك 📱💫",
  },
  {
    id: "tpl_21",
    title: "نموذج 21: توصيل من الباب إلى الباب",
    content: "سلام عليكم 💐\nخدمة توصيل مريحة من الباب للباب مع كادر متخصص ومحترف. اطلب بكل ثقة ونحن نعتني بالباقي 🛵📦",
  },
  {
    id: "tpl_22",
    title: "نموذج 22: باقات وعروض متجددة",
    content: "مرحبا بحضرتك 🌟\nباقات وعروض جديدة متوفرة اليوم! تواصل معنا عبر الواتساب لمعرفة العروض المتاحة وحجز طلبك مباشرة 🛍️🚀",
  },
  {
    id: "tpl_23",
    title: "نموذج 23: رد فوري وخدمة ممتازة",
    content: "أهلاً وسهلاً بك 🌷\nفريق العمل جاهز للرد على رسالتك فوراً وتأكيد أي طلب أو استفسار. شرفنا بتعاملك معنا دائماً 💬✨",
  },
  {
    id: "tpl_24",
    title: "نموذج 24: كل ما تحتاجه في مكان واحد",
    content: "سلام عليكم يا طيب 🌺\nكل ما تحتاجه من خدمات توصيل وتجهيز طلبات في مكان واحد مع أفضل الأسعار والمعاملة الطيبة. بانتظار تواصلك 📦🤝",
  },
];

/**
 * دالة مساعدة لتنظيف الأرقام والروابط واستخراج الأرقام بصيغة دولية موحدة
 */
export async function sanitizePhoneAndExtract(input: string): Promise<string | null> {
  if (!input) return null;
  let text = input.trim();

  // إذا كان رابط واتساب، نستخرج الجزء الرقمي
  const waMeMatch = text.match(/(?:wa\.me\/|phone=|send\?phone=|\/)([0-9+]+)/i);
  if (waMeMatch && waMeMatch[1]) {
    text = waMeMatch[1];
  }

  // إزالة كل الحروف والرموز ما عدا الأرقام و علامة +
  let cleaned = text.replace(/[^0-9+]/g, "");

  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  // إذا كان الرقم عراقي يبدأ بـ 07 (مثل 07701234567)
  if (cleaned.startsWith("07") && cleaned.length === 11) {
    cleaned = "964" + cleaned.substring(1);
  }
  // إذا كان يبدأ بـ 7 مباشرة (مثل 7701234567) بطول 10 أرقام
  else if ((cleaned.startsWith("7") || cleaned.startsWith("8")) && cleaned.length === 10) {
    cleaned = "964" + cleaned;
  }
  // إذا كان يبدأ بـ 96407 (بها صفر إضافي)
  else if (cleaned.startsWith("96407") && cleaned.length === 14) {
    cleaned = "964" + cleaned.substring(4);
  }

  // التحقق من صحة طول الرقم
  if (cleaned.length >= 8 && cleaned.length <= 16) {
    return cleaned;
  }

  return null;
}

/**
 * دالة مساعدة نقية لاستخراج الأرقام
 */
function cleanPhonePure(input: string): string | null {
  if (!input) return null;
  let text = input.trim();

  const waMeMatch = text.match(/(?:wa\.me\/|phone=|send\?phone=|\/)([0-9+]+)/i);
  if (waMeMatch && waMeMatch[1]) {
    text = waMeMatch[1];
  }

  let cleaned = text.replace(/[^0-9+]/g, "");

  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith("00")) {
    cleaned = cleaned.substring(2);
  }

  if (cleaned.startsWith("07") && cleaned.length === 11) {
    cleaned = "964" + cleaned.substring(1);
  } else if ((cleaned.startsWith("7") || cleaned.startsWith("8")) && cleaned.length === 10) {
    cleaned = "964" + cleaned;
  } else if (cleaned.startsWith("96407") && cleaned.length === 14) {
    cleaned = "964" + cleaned.substring(4);
  }

  if (cleaned.length >= 8 && cleaned.length <= 16) {
    return cleaned;
  }

  return null;
}

/**
 * استخراج كل الأرقام من نص طويل أو أسطر متعددة
 */
export async function extractAllPhonesFromText(rawText: string): Promise<{ phone: string; originalInput: string }[]> {
  if (!rawText) return [];

  const lines = rawText.split(/[\r\n,;]+/);
  const seen = new Set<string>();
  const results: { phone: string; originalInput: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const phone = cleanPhonePure(trimmed);
    if (phone && !seen.has(phone)) {
      seen.add(phone);
      results.push({ phone, originalInput: trimmed });
    } else {
      const matches = trimmed.match(/(?:https?:\/\/wa\.me\/[0-9+]+|07[3-9][0-9]{8}|9647[3-9][0-9]{8}|\+9647[3-9][0-9]{8})/g);
      if (matches) {
        for (const m of matches) {
          const p = cleanPhonePure(m);
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

/**
 * التحقق من صلاحية وصول الموظف عبر التوقيع
 */
async function verifyStaff(staffEmployeeId: string, token: string, sig: string) {
  const v = verifyStaffEmployeePortalQuery(staffEmployeeId, token, sig);
  if (!v.ok) throw new Error("جلسة الموظف غير صالحة أو منتهية.");
  const emp = await prisma.staffEmployee.findUnique({
    where: { id: staffEmployeeId },
  });
  if (!emp || !emp.active) throw new Error("حساب الموظف غير نشط.");
  return emp;
}

/**
 * جلب بيانات المهمة للموظف (القائمة النشطة، الأرقام المكتملة، والنماذج)
 */
export async function getOutreachDataAction(staffEmployeeId: string, token: string, sig: string) {
  try {
    const emp = await verifyStaff(staffEmployeeId, token, sig);

    // 1. جلب النماذج الإعلانية الخاصة بالموظف أو العامة
    let templates = await prisma.staffOutreachTemplate.findMany({
      where: {
        OR: [{ staffEmployeeId: emp.id }, { staffEmployeeId: null }],
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // إذا لم تكن هناك أي نماذج، ننشئ النماذج الافتراضية الـ 24 تلقائياً
    if (templates.length === 0) {
      await prisma.staffOutreachTemplate.createMany({
        data: DEFAULT_OUTREACH_TEMPLATES.map((t) => ({
          staffEmployeeId: emp.id,
          title: t.title,
          content: t.content,
          isActive: true,
        })),
      });

      templates = await prisma.staffOutreachTemplate.findMany({
        where: { staffEmployeeId: emp.id, isActive: true },
        orderBy: { createdAt: "asc" },
      });
    }

    // 2. جلب آخر قائمة نشطة للموظف
    let latestList = await prisma.staffOutreachList.findFirst({
      where: { staffEmployeeId: emp.id },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return {
      ok: true,
      data: {
        list: latestList ? {
          id: latestList.id,
          title: latestList.title,
          createdAt: latestList.createdAt.toISOString(),
          items: latestList.items.map((i) => ({
            id: i.id,
            phone: i.phone,
            originalInput: i.originalInput,
            status: i.status as "pending" | "whatsapp_opened" | "completed",
            templateUsed: i.templateUsed,
            openedAt: i.openedAt?.toISOString() || null,
            completedAt: i.completedAt?.toISOString() || null,
            createdAt: i.createdAt.toISOString(),
          })),
        } : null,
        templates: templates.map((t) => ({
          id: t.id,
          title: t.title,
          content: t.content,
          isActive: t.isActive,
        })),
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في جلب البيانات." };
  }
}

/**
 * إنشاء أو استيراد قائمة أرقام جديدة
 */
export async function createOutreachListAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { title?: string; rawText: string; appendToExisting?: boolean }
) {
  try {
    const emp = await verifyStaff(staffEmployeeId, token, sig);
    const extracted = await extractAllPhonesFromText(payload.rawText);

    if (extracted.length === 0) {
      return { ok: false, error: "لم يتم العثور على أي أرقام هواتف أو روابط صالحة في النص المكتوب." };
    }

    let targetListId: string;

    if (payload.appendToExisting) {
      const existing = await prisma.staffOutreachList.findFirst({
        where: { staffEmployeeId: emp.id },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        targetListId = existing.id;
      } else {
        const newList = await prisma.staffOutreachList.create({
          data: {
            staffEmployeeId: emp.id,
            title: payload.title?.trim() || `قائمة ${new Date().toLocaleDateString("ar-IQ")}`,
          },
        });
        targetListId = newList.id;
      }
    } else {
      const newList = await prisma.staffOutreachList.create({
        data: {
          staffEmployeeId: emp.id,
          title: payload.title?.trim() || `قائمة زبائن (${extracted.length} رقم) - ${new Date().toLocaleDateString("ar-IQ")}`,
        },
      });
      targetListId = newList.id;
    }

    // تجنب إضافة أرقام مكررة موجودة مسبقاً في نفس القائمة
    const existingItems = await prisma.staffOutreachItem.findMany({
      where: { listId: targetListId },
      select: { phone: true },
    });
    const existingPhones = new Set(existingItems.map((i) => i.phone));

    const newItems = extracted.filter((e) => !existingPhones.has(e.phone));

    if (newItems.length > 0) {
      await prisma.staffOutreachItem.createMany({
        data: newItems.map((item) => ({
          listId: targetListId,
          phone: item.phone,
          originalInput: item.originalInput,
          status: "pending",
        })),
      });
    }

    revalidatePath("/staff/portal/outreach");
    return {
      ok: true,
      message: `تم إضافة ${newItems.length} رقم بنجاح ${extracted.length > newItems.length ? `(تم تجاهل ${extracted.length - newItems.length} رقم مكرر)` : ""}`,
      listId: targetListId,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في إنشاء القائمة." };
  }
}

/**
 * تحديث حالة رقم معين (تم فتح الواتساب أو تم الاتصال/مكتمل)
 */
export async function updateItemStatusAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { itemId: string; status: "pending" | "whatsapp_opened" | "completed"; templateUsed?: string }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);

    const updateData: any = {
      status: payload.status,
    };

    if (payload.templateUsed) {
      updateData.templateUsed = payload.templateUsed;
    }

    if (payload.status === "whatsapp_opened") {
      updateData.openedAt = new Date();
    } else if (payload.status === "completed") {
      updateData.completedAt = new Date();
    } else if (payload.status === "pending") {
      updateData.openedAt = null;
      updateData.completedAt = null;
    }

    await prisma.staffOutreachItem.update({
      where: { id: payload.itemId },
      data: updateData,
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في تحديث حالة الرقم." };
  }
}

/**
 * حذف رقم معين من القائمة
 */
export async function deleteItemAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { itemId: string }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);
    await prisma.staffOutreachItem.delete({
      where: { id: payload.itemId },
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في حذف الرقم." };
  }
}

/**
 * تفريغ أو مسح القائمة
 */
export async function clearListAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { listId: string; onlyCompleted?: boolean }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);
    if (payload.onlyCompleted) {
      await prisma.staffOutreachItem.deleteMany({
        where: { listId: payload.listId, status: "completed" },
      });
    } else {
      await prisma.staffOutreachItem.deleteMany({
        where: { listId: payload.listId },
      });
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في مسح القائمة." };
  }
}

/**
 * إضافة أو تعديل نموذج رسالة إعلانية
 */
export async function saveTemplateAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { templateId?: string; title: string; content: string; isActive?: boolean }
) {
  try {
    const emp = await verifyStaff(staffEmployeeId, token, sig);

    if (payload.templateId) {
      await prisma.staffOutreachTemplate.update({
        where: { id: payload.templateId },
        data: {
          title: payload.title.trim(),
          content: payload.content.trim(),
          isActive: payload.isActive !== undefined ? payload.isActive : true,
        },
      });
    } else {
      await prisma.staffOutreachTemplate.create({
        data: {
          staffEmployeeId: emp.id,
          title: payload.title.trim(),
          content: payload.content.trim(),
          isActive: true,
        },
      });
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في حفظ النموذج." };
  }
}

/**
 * حذف نموذج رسالة
 */
export async function deleteTemplateAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { templateId: string }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);
    await prisma.staffOutreachTemplate.delete({
      where: { id: payload.templateId },
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في حذف النموذج." };
  }
}

/**
 * استخراج أرقام الهواتف من صورة عبر الذكاء الاصطناعي (Gemini Vision)
 */
export async function extractPhonesFromImageWithAIAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  base64Image: string
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);

    if (!base64Image || typeof base64Image !== "string") {
      return { ok: false, error: "لم يتم استلام الصورة بشكل صحيح." };
    }

    const { getAllActiveGeminiKeys, markGeminiKeySuccess, markGeminiKeyError } = await import("@/lib/gemini-pool");
    const keys = await getAllActiveGeminiKeys();

    if (keys.length === 0) {
      return { ok: false, error: "لا يوجد مفتاح ذكاء اصطناعي متاح حالياً. يرجى التأكد من إضافة مفاتيح في الإعدادات." };
    }

    let cleanBase64 = base64Image;
    let mimeType = "image/jpeg";

    if (base64Image.startsWith("data:")) {
      const parts = base64Image.split(";base64,");
      if (parts.length === 2) {
        mimeType = parts[0].replace("data:", "").split(";")[0] || "image/jpeg";
        cleanBase64 = parts[1];
      }
    }

    const prompt = `أنت خبير فائق الدقة في استخراج أرقام الهواتف وروابط الواتساب من الصور، لقطات الشاشة، والمستندات.
مهمتك:
1. استخرج كل أرقام الهواتف (العراقية والدولية) الموجودة في هذه الصورة بدقة متناهية.
2. استخرج أي روابط واتساب (مثل wa.me أو api.whatsapp.com) إن وجدت.
3. تجاهل أي أرقام أخرى لا تمثل أرقام هواتف (مثل الأسعار، التواريخ، أو أرقام الطلبات القصيرة).
4. أرجع النتيجة على شكل قائمة بالأرقام فقط، كل رقم في سطر مستقل بدون أي نصوص أو مقدمات أو شرح إضافي.`;

    let extractedText = "";
    let lastError = "";

    const candidateModels = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"];

    for (const k of keys) {
      for (const model of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${k.key}`;
          const body = {
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
          };

          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

          if (res.ok) {
            const data = await res.json();
            const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResult && typeof textResult === "string" && textResult.trim()) {
              extractedText = textResult;
              await markGeminiKeySuccess(k.id);
              break;
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            lastError = errData?.error?.message || `HTTP ${res.status}`;
            await markGeminiKeyError(k.id);
          }
        } catch (e: any) {
          lastError = e?.message || "فشل الاتصال بـ Gemini API";
        }
      }
      if (extractedText) break;
    }

    if (!extractedText) {
      return { ok: false, error: lastError || "لم يتمكن الذكاء الاصطناعي من قراءة الصورة أو استخراج الأرقام منها." };
    }

    const phones = await extractAllPhonesFromText(extractedText);
    if (phones.length === 0) {
      return { ok: false, error: "تم فحص الصورة بنجاح بواسطة الذكاء الاصطناعي ولكن لم يتم العثور على أرقام هواتف واضحة فيها." };
    }

    return {
      ok: true,
      rawText: phones.map((p) => p.phone).join("\n"),
      count: phones.length,
      phones,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "حدث خطأ غير متوقع أثناء استخراج الأرقام بالذكاء الاصطناعي." };
  }
}

/**
 * حذف أرقام متعددة دفعة واحدة (Bulk Delete)
 */
export async function bulkDeleteItemsAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { itemIds: string[] }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);
    if (!payload.itemIds || payload.itemIds.length === 0) {
      return { ok: false, error: "لم يتم تحديد أي أرقام للحذف." };
    }

    await prisma.staffOutreachItem.deleteMany({
      where: { id: { in: payload.itemIds } },
    });

    return { ok: true, count: payload.itemIds.length };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في حذف الأرقام المحددة." };
  }
}

/**
 * تحديث حالة أرقام متعددة دفعة واحدة (Bulk Status Update)
 */
export async function bulkUpdateItemStatusAction(
  staffEmployeeId: string,
  token: string,
  sig: string,
  payload: { itemIds: string[]; status: "pending" | "whatsapp_opened" | "completed" }
) {
  try {
    await verifyStaff(staffEmployeeId, token, sig);
    if (!payload.itemIds || payload.itemIds.length === 0) {
      return { ok: false, error: "لم يتم تحديد أي أرقام." };
    }

    const updateData: any = { status: payload.status };
    if (payload.status === "completed") {
      updateData.completedAt = new Date();
    } else if (payload.status === "whatsapp_opened") {
      updateData.openedAt = new Date();
    } else if (payload.status === "pending") {
      updateData.openedAt = null;
      updateData.completedAt = null;
    }

    await prisma.staffOutreachItem.updateMany({
      where: { id: { in: payload.itemIds } },
      data: updateData,
    });

    return { ok: true, count: payload.itemIds.length };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في تحديث حالة الأرقام المحددة." };
  }
}

/**
 * استعادة النماذج الـ 24 الافتراضية
 */
export async function resetDefaultTemplatesAction(staffEmployeeId: string, token: string, sig: string) {
  try {
    const emp = await verifyStaff(staffEmployeeId, token, sig);
    await prisma.staffOutreachTemplate.deleteMany({
      where: { staffEmployeeId: emp.id },
    });

    await prisma.staffOutreachTemplate.createMany({
      data: DEFAULT_OUTREACH_TEMPLATES.map((t) => ({
        staffEmployeeId: emp.id,
        title: t.title,
        content: t.content,
        isActive: true,
      })),
    });

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "فشل في استعادة النماذج." };
  }
}
