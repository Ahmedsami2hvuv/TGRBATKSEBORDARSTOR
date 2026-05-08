import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PortalKey = "admin" | "mandoub" | "preparer" | "store";
type TrainingItem = {
  id: string;
  title: string;
  instruction: string;
  isActive: boolean;
};

type ChatResponseShape = {
  text: string;
  actions?: any[] | null;
};

function extractPhone(text: string): string | null {
  const m = text.match(/(?:\+964|0)?7\d{9}/);
  return m ? m[0] : null;
}

function extractOrderNumber(text: string): number | null {
  const m = text.match(/(?:طلب(?:ية)?\s*رقم|رقم)\s*(\d{1,8})/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function cleanLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function runAdminCommandRouter(prompt: string): Promise<ChatResponseShape | null> {
  const text = prompt.trim();
  const lowered = text.toLowerCase();

  // 1) فتح معلومات زبون
  if (text.includes("افتح معلومات زبون") || text.includes("معلومات زبون")) {
    const phone = extractPhone(text);
    if (!phone) {
      return { text: "اكتب رقم الزبون حتى أفتح معلوماته." };
    }
    return {
      text: "تمام، افتحلك ملف الزبون هسة.",
      actions: [{ type: "OPEN_CUSTOMER", payload: { phone } }],
    };
  }

  // 1.5) فتح طلب برقمه مباشرة
  if (text.includes("افتح") && (text.includes("طلب") || text.includes("طلبية"))) {
    const orderNumber = extractOrderNumber(text);
    if (orderNumber != null) {
      const order = await prisma.order.findUnique({
        where: { orderNumber },
        select: { id: true, orderNumber: true },
      });
      if (!order) {
        return { text: `ما لقيت طلب برقم ${orderNumber}.` };
      }
      return {
        text: `تمام، افتحلك الطلب رقم ${order.orderNumber}.`,
        actions: [{ type: "OPEN_ORDER", payload: { orderId: order.id } }],
      };
    }
  }

  // 2) إنشاء/تحديث زبون مرجعي
  if (text.includes("زبون مرجعي") || text.includes("ضيف زبون")) {
    const phone = extractPhone(text);
    const locMatch = text.match(/https?:\/\/\S+/);
    const locationUrl = locMatch?.[0] || "";
    const regionNameMatch = text.match(/(?:منطقة|المنطقة)\s*[:：]?\s*([^\n،,]+)/);
    const regionName = regionNameMatch?.[1]?.trim() || "";
    return {
      text: phone
        ? "تمام، راح أحفظ الزبون المرجعي."
        : "أحتاج رقم الزبون حتى أحفظه مرجعي.",
      actions: phone
        ? [
            {
              type: "CREATE_CUSTOMER_REFERENCE",
              payload: {
                phone,
                regionName,
                locationUrl,
                landmark: "",
                notes: "مضاف من دردشة الإدارة",
              },
            },
          ]
        : null,
    };
  }

  // 3) إسناد طلبية لمندوب
  if (lowered.includes("اسند") && (lowered.includes("طلب") || lowered.includes("طلبية"))) {
    const orderNumber = extractOrderNumber(text);
    if (!orderNumber) return { text: "اكتب رقم الطلبية حتى أسندها." };

    const couriers = await prisma.courier.findMany({
      where: { blocked: false, availableForAssignment: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 20,
    });

    if (couriers.length === 0) {
      return { text: "ماكو مندوبين متاحين حاليًا." };
    }

    return {
      text: "اختار المندوب للإسناد:",
      actions: [
        {
          type: "SHOW_OPTIONS",
          payload: {
            items: couriers.map((c) => ({
              id: c.id,
              name: c.name,
              action: {
                type: "ASSIGN_ORDER_TO_COURIER",
                payload: { orderNumber, courierId: c.id },
              },
            })),
          },
        },
      ],
    };
  }

  // 4) نص يشبه طلب تجهيز (اسم/عنوان + هاتف + مواد)
  const lines = cleanLines(text);
  const phone = extractPhone(text);
  if (lines.length >= 3 && phone && (text.includes("ك") || text.includes("طلب تجهيز") || text.includes("بطاطا") || text.includes("خيار"))) {
    const firstLine = lines[0] || "طلب تجهيز من الشات";
    const productLines = lines.filter((l) => l !== firstLine && !l.includes(phone));
    const preparers = await prisma.companyPreparer.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 20,
    });

    if (preparers.length === 0) {
      return { text: "ماكو مجهزين فعالين حالياً حتى أسند الطلب." };
    }

    return {
      text: "هذا واضح طلب تجهيز. اختار المجهز حتى أنشئه وأسنده مباشرة.",
      actions: [
        {
          type: "SHOW_OPTIONS",
          payload: {
            items: preparers.map((p) => ({
              id: p.id,
              name: p.name,
              action: {
                type: "CREATE_PREPARATION_DRAFT",
                payload: {
                  titleLine: `طلب تجهيز - ${firstLine}`,
                  customerName: firstLine,
                  customerPhone: phone,
                  regionName: firstLine,
                  customerLandmark: "",
                  orderTime: "فوري",
                  products: productLines,
                  preparerIds: [p.id],
                },
              },
            })),
          },
        },
      ],
    };
  }

  return null;
}

function extractJsonActions(text: string): any[] {
  const out: any[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }
    if (ch === "}") {
      if (depth > 0) depth--;
      if (depth === 0 && start >= 0) {
        const candidate = text.slice(start, i + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
            out.push(parsed);
          }
        } catch {
          // ignore non-json blocks
        }
        start = -1;
      }
    }
  }
  return out;
}

