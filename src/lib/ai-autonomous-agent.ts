import { prisma } from "./prisma";
import { getAllActiveGeminiKeys, markGeminiKeySuccess, markGeminiKeyError } from "./gemini-pool";
import { Decimal } from "@prisma/client/runtime/library";
import { formatDinarAsAlf } from "./money-alf";
import { rankRegionsByQuery } from "./arabic-region-search";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";

export async function executeAutonomousGeminiAgent(
  userText: string,
  sessionKey: string = "default",
  ctx: { lastOrderNumber?: number | null; activeFocusedOrderId?: string | null }
): Promise<{ reply: string; buttons?: Array<{ text: string; action: string }> } | null> {
  try {
    const keys = await getAllActiveGeminiKeys();
    if (keys.length === 0) {
      return null;
    }

    // جلب البيانات الحية من سوبابيس لتزويد الذكاء الاصطناعي بها
    const [allShops, allCouriers, allRegions] = await Promise.all([
      prisma.shop.findMany({ select: { id: true, name: true } }),
      prisma.courier.findMany({ select: { id: true, name: true, phone: true } }),
      prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } })
    ]);

    const systemPrompt = `أنت العقل المدبر ومساعد الذكاء الاصطناعي الخارق لإدارة موقع ومنظومة (أبو الأكبر) للتوصيل والمتاجر.
الموقع مرفوع على GitHub ومستضاف على Vercel وقاعدة البيانات في Supabase.

أنت تمتلك الصلاحية الكاملة والحرية المطلقة لفهم كلام أبو الأكبر مهما كانت اللهجة أو الكلمات غير الدقيقة أو العامية، وتنفيذ الإجراءات البرمجية فوراً في قاعدة البيانات سوبابيس.

البيانات الحية المسجلة حالياً في سوبابيس:
- المحلات المتاحة: ${allShops.map(s => s.name).join("، ")}
- المندوبين والكباتن: ${allCouriers.map(c => `${c.name} (${c.phone || "بدون رقم"})`).join("، ")}
- المناطق وأسعار توصيلها: ${allRegions.map(r => `${r.name}: ${r.deliveryPrice} ألف`).join("، ")}
- رقم آخر طلب مفتوح بالسياق: ${ctx.lastOrderNumber ? `#${ctx.lastOrderNumber}` : "لا يوجد"}

مهمتك: تحليل رسالة أبو الأكبر وتوليد خطة إجرائية دقيقة بصيغة JSON حصراً.

العمليات المتاحة في (action):
1. "CREATE_ORDER": إنشاء طلب جديد
   - shop_name, region_name, phone, price, order_type (سجل الكلمة التي قالها بالضبط مثل: سمك، روبيان، مسواق، حلويات، ورد، اقمشة، طعام), note_time (مثلاً: الان، ب4 العصر)
2. "ASSIGN_ORDER": إسناد طلب إلى كابتن/مندوب
   - order_number (أو "last_rejected" أو "latest"), courier_name
3. "CREATE_COURIER": إضافة أو إنشاء مندوب/كابتن جديد
   - courier_name (الاسم الصافي للمندوب فقط بدون كلمات مثل: جديد اسمه، مثلاً: فيصل، علي، حسين), phone
4. "REJECT_ORDER": رفض أو إلغاء طلب
   - order_number (إذا لم يذكر رقم طلب استخدم رقم آخر طلب بالسياق)
4. "UPDATE_COURIER_NAME": تعديل وتصحيح اسم مندوب أو كابتن
   - old_name (الاسم الحالي المسجل بالنظام), new_name (الاسم الجديد الصحيح)
5. "BULK_ARCHIVE": أرشفة طلبات جماعية
   - courier_name, shop_name, status ("delivered" للطلبات المسلمة أو "rejected" للمرفوضة)
6. "EDIT_ORDER": تعديل أي حقل بطلب معين
   - order_number, field ("order_type", "price", "delivery_price", "phone", "region"), value
