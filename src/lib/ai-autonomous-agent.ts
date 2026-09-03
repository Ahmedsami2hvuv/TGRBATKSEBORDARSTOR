import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { rankRegionsByQuery } from "./arabic-region-search";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { getAllActiveGeminiKeys, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";
import { getCachedCouriers, getCachedShops, getCachedRegions } from "./ai-data-cache";

export async function executeAutonomousAiCommand(
  userText: string,
  ctx: { lastOrderNumber?: number | null; orderDraft?: any | null }
): Promise<{ reply: string; buttons?: Array<{ text: string; action: string }> } | null> {
  try {
    const keys = await getAllActiveGeminiKeys();
    if (!keys || keys.length === 0) return null;

    // جلب البيانات من الكاش السريع المحمي في الذاكرة لمنع تشنج قاعدة البيانات
    const [allCouriers, allShops, allRegions] = await Promise.all([
      getCachedCouriers(),
      getCachedShops(),
      getCachedRegions()
    ]);

    const couriersList = allCouriers.map(c => `${c.name} (id: ${c.id})`).join(", ");
    const shopsList = allShops.map(s => `${s.name} (id: ${s.id})`).join(", ");
    const regionsList = allRegions.map(r => `${r.name} (سعر: ${r.deliveryPrice})`).join(", ");

    const systemPrompt = `أنت نموذج الذكاء الاصطناعي Google Gemini (المساعد الذكي الشخصي والعقل المدبر لمنظومة التوصيل والمتجر الإلكتروني الخاص بـ أبو الأكبر).
تتحدث بلهجة عراقية محترمة، ذكية، لبقة، ومباشرة. أنت العقل الأول الذي يستمع لأبو الأكبر، يفهم مقصده بدقة متناهية، ويقرر ما إذا كان الأمر يحتاج استشارة أو إجابة حرة أو تحليلاً إدارياً أو تنفيذاً في قاعدة البيانات.

قاعدة بيانات سوبابيس الحالية:
- المندوبين: [${couriersList}]
- المحلات: [${shopsList}]
- المناطق: [${regionsList}]

العمليات المتاحة (action):
1. "CREATE_ORDER": إنشاء طلب مبيعات جديد
   - shop_name, region_name, price, phone, order_type, note_time
2. "BULK_ARCHIVE": أرشفة الطلبات المسلمة/المكتملة فقط لمندوب أو عدة مندوبين
   - courier_name, status
3. "COURIER_ZERO": تصفير حساب ومستحقات مندوب معين
   - courier_name
4. "GET_ASSIGNED_ORDERS": استعلام وعرض الطلبات المسندة للمندوبين حالياً
   - courier_name
5. "ASSIGN_ORDER": إسناد طلب إلى مندوب
   - order_number, courier_name
6. "GET_ORDER_DETAILS": جلب واستعراض تفاصيل طلب معين برقم الطلب أو باسم المحل
   - order_number, shop_name, status
7. "GET_PENDING_ORDERS": استعلام الطلبات الجديدة المعلقة
8. "GET_LAST_ORDER": جلب آخر طلب في النظام
9. "REJECT_ORDER": رفض أو إلغاء طلب
   - order_number
10. "RESET_TO_NEW": إعادة طلب إلى حالة جديد (إلغاء الإسناد)
    - order_number
11. "CHANGE_COURIER": تغيير مندوب الطلب
    - order_number, courier_name
12. "EDIT_ORDER": تعديل تفاصيل طلب موجود (سعر، نوع، وقت، ملاحظة)
    - order_number, field, value
13. "DAILY_SUMMARY": تقرير وملخص أرباح اليوم أو استعلام طلبيات مندوب اليوم
    - courier_name
14. "UPDATE_COURIER_NAME": تعديل وتصحيح اسم مندوب مسجل
    - old_name, new_name
15. "CREATE_COURIER": إضافة مندوب جديد
    - courier_name, phone
16. "CONSULTATION_OR_CHAT": الإجابة عن أي استشارة، سؤال عام، تحليل إداري، نقاش، أو محادثة عادية من أبو الأكبر بذكاء جيمناي الطبيعي!
    - reply_text (اكتب ردك الذكي والمقنع واللبق بالكامل هنا بلهجة عراقية محترمة دون قوالب جامدة).

أجب بـ JSON فقط:
{
  "action": "اسم العملية من القائمة أعلاه",
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

    // تنظيف رقم الشباك من النص
    const cleanInputText = userText.replace(/#/g, "");

    for (const k of keys) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${k.key}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500);

        const response = await fetch(url, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  { text: systemPrompt },
                  { text: `رسالة وأمر أبو الأكبر هي: "${cleanInputText}"` }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        });
        clearTimeout(timeoutId);

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
      return null;
    }

    if (successfulKeyId) {
      await markGeminiKeySuccess(successfulKeyId);
    }

    const plan = JSON.parse(lastCandidateText);

    // التنفيذ الفوري في سوبابيس حسب الخطة:
    switch (plan.action) {
      case "CREATE_ORDER": {
        const initialDraft: OrderDraftState = {
          step: "waiting_shop",
          shopId: null,
          shopName: plan.shop_name || null,
          regionId: null,
          regionName: plan.region_name || null,
          phone: plan.phone || null,
          orderType: plan.order_type || null,
          price: plan.price !== undefined && plan.price !== null ? Number(plan.price) : undefined,
          noteTime: plan.note_time || null
        };

        const { handleOrderCreationWizard } = await import("./ai-order-wizard");
        const wizardRes = await handleOrderCreationWizard(userText, initialDraft, ctx);
        ctx.orderDraft = wizardRes.nextDraft || null;
        ctx.updatedAt = Date.now();
        return {
          reply: wizardRes.reply || "من أي محل يا أبو الأكبر؟ 🏪",
          buttons: wizardRes.buttons || []
        };
      }

      case "GET_ORDER_DETAILS": {
        let orderNum = Number(plan.order_number);
        if (!orderNum) {
          const numMatch = userText.match(/\d+/);
          if (numMatch) orderNum = Number(numMatch[0]);
        }

        let targetOrder = null;

        if (orderNum && orderNum > 0) {
          targetOrder = await prisma.order.findUnique({
            where: { orderNumber: orderNum },
            include: { shop: true, customerRegion: true, courier: true }
          });
        } else if (plan.shop_name) {
          let whereClause: any = {
            shop: { name: { contains: plan.shop_name, mode: "insensitive" } }
          };
          if (plan.status) {
            if (plan.status.includes("جديد") || plan.status === "pending") whereClause.status = "pending";
            else if (plan.status.includes("مسند") || plan.status === "assigned") whereClause.status = "assigned";
            else if (plan.status.includes("مرفوض") || plan.status === "rejected") whereClause.status = { in: ["rejected", "cancelled"] };
          }
          targetOrder = await prisma.order.findFirst({
            where: whereClause,
            orderBy: { createdAt: "desc" },
            include: { shop: true, customerRegion: true, courier: true }
          });
        } else if (ctx.lastOrderNumber) {
          targetOrder = await prisma.order.findUnique({
            where: { orderNumber: ctx.lastOrderNumber },
            include: { shop: true, customerRegion: true, courier: true }
          });
        }

        if (!targetOrder) {
          return { reply: `يا أبو الأكبر، ما لكيت أي طلب مطابق للبحث (${plan.shop_name || orderNum || "المحدد"}).` };
        }

        ctx.lastOrderNumber = targetOrder.orderNumber;

        const shopName = targetOrder.shop?.name || "المحل";
        const regionName = targetOrder.customerRegion?.name || "غير محددة";
        const phone = targetOrder.customerPhone || "بدون رقم";
        const subtotal = targetOrder.orderSubtotal ? Number(targetOrder.orderSubtotal) : 0;
        const oType = targetOrder.orderType || "مسواق";
        const nTime = targetOrder.orderNoteTime || "الان";
        
        let statusArabic = "جديد";
        if (targetOrder.status === "assigned") statusArabic = `مسند (${targetOrder.courier?.name || "مندوب"})`;
        else if (targetOrder.status === "rejected" || targetOrder.status === "cancelled") statusArabic = "مرفوض";
        else if (targetOrder.status === "delivered" || targetOrder.status === "completed") statusArabic = "واصل ومسلم";
        else if (targetOrder.status === "archived") statusArabic = "مؤرشف";

        const replyText = `تفاصيل الطلب:\n${targetOrder.orderNumber}\n${shopName}\n${regionName}\n${phone}\n${subtotal}\n${oType}\n${nTime}\n${statusArabic}`;

        const buttons: Array<{ text: string; action: string }> = [];

        if (targetOrder.customerPhone && targetOrder.customerPhone.replace(/\D/g, "").length >= 7) {
          const rawDigits = targetOrder.customerPhone.replace(/\D/g, "");
          const cleanPhone = rawDigits.startsWith("0") ? "964" + rawDigits.slice(1) : (rawDigits.startsWith("964") ? rawDigits : "964" + rawDigits);
          buttons.push({ text: `📞 اتصال بالزبون`, action: `tel:${targetOrder.customerPhone}` });
          buttons.push({ text: `💬 مراسلة واتساب`, action: `https://wa.me/${cleanPhone}` });
        }

        if (targetOrder.status === "pending") {
          buttons.push({ text: `🛵 إسناد لمندوب`, action: `إسناد طلب ${targetOrder.orderNumber}` });
          buttons.push({ text: `❌ إلغاء الطلب`, action: `إلغاء طلب ${targetOrder.orderNumber}` });
        } else if (targetOrder.status === "rejected" || targetOrder.status === "cancelled") {
          buttons.push({ text: `🛵 إعادة إسناد`, action: `إسناد طلب ${targetOrder.orderNumber}` });
          buttons.push({ text: `🔄 إرجاع إلى جديد`, action: `إرجاع طلب ${targetOrder.orderNumber} للجديد` });
        } else if (targetOrder.status === "assigned") {
          buttons.push({ text: `🛵 تغيير المندوب`, action: `تغيير مندوب طلب ${targetOrder.orderNumber}` });
          buttons.push({ text: `🔄 إرجاع إلى جديد`, action: `إرجاع طلب ${targetOrder.orderNumber} للجديد` });
          buttons.push({ text: `❌ إلغاء الطلب`, action: `إلغاء طلب ${targetOrder.orderNumber}` });
        }

        return { reply: replyText, buttons };
      }

      case "ASSIGN_ORDER": {
        let orderNum = Number(plan.order_number);
        if (!orderNum) {
          const m = userText.match(/\d+/);
          if (m) orderNum = Number(m[0]);
        }

        let targetOrder = null;
        if (orderNum && orderNum > 0) {
          targetOrder = await prisma.order.findUnique({
            where: { orderNumber: orderNum },
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

        let courier = allCouriers.find(c => plan.courier_name && c.name.toLowerCase().includes(plan.courier_name.toLowerCase()));
        if (!courier && allCouriers.length > 0) {
          const buttons = allCouriers.slice(0, 5).map(c => ({
            text: `🛵 ${c.name}`,
            action: `اسند طلب ${targetOrder!.orderNumber} للمندوب ${c.name}`
          }));
          return {
            reply: `يا أبو الأكبر، اختر المندوب لإسناد طلب #${targetOrder.orderNumber} لـ (${targetOrder.shop?.name || "المحل"}): 👇`,
            buttons
          };
        }

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: { assignedCourierId: courier!.id, status: "assigned" },
          include: { shop: true, customerRegion: true }
        });

        ctx.lastOrderNumber = updated.orderNumber;

        return {
          reply: `تم يا أبو الأكبر! أسندت طلب #${updated.orderNumber} إلى الكابتن (${courier!.name}) بنجاح 🛵`
        };
      }

      case "RESET_TO_NEW": {
        let orderNum = Number(plan.order_number) || ctx.lastOrderNumber;
        if (!orderNum) {
          const m = userText.match(/\d+/);
          if (m) orderNum = Number(m[0]);
        }

        if (!orderNum) {
          return { reply: "يا أبو الأكبر، حدد رقم الطلب اللي تريد ترجعه لجديد." };
        }

        const updated = await prisma.order.update({
          where: { orderNumber: orderNum },
          data: { status: "pending", assignedCourierId: null }
        });

        ctx.lastOrderNumber = updated.orderNumber;

        return {
          reply: `تم يا أبو الأكبر! رجعت طلب #${updated.orderNumber} إلى حالة (جديد معلق) بنجاح 🔄`
        };
      }

      case "CHANGE_COURIER": {
        let orderNum = Number(plan.order_number) || ctx.lastOrderNumber;
        if (!orderNum) {
          const m = userText.match(/\d+/);
          if (m) orderNum = Number(m[0]);
        }

        let courier = allCouriers.find(c => plan.courier_name && c.name.toLowerCase().includes(plan.courier_name.toLowerCase()));
        if (!courier && allCouriers.length > 0) {
          const buttons = allCouriers.slice(0, 5).map(c => ({
            text: `🛵 ${c.name}`,
            action: `اسند طلب ${orderNum} للمندوب ${c.name}`
          }));
          return {
            reply: `يا أبو الأكبر، اختر المندوب الجديد لطلب #${orderNum}: 👇`,
            buttons
          };
        }

        const updated = await prisma.order.update({
          where: { orderNumber: orderNum },
          data: { assignedCourierId: courier!.id, status: "assigned" }
        });

        ctx.lastOrderNumber = updated.orderNumber;

        return {
          reply: `تم يا أبو الأكبر! غيرت مندوب طلب #${updated.orderNumber} وصار للكابتن (${courier!.name}) بنجاح 🛵`
        };
      }

      case "REJECT_ORDER": {
        let orderNum = Number(plan.order_number) || ctx.lastOrderNumber;
        if (!orderNum) {
          const m = userText.match(/\d+/);
          if (m) orderNum = Number(m[0]);
        }

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
        let courier = allCouriers.find(c => plan.courier_name && (c.name.toLowerCase().includes(plan.courier_name.toLowerCase()) || plan.courier_name.toLowerCase().includes(c.name.toLowerCase())));
        if (!courier && plan.courier_name) {
          const { match } = findBestMatch(allCouriers, plan.courier_name);
          courier = match;
        }

        if (courier) {
          const deliveredOrders = await prisma.order.findMany({
            where: {
              assignedCourierId: courier.id,
              status: { in: ["delivered", "completed", "received"] }
            },
            select: { id: true }
          });

          const undeliveredCount = await prisma.order.count({
            where: {
              assignedCourierId: courier.id,
              status: { in: ["assigned", "delivering", "pending"] }
            }
          });

          if (deliveredOrders.length === 0) {
            const undNote = undeliveredCount > 0 ? ` (عنده حالياً ${undeliveredCount} طلبات قيد التوصيل لم تسلّم بعد).` : ``;
            return {
              reply: `ماكو طلبيات مسلمة حالياً للمندوب (${courier.name}) حتى تتأرشف 🌸${undNote}`
            };
          }

          await prisma.order.updateMany({
            where: { id: { in: deliveredOrders.map(o => o.id) } },
            data: { status: "archived", archivedAt: new Date() }
          });

          const undeliveredNote = undeliveredCount > 0
            ? `(ملاحظة: الطلبات غير المسلمة (${undeliveredCount} طلب) بقت قيد التوصيل).`
            : `(ملاحظة: لا توجد طلبات أخرى قيد التوصيل لهذا المندوب).`;

          return {
            reply: `تمت أرشفة (${deliveredOrders.length}) طلب مسلّم للمندوب ${courier.name} بنجاح 📦✨\n${undeliveredNote}`
          };
        }

        let where: any = { status: { in: ["delivered", "completed", "received"] } };
        const count = await prisma.order.count({ where });
        if (count === 0) {
          return { reply: `ماكو أي طلبيات مسلمة حالياً في النظام لأرشفتها 🌸` };
        }

        await prisma.order.updateMany({ where, data: { status: "archived", archivedAt: new Date() } });

        return {
          reply: `تمت أرشفة (${count}) طلب مسلّم في النظام بنجاح يا أبو الأكبر 📦✨ (الطلبات غير المسلمة بقت قيد التوصيل).`
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
          buttons.push({ text: `🔎 تفاصيل طلب ${o.orderNumber}`, action: `تفاصيل طلب ${o.orderNumber}` });
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
          action: `اسند طلب ${latestOrder.orderNumber} للمندوب ${c.name}`
        }));

        return {
          reply: `📌 **تفاصيل آخر طلب في النظام يا أبو الأكبر:**\n🔹 **طلب رقم:** #${latestOrder.orderNumber}\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📞 **الهاتف:** ${phone} | 💰 **المبلغ:** ${price} ألف\n🛵 **المندوب:** ${courierName}\n\n👇 **اختر الكابتن للإسناد المباشر بالنقر أدناه:**`,
          buttons
        };
      }

      case "COURIER_ZERO": {
        const courierQuery = plan.courier_name || userText;
        let matchedCourier = allCouriers.find(c => courierQuery && (c.name.toLowerCase().includes(courierQuery.toLowerCase()) || courierQuery.toLowerCase().includes(c.name.toLowerCase())));
        if (!matchedCourier && plan.courier_name) {
          const { match } = findBestMatch(allCouriers, plan.courier_name);
          matchedCourier = match;
        }

        if (!matchedCourier) {
          const buttons = allCouriers.slice(0, 6).map(c => ({
            text: `🛵 ${c.name}`,
            action: `صفر حساب المندوب ${c.name}`
          }));
          return {
            reply: `يا أبو الأكبر، قصدك تصفير حساب أي كابتن مندوب؟ 👇`,
            buttons
          };
        }

        await prisma.courier.update({
          where: { id: matchedCourier.id },
          data: { mandoubTotalsResetAt: new Date() }
        });

        return {
          reply: `تم يا أبو الأكبر! صفرت حساب ومستحقات الكابتن المندوب (${matchedCourier.name}) بنجاح 🚀`
        };
      }

      case "GET_ASSIGNED_ORDERS": {
        let matchedCourier = null;
        if (plan.courier_name) {
          matchedCourier = allCouriers.find(c => c.name.toLowerCase().includes(plan.courier_name.toLowerCase()));
          if (!matchedCourier) {
            const { match } = findBestMatch(allCouriers, plan.courier_name);
            matchedCourier = match;
          }
        }

        const whereClause: any = {
          status: { in: ["assigned", "delivering"] }
        };
        if (matchedCourier) {
          whereClause.assignedCourierId = matchedCourier.id;
        }

        const assignedOrders = await prisma.order.findMany({
          where: whereClause,
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { shop: true, customerRegion: true, courier: true }
        });

        if (assignedOrders.length === 0) {
          if (matchedCourier) {
            return { reply: `يا أبو الأكبر، ماكو أي طلبات مسندة حالياً للكابتن (${matchedCourier.name}) 🛵` };
          }
          return { reply: `يا أبو الأكبر، ماكو أي طلبات مسندة للمندوبين حالياً. كل الطلبات إما جديدة معلقة أو مكتملة واصلة! 🚀` };
        }

        const title = matchedCourier
          ? `🛵 **الطلبات المسندة للكابتن (${matchedCourier.name}) (${assignedOrders.length} طلب):**\n`
          : `🛵 **الطلبات المسندة للمندوبين حالياً (${assignedOrders.length} طلب):**\n`;

        let summary = title;
        assignedOrders.forEach((o, i) => {
          const cName = o.courier?.name || "مندوب";
          const sName = o.shop?.name || "محل";
          const rName = o.customerRegion?.name || "غير محددة";
          const price = o.orderSubtotal ? Number(o.orderSubtotal) : 0;
          summary += `\n${i + 1}. **طلب #${o.orderNumber}** ⬅️ للكابتن (${cName}) | محل: ${sName} | منطقة: ${rName} (${price} ألف)`;
        });

        const buttons = assignedOrders.slice(0, 5).map(o => ({
          text: `🔍 تفاصيل #${o.orderNumber}`,
          action: `تفاصيل طلب ${o.orderNumber}`
        }));

        return { reply: summary, buttons };
      }

      case "CONSULTATION_OR_CHAT":
      case "FRIENDLY_CHAT":
      default: {
        return {
          reply: plan.reply_text || "تدلل يا أبو الأكبر، أنا وياك وأسمعك. آمرني بأي استشارة أو أمر وأنا بالخدمة دائماً 🌸"
        };
      }
    }
  } catch (error: any) {
    console.error("Error in autonomous AI agent:", error);
    return null;
  }
}

// تصدير الاسم البديل لضمان التوافق مع أي استيراد في المشروع
export const executeAutonomousGeminiAgent = executeAutonomousAiCommand;