function detectPortal(context: any): PortalKey {
  const role = String(context?.role || "").toLowerCase();
  const path = String(context?.path || "").toLowerCase();
  if (role === "admin" || path.includes("/admin")) return "admin";
  if (role === "preparer" || path.includes("/preparer")) return "preparer";
  if (role === "courier" || role === "mandoub" || path.includes("/mandoub")) return "mandoub";
  return "store";
}

function sanitizeTrainingList(raw: any): TrainingItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => ({
      id: String(it?.id || "").trim(),
      title: String(it?.title || "").trim(),
      instruction: String(it?.instruction || "").trim(),
      isActive: it?.isActive !== false,
    }))
    .filter((it) => it.id && it.instruction && it.isActive);
}

function basePromptByPortal(portal: PortalKey, productsText: string): string {
  if (portal === "admin") {
    return `أنت مساعد خاص ببوابة الإدارة.
مهمتك مساعدة المدير داخل النظام: ترتيب المهام، توضيح الخطوات، واقتراح التنقل المناسب داخل صفحات الإدارة.
الأوامر المهمة للإدارة:
- إسناد طلبية: {"type":"NAVIGATE_ADMIN_PENDING_ASSIGN","payload":{"orderId":"ORDER_ID"}}
- فتح معلومات زبون: {"type":"OPEN_CUSTOMER","payload":{"phone":"077...","regionId":""}}
- فتح أي صفحة إدارة: {"type":"NAVIGATE","payload":{"url":"/admin/..."}}
- قبل الإسناد إذا يحتاج اختيار شخص، ارجع خيارات: {"type":"SHOW_OPTIONS","payload":{"items":[{"id":"...","name":"..."}]}}
إذا المستخدم كتب نص يشبه طلب تجهيز (اسم + هاتف + مواد)، اعتبره مسودة طلب واطلب منه تأكيد الإسناد.
تكلم بلهجة عراقية واضحة ومهنية.`;
  }

  if (portal === "preparer") {
    return `أنت مساعد خاص ببوابة المجهز.
مهمتك مساعدة المجهز في تجهيز الطلبات: فهم الطلب، ترتيب الخطوات، والتنبيه على النقاط المهمة.
إذا كان مناسب فتح طلب/تجهيز، تقدر تستخدم OPEN_ORDER مع رقم/معرف الطلب.
إذا المستخدم أعطاك قائمة مواد، لخصها سريعاً واسأل: "أسندها لمن؟" وإذا متوفر خيارات رجّع SHOW_OPTIONS.
تكلم بلهجة عراقية عملية ومختصرة.`;
  }

  if (portal === "mandoub") {
    return `أنت مساعد خاص ببوابة المندوب.
مهمتك مساعدة المندوب بالتوصيل: ترتيب المشوار، متابعة الحالة، وتذكير بنقاط التسليم والتحصيل.
إذا كان مناسب فتح طلب، تقدر تستخدم OPEN_ORDER.
إذا يحتاج اختيار بين عدة خيارات، استخدم SHOW_OPTIONS حتى تظهر كأزرار.
تكلم بلهجة عراقية ميدانية بسيطة.`;
  }

  return `أنت "مساعد مبيعات أبو الأكبر". مهمتك تحويل القائمة المكتوبة إلى سلة تسوق.

المنتجات المتوفرة حالياً في المتجر والتي تشبه طلب المستخدم:
${productsText}

طريقة العمل:
1. حلل القائمة: استخرج الاسم، الرقم، وكل مادة.
2. المواد الواضحة (مثل موز، خيار): إذا وجدتها مطابقة تماماً لمنتج واحد، أرسل أمر ADD_TO_CART.
3. المواد المتعددة (مثل لبن، كيك): إذا وجدتها تحتمل أكثر من منتج، اعرض الخيارات للمستخدم واطلب منه الاختيار.
4. المعلومات الشخصية: احفظ الاسم والرقم في ذاكرتك.
5. إذا طلب المستخدم منتج بوصف عام مثل "مشروب فراولة"، اعرض المنتجات المطابقة باستخدام SHOW_OPTIONS.

الأوامر التنفيذية (يمكنك إرسال مصفوفة JSON أو كائن واحد):
- إضافة للسلة: {"type": "ADD_TO_CART", "payload": {"id": "ID", "name": "Name", "price": 0}}
- اقتراح خيارات: {"type": "SHOW_OPTIONS", "payload": {"items": [{"id": "", "name": ""}]}}
- اكمال الطلب: {"type": "ASK_ADDRESS", "payload": {}}`;
}