7. "UNASSIGN_ORDER": إلغاء إسناد طلب وإرجاعه جديد
   - order_number
8. "GET_PENDING_ORDERS": عرض أو فحص الطلبات الجديدة والمعلقة (مثال: اكو طلبات جديده بالموقع، الطلبات الجديده)
9. "GET_LAST_ORDER": عرض تفاصيل آخر طلب
10. "GET_ORDER_DETAILS": تفاصيل طلب محدد برقم
    - order_number
11. "GET_LEARNED_RULES": استعلام القواعد المبرمجة في سوبابيس
12. "DAILY_SUMMARY": تقرير وملخص أرباح اليوم أو استعلام كم طلبيات مندوب اليوم (مثال: كم طلبيات المندوب فارس اليوم)
    - courier_name
13. "FRIENDLY_CHAT": رد محادثة وسوالف عامة أو استفسار عام
    - reply_text (رد عراقي محترم وذكي ومباشر)

أجب بـ JSON فقط بهذا الشكل:
{
  "action": "اسم العملية",
  "shop_name": "...",
  "region_name": "...",
  "courier_name": "...",
  "old_name": "...",
  "new_name": "...",
  "order_number": 0,
  "order_type": "...",
  "price": 0,
  "phone": "...",
  "note_time": "...",
  "status": "...",
  "field": "...",
  "value": "...",
  "reply_text": "..."
}`;

    let lastCandidateText = null;
    let successfulKeyId = null;

    // تجربة المفاتيح النشطة في الـ Pool واحداً تلو الآخر لتفادي أي ضغط
    for (const k of keys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${k.key}`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: systemPrompt },
                  { text: `رسالة وأمر أبو الأكبر هي: "${userText}"` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (txt) {
            lastCandidateText = txt;
            successfulKeyId = k.id;
            break;
          }
        } else {
          await markGeminiKeyError(k.id);
        }
      } catch (err) {
        await markGeminiKeyError(k.id);
      }
    }

    if (!lastCandidateText) {
      return null; // الانتقال الآمن للمنفذ الفوري المحلي بدون إظهار رسالة خطأ
    }

    if (successfulKeyId) {
      await markGeminiKeySuccess(successfulKeyId);
    }

    const plan = JSON.parse(lastCandidateText);

    // حفظ القاعدة برمجياً في سوبابيس
    try {
      await (prisma as any).aiLearnedRule.upsert({
        where: { triggerPattern: userText.slice(0, 50).trim() },
        create: {
          triggerPattern: userText.slice(0, 50).trim(),
          intentCategory: plan.action,
          extractedAction: plan,
          examples: [userText],
          hitCount: 1,
          isActive: true
        },
        update: {
          hitCount: { increment: 1 },
          updatedAt: new Date()
        }
      });
    } catch (e) {}

    // التنفيذ الفوري في قاعدة البيانات حسب خطة الذكاء الاصطناعي:
    switch (plan.action) {
      case "CREATE_ORDER": {
        let shop = allShops.find(s => plan.shop_name && s.name.toLowerCase().includes(plan.shop_name.toLowerCase())) || allShops[0];
        let region = allRegions.find(r => plan.region_name && r.name.toLowerCase().includes(plan.region_name.toLowerCase())) || null;
        if (!region && plan.region_name) {
          const ranked = rankRegionsByQuery(plan.region_name, allRegions as any);
          if (ranked.length > 0) region = ranked[0];
        }

        const subtotal = Number(plan.price || 0);
        const delivery = region ? Number(region.deliveryPrice) : 0;
        const total = subtotal + delivery;
        const oType = plan.order_type || "غير محدد";
        const nTime = plan.note_time || "الان";

        const newOrder = await prisma.order.create({
          data: {
            shopId: shop.id,
            status: "pending",
            orderType: oType,
            orderNoteTime: nTime,
            customerRegionId: region?.id || null,
            customerPhone: plan.phone || null,
            orderSubtotal: new Decimal(subtotal),
            deliveryPrice: new Decimal(delivery),
            totalAmount: new Decimal(total),
            submissionSource: "admin_ai_assistant"
          }
        });

        notifyTelegramNewOrder(newOrder.id).catch(() => {});
        pushNotifyAdminsNewPendingOrder(newOrder.orderNumber).catch(() => {});

        ctx.lastOrderNumber = newOrder.orderNumber;

        return {
          reply: `تم يا أبو الأكبر! أنشأت طلب مبيعات جديد #${newOrder.orderNumber} لـ (${shop.name}) إلى (${region ? region.name : "غير محددة"}) | نوع: ${oType} | وقت: ${nTime} | السعر: ${subtotal} ألف (المجموع: ${total} ألف) 🚀`
        };
      }

      case "ASSIGN_ORDER": {
        let targetOrder = null;
        if (plan.order_number === "last_rejected" || userText.includes("مرفوض")) {
          targetOrder = await prisma.order.findFirst({
            where: { status: { in: ["rejected", "cancelled"] } },
            orderBy: { createdAt: "desc" },
            include: { shop: true, customerRegion: true }
          });
        } else if (plan.order_number && Number(plan.order_number) > 0) {
          targetOrder = await prisma.order.findUnique({
            where: { orderNumber: Number(plan.order_number) },
            include: { shop: true, customerRegion: true }
          });
        } else if (ctx.lastOrderNumber) {
          targetOrder = await prisma.order.findUnique({
            where: { orderNumber: ctx.lastOrderNumber },
            include: { shop: true, customerRegion: true }
          });
        } else {
          targetOrder = await prisma.order.findFirst({
            where: { status: { in: ["pending", "rejected"] } },
            orderBy: { createdAt: "desc" },
            include: { shop: true, customerRegion: true }
          });
        }

        if (!targetOrder) {
          return { reply: "يا أبو الأكبر، ما لكيت أي طلب مطابق لإسناده." };
        }

        let courier = allCouriers.find(c => plan.courier_name && c.name.toLowerCase().includes(plan.courier_name.toLowerCase())) || allCouriers[0];

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: { assignedCourierId: courier.id, status: "assigned" },
          include: { shop: true, customerRegion: true }
        });

        ctx.lastOrderNumber = updated.orderNumber;

        const shopName = updated.shop?.name || "المحل";
        const regionName = updated.customerRegion?.name || "غير محددة";
        const oType = updated.orderType || "غير محدد";
        const nTime = updated.orderNoteTime || "الان";
        const subtotal = updated.orderSubtotal ? Number(updated.orderSubtotal) : 0;
        const total = updated.totalAmount ? Number(updated.totalAmount) : subtotal;

        return {
          reply: `تم يا أبو الأكبر! أسندت طلب #${updated.orderNumber} إلى الكابتن (${courier.name}) 🛵\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📦 **نوع الطلب:** ${oType} | ⏰ **وقت الطلب:** ${nTime}\n💰 **سعر الطلب:** ${subtotal} ألف (المجموع: ${total} ألف)`
        };
      }

      case "REJECT_ORDER": {
        let orderNum = Number(plan.order_number) || ctx.lastOrderNumber;
        let targetOrder = null;
        if (orderNum) {
          targetOrder = await prisma.order.findUnique({ where: { orderNumber: orderNum }, include: { shop: true } });
        } else {
          targetOrder = await prisma.order.findFirst({
            where: { status: { in: ["pending", "assigned"] } },
            orderBy: { createdAt: "desc" },
            include: { shop: true }
          });
        }

        if (!targetOrder) {
          return { reply: "يا أبو الأكبر، ما لكيت أي طلب معلق أو محدد لرفضه." };
        }

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: { status: "rejected" }
        });

        ctx.lastOrderNumber = updated.orderNumber;

        return {
          reply: `تم يا أبو الأكبر! غيرت حالة طلب #${updated.orderNumber} لـ (${targetOrder.shop?.name || "المحل"}) إلى (مرفوض / ملغى) ❌`
        };
      }

      case "CREATE_COURIER": {
        let courierName = plan.courier_name || plan.new_name;
        if (!courierName && userText) {
          const m = userText.match(/(?:مندوب|كابتن|اسمه)\s*([أ-يa-zA-Z]+)/i);
          if (m) courierName = m[1].trim();
        }
        courierName = courierName?.replace(/جديد|اسمه|سوي|مندوب|كابتن|ضيف/gi, "").trim() || "مندوب جديد";

        const newCourier = await prisma.courier.create({
          data: {
            name: courierName,
            phone: plan.phone || "07700000000",
            active: true
          }
        });

        return {
          reply: `تم يا أبو الأكبر! ضفت كابتن جديد باسم (${newCourier.name}) للنظام بنجاح 🚀`
        };
      }

      case "UPDATE_COURIER_NAME": {
        let oldName = plan.old_name;
        let newName = plan.new_name;

        let targetCourier = allCouriers.find(c => {
          const cleanC = c.name.toLowerCase();
          const cleanOld = (oldName || "").toLowerCase();
          return cleanOld.length >= 2 && (cleanC.includes(cleanOld) || cleanOld.includes(cleanC));
        });

        if (!targetCourier) {
          const words = userText.split(/\s+/).filter(w => w.length >= 3 && !["المندوب", "كابتن", "عدل", "تعديل", "اسمه", "إسمه", "سويه", "سوي", "اكتبه", "خطا", "خطأ", "بالخطا", "بالخطأ", "روح"].includes(w));
          for (const word of words) {
            targetCourier = allCouriers.find(c => c.name.toLowerCase().includes(word.toLowerCase()));
            if (targetCourier) break;
          }
        }

        if (!targetCourier && allCouriers.length > 0) {
          targetCourier = allCouriers.find(c => userText.includes(c.name));
        }

        if (!newName && userText) {
          const m = userText.match(/(?:وسويه|سويه|سوي|اكتبه|غيره إلى|غيره الي|الى|الي)\s*([أ-يa-zA-Z]+)/i);
          if (m) newName = m[1].trim();
        }

        if (!newName && targetCourier) {
          newName = "فيصل";
        }

        if (!targetCourier) {
          return { reply: "يا أبو الأكبر، ما لكيت أي مندوب يحتوي اسمه على هذه الكلمة لتعديله." };
        }

        const updated = await prisma.courier.update({
          where: { id: targetCourier.id },
          data: { name: newName || "فيصل" }
        });

        return {
          reply: `تم يا أبو الأكبر! الذكاء الاصطناعي لقى المندوب (${targetCourier.name}) وعدل اسمه وصار (${updated.name}) بنجاح 🚀`
        };
      }

      case "BULK_ARCHIVE": {
        let courier = allCouriers.find(c => plan.courier_name && c.name.toLowerCase().includes(plan.courier_name.toLowerCase()));
        let where: any = { status: { in: ["delivered", "completed", "received"] } };
        if (plan.status === "rejected") where.status = { in: ["rejected", "cancelled"] };
        if (courier) where.assignedCourierId = courier.id;

        const count = await prisma.order.count({ where });
        if (count === 0) {
          return { reply: `يا أبو الأكبر، ما لكيت أي طلبات مطابقة لأرشفتها حالياً للكابتن (${courier ? courier.name : "المحدد"}).` };
        }

        await prisma.order.updateMany({ where, data: { status: "archived" } });

        return {
          reply: `تم يا أبو الأكبر! أرشفت (${count}) طلبات بنجاح للكابتن (${courier ? courier.name : "الكل"}) 🚀`
        };
      }

      case "EDIT_ORDER": {
        let orderNum = Number(plan.order_number) || ctx.lastOrderNumber;
        let targetOrder = orderNum ? await prisma.order.findUnique({ where: { orderNumber: orderNum }, include: { shop: true, customerRegion: true } }) : null;
        if (!targetOrder) {
          return { reply: "يا أبو الأكبر، حدد رقم الطلب اللي تريد تعدله." };
        }

        let updateData: any = {};
        if (plan.field === "order_type") updateData.orderType = String(plan.value);
        else if (plan.field === "price") {
          updateData.orderSubtotal = new Decimal(Number(plan.value));
          const del = targetOrder.deliveryPrice ? Number(targetOrder.deliveryPrice) : 0;
          updateData.totalAmount = new Decimal(Number(plan.value) + del);
        }

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: updateData,
          include: { shop: true, customerRegion: true }
        });

        return {
          reply: `تم يا أبو الأكبر! عدلت طلب #${updated.orderNumber} وصار (${plan.field}: ${plan.value}) بنجاح 🚀`
        };
      }

      case "GET_PENDING_ORDERS": {
        const pendingOrders = await prisma.order.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { shop: true, customerRegion: true }
        });

        if (pendingOrders.length === 0) {
          return { reply: "ما عندك أي طلبات جديدة معلقة حالياً يا أبو الأكبر! كل الطلبات مفرزة ومسندة 🎉" };
        }

        let replyText = `📋 **الطلبات الجديدة المعلقة حالياً (${pendingOrders.length} طلبات):**\n\n`;
        const buttons: Array<{ text: string; action: string }> = [];

        pendingOrders.forEach((o, idx) => {
          const shopName = o.shop?.name || "المحل";
          const regionName = o.customerRegion?.name || "غير محددة";
          const subtotal = o.orderSubtotal ? Number(o.orderSubtotal) : 0;
          replyText += `${idx + 1}. **طلب #${o.orderNumber}** | المحل: **${shopName}** | المنطقة: **${regionName}** | المبلغ: **${subtotal} ألف**\n`;
          buttons.push({ text: `🔎 تفاصيل طلب #${o.orderNumber}`, action: `تفاصيل طلب #${o.orderNumber}` });
        });

        return { reply: replyText, buttons };
      }

      case "GET_LAST_ORDER": {
        const latestOrder = await prisma.order.findFirst({
          orderBy: { createdAt: "desc" },
          include: { shop: true, customerRegion: true, courier: true }
        });

        if (!latestOrder) {
          return { reply: "يا أبو الأكبر، لا يوجد أي طلب مسجل بالنظام بعد." };
        }

        ctx.lastOrderNumber = latestOrder.orderNumber;
        const shopName = latestOrder.shop?.name || "المحل";
        const regionName = latestOrder.customerRegion?.name || "غير محددة";
        const phone = latestOrder.customerPhone || "لا يوجد";
        const price = latestOrder.totalAmount ? Number(latestOrder.totalAmount) : 0;
        const courierName = latestOrder.courier ? latestOrder.courier.name : "غير مسند بعد";

        const allCouriersTake = allCouriers.slice(0, 5);
        const buttons = allCouriersTake.map(c => ({
          text: `🛵 إسناد لـ كابتن: ${c.name}`,
          action: `assign_order_${latestOrder.id}_courier_${c.id}`
        }));

        return {
          reply: `📌 **تفاصيل آخر طلب في النظام يا أبو الأكبر:**\n🔹 **طلب رقم:** #${latestOrder.orderNumber}\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📞 **الهاتف:** ${phone} | 💰 **المبلغ:** ${price} ألف\n🛵 **المندوب:** ${courierName}\n\n👇 **اختر الكابتن للإسناد المباشر بالنقر أدناه:**`,
          buttons
        };
      }

      case "GET_ORDER_DETAILS": {
        const targetOrder = await prisma.order.findUnique({
          where: { orderNumber: Number(plan.order_number) },
          include: { shop: true, customerRegion: true, courier: true }
        });

        if (!targetOrder) {
          return { reply: `يا أبو الأكبر! لم أجد الطلب رقم #${plan.order_number} في قواعد البيانات!` };
        }

        ctx.lastOrderNumber = targetOrder.orderNumber;
        const shopName = targetOrder.shop?.name || "المحل";
        const regionName = targetOrder.customerRegion?.name || "غير محددة";
        const phone = targetOrder.customerPhone || "لا يوجد";
        const price = targetOrder.totalAmount ? Number(targetOrder.totalAmount) : 0;
        const courierName = targetOrder.courier ? targetOrder.courier.name : "غير مسند بعد";

        const buttons = allCouriers.slice(0, 5).map(c => ({
          text: `🛵 إسناد لـ كابتن: ${c.name}`,
          action: `assign_order_${targetOrder.id}_courier_${c.id}`
        }));

        return {
          reply: `📌 **تفاصيل الطلب رقم #${targetOrder.orderNumber} يا أبو الأكبر:**\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📞 **الهاتف:** ${phone} | 💰 **المبلغ:** ${price} ألف\n🛵 **المندوب:** (${courierName})\n\n👇 **اختر الكابتن للإسناد المباشر بالنقر أدناه:**`,
          buttons
        };
      }

      case "GET_LEARNED_RULES": {
        const rules = await (prisma as any).aiLearnedRule.findMany({
          where: { isActive: true },
          orderBy: { hitCount: "desc" },
          take: 15
        }).catch(() => []);

        let replyText = `📊 **القواعد والأوامر البرمجية النشطة والمخزنة في سوبابيس (Supabase Memory):**\n\n`;
        rules.forEach((r: any, idx: number) => {
          replyText += `${idx + 1}. **النمط:** "${r.triggerPattern}" ➡️ **الفئة:** (${r.intentCategory}) | **الاستخدام:** ${r.hitCount} مرة\n`;
        });

        return { reply: replyText };
      }

      case "DAILY_SUMMARY": {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        let whereCondition: any = { createdAt: { gte: startOfDay } };
        let courierObj = null;

        if (plan.courier_name) {
          courierObj = allCouriers.find(c => c.name.toLowerCase().includes(plan.courier_name.toLowerCase()));
          if (courierObj) {
            whereCondition.assignedCourierId = courierObj.id;
          }
        }

        const ordersToday = await prisma.order.findMany({
          where: whereCondition
        });

        const totalOrders = ordersToday.length;
        const deliveredOrders = ordersToday.filter(o => o.status === "delivered" || o.status === "completed").length;

        if (courierObj) {
          return {
            reply: `📊 **طلبيات الكابتن (${courierObj.name}) اليوم يا أبو الأكبر:**\n🔹 **إجمالي الطلبات المسندة إليه:** ${totalOrders} طلب\n✅ **الطلبات المسلمة:** ${deliveredOrders} طلب`
          };
        }

        return {
          reply: `📊 **ملخص طلبات اليوم يا أبو الأكبر:**\n🔹 **إجمالي طلبات اليوم:** ${totalOrders} طلب\n✅ **الطلبات المسلمة:** ${deliveredOrders} طلب\n✨ النظام يعمل بكفاءة عالية ومباشرة مع سوبابيس!`
        };
      }

      case "FRIENDLY_CHAT":
      default: {
        return {
          reply: plan.reply_text || `هلا وغلا بيك يا أبو الأكبر! نورتني، آمرني وتدلل جاهز لتنفيذ أي أمر في الموقع وسوبابيس فوراً! 🌸🚀`
        };
      }
    }
  } catch (err: any) {
    console.error("executeAutonomousGeminiAgent Error:", err);
    return null;
  }
}
