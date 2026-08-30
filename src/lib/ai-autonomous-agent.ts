import { prisma } from "./prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { rankRegionsByQuery } from "./arabic-region-search";
import { notifyTelegramNewOrder } from "./telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "./web-push-server";
import { getAllActiveGeminiKeys, markGeminiKeyError, markGeminiKeySuccess } from "./gemini-pool";

export async function executeAutonomousAiCommand(
  userText: string,
  ctx: { lastOrderNumber?: number | null; orderDraft?: any | null }
): Promise<{ reply: string; buttons?: Array<{ text: string; action: string }> } | null> {
  try {
    const keys = await getAllActiveGeminiKeys();
    if (!keys || keys.length === 0) return null;

    // جلب البيانات الحية من سوبابيس لتزويد الذكاء بالسياق الحقيقي
    const [allCouriers, allShops, allRegions] = await Promise.all([
      prisma.courier.findMany({ select: { id: true, name: true, phone: true } }),
      prisma.shop.findMany({ select: { id: true, name: true } }),
      prisma.region.findMany({ select: { id: true, name: true, deliveryPrice: true } })
    ]);

    const couriersList = allCouriers.map(c => `${c.name} (id: ${c.id})`).join(", ");
    const shopsList = allShops.map(s => `${s.name} (id: ${s.id})`).join(", ");
    const regionsList = allRegions.map(r => `${r.name} (سعر: ${r.deliveryPrice})`).join(", ");

    const systemPrompt = `أنت العقل المدبر والذكاء الاصطناعي المستقل لنظام إدارة الطلبات والمبيعات (أبو الأكبر).
مهمتك: فهم أمر أبو الأكبر بدقة متناهية وترجمته إلى خطة تنفيذ JSON مباشرة.

قاعدة بيانات سوبابيس الحالية:
- المندوبين: [${couriersList}]
- المحلات: [${shopsList}]
- المناطق: [${regionsList}]

العمليات المتاحة (action):
1. "CREATE_ORDER": إنشاء طلب مبيعات جديد
    - shop_name, region_name, price, phone, order_type, note_time
2. "GET_ORDER_DETAILS": جلب واستعراض تفاصيل طلب معين برقم الطلب أو باسم المحل وحالة الطلب
    - order_number, shop_name, status (pending, assigned, rejected, delivered)
3. "ASSIGN_ORDER": إسناد طلب إلى مندوب
    - order_number, courier_name
4. "REJECT_ORDER": رفض أو إلغاء طلب
    - order_number
5. "RESET_TO_NEW": إعادة طلب إلى حالة جديد
    - order_number
6. "CHANGE_COURIER": تغيير مندوب الطلب
    - order_number, courier_name
7. "CREATE_COURIER": إضافة مندوب جديد
    - courier_name, phone
8. "UPDATE_COURIER_NAME": تعديل وتصحيح اسم مندوب مسجل
    - old_name, new_name
9. "BULK_ARCHIVE": أرشفة طلبات منتهية أو ملغاة
    - courier_name, status
10. "EDIT_ORDER": تعديل تفاصيل طلب موجود (سعر، نوع، وقت، ملاحظة)
    - order_number, field, value
11. "GET_PENDING_ORDERS": استعلام الطلبات الجديدة المعلقة
12. "GET_LAST_ORDER": جلب آخر طلب في النظام
13. "DAILY_SUMMARY": تقرير وملخص أرباح اليوم أو استعلام طلبيات مندوب اليوم
    - courier_name
14. "FRIENDLY_CHAT": رد محادثة وسوالف عامة
    - reply_text

أجب بـ JSON فقط:
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

    // تنظيف رقم الشباك من النص
    const cleanInputText = userText.replace(/#/g, "");

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
        const cleanShopQuery = (plan.shop_name || "")
          .replace(/^من\s+محل\s+/g, "")
          .replace(/^من\s+/g, "")
          .replace(/^محل\s+/g, "")
          .trim()
          .toLowerCase();

        const scoredShops = allShops.map(s => {
          const sName = s.name.toLowerCase();
          let score = 0;
          if (cleanShopQuery && (sName.includes(cleanShopQuery) || cleanShopQuery.includes(sName))) score = 0.9;
          else if (cleanShopQuery) {
            let matches = 0;
            for (let ch of cleanShopQuery) {
              if (sName.includes(ch)) matches++;
            }
            score = matches / Math.max(sName.length, cleanShopQuery.length);
          }
          return { shop: s, score };
        }).sort((a, b) => b.score - a.score);

        let shop = scoredShops.length > 0 && scoredShops[0].score >= 0.55 ? scoredShops[0].shop : null;

        let region = allRegions.find(r => plan.region_name && r.name.toLowerCase().includes(plan.region_name.toLowerCase())) || null;
        if (!region && plan.region_name) {
          const ranked = rankRegionsByQuery(plan.region_name, allRegions as any);
          if (ranked.length > 0) region = ranked[0];
        }

        const subtotal = Number(plan.price || 0);
        const delivery = region ? Number(region.deliveryPrice) : 0;
        const total = subtotal + delivery;
        const oType = plan.order_type || "مسواق";
        const nTime = plan.note_time || "الان";

        if (!shop) {
          ctx.orderDraft = {
            step: "waiting_shop",
            regionId: region?.id || null,
            regionName: region ? region.name : plan.region_name,
            phone: plan.phone || null,
            orderType: oType,
            price: subtotal,
            noteTime: nTime
          };

          const topShops = scoredShops.slice(0, 4).map(s => s.shop);
          const buttons = topShops.map(s => ({
            text: `🏪 ${s.name}`,
            action: s.name
          }));

          const regionText = region ? region.name : (plan.region_name || "غير محددة");
          const phoneText = plan.phone ? plan.phone : "بدون رقم";

          return {
            reply: `يا أبو الأكبر، حفظت تفاصيل الطلب (إلى ${regionText} | هاتف: ${phoneText} | سعر: ${subtotal} ألف | نوع: ${oType})، بس اسم المحل (${plan.shop_name || "المذكور"}) بيه خطأ أو مو مسجل. قصدك أي محل من هذولي؟ 👇`,
            buttons: buttons
          };
        }

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
        ctx.orderDraft = null;

        return {
          reply: `تم يا أبو الأكبر! أنشأت طلب مبيعات جديد #${newOrder.orderNumber} لـ (${shop.name}) إلى (${region ? region.name : "غير محددة"}) | نوع: ${oType} | وقت: ${nTime} | السعر: ${subtotal} ألف (المجموع: ${total} ألف) 🚀`
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

      case "FRIENDLY_CHAT":
      default: {
        return {
          reply: plan.reply_text || "تدلل يا أبو الأكبر، آمرني بأي أمر وأنا بالخدمة دائماً 🌸"
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