export async function POST(req: Request) {
  try {
    const { prompt, history, context } = await req.json();
    const portal = detectPortal(context);

    const activeConfigs = await prisma.aIConfig.findMany({
      where: {
        isActive: true,
        provider: { not: "removebg" }
      },
      orderBy: { usedToday: 'asc' }
    });

    if (activeConfigs.length === 0) {
      return NextResponse.json({
        text: portal === "admin"
          ? "ماكو محرك ذكاء مفعّل حالياً. لكن أكدر أنفذ الأوامر الإدارية المباشرة مثل فتح طلب/إسناد/فتح زبون."
          : "لا توجد مفاتيح ذكاء مفعلة حالياً.",
      });
    }

    // 1. استخراج الكلمات المفتاحية للبحث عن المنتجات
    const lines = prompt.split("\n");
    const searchKeywords = lines.flatMap((l: string) => l.split(" ")).filter((w: string) => w.length > 2);

    const allMatchedProducts = await prisma.storeProduct.findMany({
      where: {
        OR: searchKeywords.map((k: string) => ({
          OR: [
            { name: { contains: k, mode: 'insensitive' } },
            { description: { contains: k, mode: 'insensitive' } },
            { branch: { name: { contains: k, mode: 'insensitive' } } }
          ]
        })),
        active: true
      },
      include: { branch: true }
    });

    if (portal === "admin") {
      const routed = await runAdminCommandRouter(prompt);
      if (routed) {
        return NextResponse.json({
          text: routed.text,
          actions: routed.actions ?? null,
        });
      }
    }

    const trainingRow = await prisma.uISystemSetting.findUnique({
      where: { target_section: { target: "global", section: "ai_portal_training" } },
    });
    const byPortal = (trainingRow?.config as any)?.byPortal || {};
    let adminExecutionContext = "";
    if (portal === "admin") {
      const [preparers, couriers, recentPendingOrders] = await Promise.all([
        prisma.companyPreparer.findMany({
          where: { active: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
          take: 20,
        }),
        prisma.courier.findMany({
          where: { blocked: false, availableForAssignment: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
          take: 20,
        }),
        prisma.order.findMany({
          where: { status: { in: ["pending", "assigned", "delivering"] } },
          orderBy: { createdAt: "desc" },
          select: { id: true, orderNumber: true, customerPhone: true, status: true },
          take: 20,
        }),
      ]);

      adminExecutionContext = `
بيانات تنفيذية للإدارة:
- المجهزين المتاحين: ${JSON.stringify(preparers)}
- المندوبين المتاحين: ${JSON.stringify(couriers)}
- الطلبات القريبة: ${JSON.stringify(recentPendingOrders)}

أوامر تنفيذ فعلية (عند وجود بيانات كافية):
- إنشاء/تحديث زبون مرجعي: {"type":"CREATE_CUSTOMER_REFERENCE","payload":{"phone":"077...","regionName":"...","landmark":"...","locationUrl":"...","alternatePhone":"","notes":""}}
- إنشاء طلب تجهيز: {"type":"CREATE_PREPARATION_DRAFT","payload":{"titleLine":"...","customerName":"...","customerPhone":"...","regionName":"...","customerLandmark":"...","orderTime":"فوري","products":["بطاطا 3ك","خيار 2ك"],"preparerIds":["..."]}}
- إسناد طلبية لمندوب: {"type":"ASSIGN_ORDER_TO_COURIER","payload":{"orderId":"...","orderNumber":"...","courierId":"..."}}

إذا ينقص اختيار الشخص، رجّع SHOW_OPTIONS بخيارات من القوائم أعلاه.`;
    }

    const activePortalTraining = sanitizeTrainingList(byPortal[portal]);
    const portalTrainingPrompt =
      activePortalTraining.length > 0
        ? `\nتعليمات التدريب الخاصة بالبوابة الحالية (${portal}):\n${activePortalTraining
            .map((t, idx) => `${idx + 1}. ${t.title ? `[${t.title}] ` : ""}${t.instruction}`)
            .join("\n")}\n`
        : "";

    const productsText = allMatchedProducts
      .map((p) => `- [${p.name}] في فرع [${p.branch.name}] بسعر ${p.salePrice} (ID: ${p.id})`)
      .join("\n");
    const basePrompt = basePromptByPortal(portal, productsText);
    const agentSystemPrompt = `${basePrompt}
${portalTrainingPrompt}
${adminExecutionContext}
تكلم بلهجة عراقية مناسبة للبوابة الحالية وبشكل مختصر وواضح.`;

    for (const config of activeConfigs) {
      try {
        const provider = String(config.provider || "").toLowerCase();
        const isGemini = provider === "gemini";
        const url =
          provider === "gemini"
            ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.apiKey}`
            : provider === "openai"
              ? "https://api.openai.com/v1/chat/completions"
              : provider === "deepseek"
                ? "https://api.deepseek.com/chat/completions"
                : "https://api.groq.com/openai/v1/chat/completions";

        // تجهيز سياق المحادثة (History)
        const chatHistory = (Array.isArray(history) ? history : [])
          .filter((h: any) => h.content && typeof h.content === "string")
          .map((h: any) => ({
            role: h.role === "assistant" ? (isGemini ? "model" : "assistant") : "user",
            content: h.content,
            parts: isGemini ? [{ text: h.content }] : undefined
          }));

        const body = isGemini
          ? {
              system_instruction: { parts: [{ text: agentSystemPrompt + "\n\nسياق البوابة الحالي: " + JSON.stringify(context) }] },
              contents: [
                ...chatHistory.map(h => ({ role: h.role, parts: h.parts })),
                { role: "user", parts: [{ text: prompt }] }
              ],
            }
          : {
              model:
                provider === "openai"
                  ? "gpt-4o-mini"
                  : provider === "deepseek"
                    ? "deepseek-chat"
                    : "llama-3.3-70b-versatile",
              messages: [
                { role: "system", content: agentSystemPrompt + "\n\nسياق البوابة الحالي: " + JSON.stringify(context) },
                ...chatHistory.map(h => ({ role: h.role, content: h.content })),
                { role: "user", content: prompt },
              ],
            };

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(isGemini ? {} : { "Authorization": `Bearer ${config.apiKey}` }) },
          body: JSON.stringify(body)
        });

        const data = await response.json();
        const fullText = isGemini ? data.candidates?.[0]?.content?.parts?.[0]?.text : data.choices?.[0]?.message?.content;

        if (fullText) {
          // استخراج كافة الأوامر من النص (قد يرسل الذكاء أكثر من أمر)
          const actions = extractJsonActions(fullText);

          await prisma.aIConfig.update({ where: { id: config.id }, data: { usedToday: { increment: 1 } } });
          return NextResponse.json({
            text: fullText.replace(/\{[\s\S]*?"type"[\s\S]*?\}/g, "").trim(),
            actions: actions.length > 0 ? actions : null
          });
        }
      } catch (err) { continue; }
    }
    return NextResponse.json({
      text:
        portal === "admin"
          ? "ما قدرت أتصل بمحرك الذكاء حالياً. جرب بعد دقيقة، أو اكتب أمر إداري مباشر مثل: افتح طلب رقم 5."
          : "المحرك مشغول حالياً.",
    });
  } catch (error) {
    return NextResponse.json({ text: "خطأ فني." }, { status: 500 });
  }
}
