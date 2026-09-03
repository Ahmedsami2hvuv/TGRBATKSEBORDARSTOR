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
    if (!keys || keys.length === 0) {
      return {
        reply: "⚠️ يا أبو الأكبر: لا تتوفر أي مفاتيح Google Gemini نشطة في النظام حالياً. يرجى إضافة مفاتيح جيمناي في صفحة الإعدادات ⚙️ ليعمل عقل جيمناي بالكامل!"
      };
    }

    const cleanLower = userText.toLowerCase().trim();
    const isExplicitAdminCommand =
      cleanLower.includes("ارشف") ||
      cleanLower.includes("أرشف") ||
      cleanLower.includes("ارشفة") ||
      cleanLower.includes("أرشفة") ||
      cleanLower.includes("صفر") ||
      cleanLower.includes("تصفير") ||
      cleanLower.includes("غير اسم") ||
      cleanLower.includes("حول طلب") ||
      cleanLower.includes("اسند") ||
      cleanLower.includes("انقل طلب") ||
      cleanLower.includes("كم طلب") ||
      cleanLower.includes("غير واصل") ||
      cleanLower.includes("مو واصل") ||
      cleanLower.includes("غير مسلم") ||
      cleanLower.includes("ارباح") ||
      cleanLower.includes("أرباح") ||
      cleanLower.includes("رصيد مجهز") ||
      cleanLower.includes("محفظة مجهز") ||
      cleanLower.includes("ديون مجهز") ||
      cleanLower.includes("سوي طلب") ||
      cleanLower.includes("سويلي طلب");

    // استجابة فورية سريعة جداً للمحادثة والاستشارات العامة بدون أدوات ثقيلة (أقل من ثانيتين)
    if (!isExplicitAdminCommand) {
      const quickReply = await askGeminiFreeChat(userText);
      if (quickReply) {
        return { reply: quickReply };
      }
    }

    // جلب البيانات من الكاش السريع المحمي في الذاكرة لمنع تشنج قاعدة البيانات
    const [allCouriers, allShops, allRegions] = await Promise.all([
      getCachedCouriers(),
      getCachedShops(),
      getCachedRegions()
    ]);

    const couriersList = allCouriers.map(c => `${c.name} (id: ${c.id})`).join(", ");
    const shopsList = allShops.map(s => `${s.name} (id: ${s.id})`).join(", ");
    const regionsList = allRegions.map(r => `${r.name} (سعر: ${r.deliveryPrice})`).join(", ");

    const geminiTools = [
      {
        functionDeclarations: [
          {
            name: "get_agent_remaining_orders",
            description: "استعلام الطلبات غير الواصلة أو المتبقية قيد التوصيل لمندوب معين (مثل: المندوب نجم كم طلب عده غير واصل)",
            parameters: {
              type: "OBJECT",
              properties: {
                agent_name: { type: "STRING", description: "اسم المندوب" }
              },
              required: ["agent_name"]
            }
          },
          {
            name: "get_agent_orders",
            description: "استعلام حالة وتفاصيل كافة طلبات مندوب معين (المسلمة وقيد التوصيل والمؤرشفة)",
            parameters: {
              type: "OBJECT",
              properties: {
                agent_name: { type: "STRING", description: "اسم المندوب" }
              },
              required: ["agent_name"]
            }
          },
          {
            name: "get_agent_profits",
            description: "استعلام أرباح ومحفظة وحساب مندوب معين (مثل: شكد أرباح مندوب أحمد، مصفّي أرباح اليوم)",
            parameters: {
              type: "OBJECT",
              properties: {
                agent_name: { type: "STRING", description: "اسم المندوب" }
              },
              required: ["agent_name"]
            }
          },
          {
            name: "get_supplier_balance",
            description: "استعلام رصيد ومحفظة وحساب مجهز معين (مثل: مجهز علي شكد باقي بمحفظته)",
            parameters: {
              type: "OBJECT",
              properties: {
                supplier_name: { type: "STRING", description: "اسم المجهز" }
              },
              required: ["supplier_name"]
            }
          },
          {
            name: "get_pending_orders_summary",
            description: "استعلام عدد وتفاصيل الطلبات الجديدة المعلقة (مثل: كم طلب جديد عدنه، شكو طلبات معلقة)",
            parameters: {
              type: "OBJECT",
              properties: {}
            }
          },
          {
            name: "archive_agent_orders",
            description: "أرشفة الطلبات المسلمة/المكتملة فقط لمندوب أو عدة مندوبين (ممنوع مساس الطلبات غير المسلمة)",
            parameters: {
              type: "OBJECT",
              properties: {
                agent_name: { type: "STRING", description: "اسم المندوب أو المندوبين" }
              },
              required: ["agent_name"]
            }
          },
          {
            name: "reset_agent_balance",
            description: "تصفير حساب ومستحقات مندوب معين",
            parameters: {
              type: "OBJECT",
              properties: {
                agent_name: { type: "STRING", description: "اسم المندوب" }
              },
              required: ["agent_name"]
            }
          },
          {
            name: "assign_order_to_agent",
            description: "إسناد طلب مبيعات معين إلى مندوب",
            parameters: {
              type: "OBJECT",
              properties: {
                order_number: { type: "INTEGER", description: "رقم الطلب إذا ذكر" },
                agent_name: { type: "STRING", description: "اسم المندوب" }
              },
              required: ["agent_name"]
            }
          },
          {
            name: "get_order_details",
            description: "جلب واستعراض تفاصيل طلب معين برقم الطلب",
            parameters: {
              type: "OBJECT",
              properties: {
                order_number: { type: "INTEGER", description: "رقم الطلب" }
              },
              required: ["order_number"]
            }
          },
          {
            name: "get_daily_summary",
            description: "تقرير وملخص أرباح اليوم ومبيعات المتجر",
            parameters: {
              type: "OBJECT",
              properties: {}
            }
          },
          {
            name: "create_order",
            description: "إنشاء أو إضافة طلب مبيعات جديد",
            parameters: {
              type: "OBJECT",
              properties: {
                shop_name: { type: "STRING", description: "اسم المحل" },
                region_name: { type: "STRING", description: "اسم المنطقة" },
                price: { type: "NUMBER", description: "سعر الطلب" },
                phone: { type: "STRING", description: "رقم الهاتف" },
                order_type: { type: "STRING", description: "نوع الطلب" },
                note_time: { type: "STRING", description: "وقت التوصيل" }
              }
            }
          },
          {
            name: "update_agent_name",
            description: "تعديل وتصحيح اسم مندوب مسجل (فقط عند وجود أمر صريح بتعديل أو تصحيح الاسم)",
            parameters: {
              type: "OBJECT",
              properties: {
                old_name: { type: "STRING", description: "الاسم القديم الحالي" },
                new_name: { type: "STRING", description: "الاسم الجديد" }
              },
              required: ["old_name", "new_name"]
            }
          }
        ]
      }
    ];

    let functionCallResult: { name: string; args: any } | null = null;
    let directTextReply: string | null = null;
    let successfulKeyId: string | null = null;

    const cleanInputText = userText.replace(/#/g, "");
    const candidateModels = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-3.6-flash", "gemini-3.7-flash", "gemini-2.5-pro"];

    for (const k of keys) {
      if (functionCallResult || directTextReply) break;
      for (const modelName of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${k.key}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 7500);

          const response = await fetch(url, {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `أنت نموذج الذكاء الاصطناعي Google Gemini (المساعد الذكي والشخصي والعقل المدبر لـ أبو الأكبر لإدارة متجره ومنظومة التوصيل).
تتحدث بلهجة عراقية محترمة، واعية، ذكية، ومباشرة.

قاعدة بيانات سوبابيس الحالية:
- المندوبين: [${couriersList}]
- المحلات: [${shopsList}]
- المناطق: [${regionsList}]

القواعد الصارمة:
1. إذا كان كلام أبو الأكبر سؤالاً عاماً، استشارة، نقاشاً، أسئلة عن أسعار الكباب، أسعار الصرف والدولار، مقارنة لابتوب وديسكتوب، آيفون 16، نصائح تسويق، سوالف، أو محادثة عادية: أجب عليه مباشرة بنص كامل ومفصل وذكي ولبق (text reply) دون استدعاء أي أداة.
2. إذا كان كلام أبو الأكبر استعلاماً أو أمراً إدارياً يخص طلبات المندوبين، أرباحهم، الأرشفة، التصفير، الطلبات الجديدة، المجهزين، أو تفاصيل الطلبات: استدعِ الدالة المناسبة (Function Call) مع تمرير المتغيرات المستخرجة بدقة.

كلام وأمر أبو الأكبر هو: "${cleanInputText}"`
                    }
                  ]
                }
              ],
              tools: geminiTools,
              generationConfig: {
                temperature: 0.4
              }
            })
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            const candidate = data.candidates?.[0];
            const parts = candidate?.content?.parts || [];

            for (const part of parts) {
              if (part.functionCall) {
                functionCallResult = {
                  name: part.functionCall.name,
                  args: part.functionCall.args || {}
                };
                successfulKeyId = k.id;
                break;
              }
              if (part.text && part.text.trim().length > 0) {
                directTextReply = part.text.trim();
                successfulKeyId = k.id;
              }
            }

            if (functionCallResult || directTextReply) break;
          } else {
            await markGeminiKeyError(k.id);
          }
        } catch (err) {
          // محاولة التالي
        }
      }
    }

    if (successfulKeyId) {
      await markGeminiKeySuccess(successfulKeyId);
    }

    // إذا كان الجواب نصياً مباشراً من جيمناي (استشارة، كباب، دولار، لابتوب، سوالف)
    if (!functionCallResult && directTextReply) {
      return { reply: directTextReply };
    }

    if (!functionCallResult) {
      return null;
    }

    const { name: funcName, args: funcArgs } = functionCallResult;

    // التنفيذ الفوري في سوبابيس حسب الدالة المستدعاة من جيمناي:
    switch (funcName) {
      case "get_agent_remaining_orders":
      case "get_agent_orders": {
        const agentName = funcArgs.agent_name || userText;
        let matchedCourier = allCouriers.find(c => agentName && (c.name.toLowerCase().includes(agentName.toLowerCase()) || agentName.toLowerCase().includes(c.name.toLowerCase())));
        if (!matchedCourier && funcArgs.agent_name) {
          const { match } = findBestMatch(allCouriers, funcArgs.agent_name);
          matchedCourier = match;
        }

        if (!matchedCourier) {
          const buttons = allCouriers.slice(0, 6).map(c => ({
            text: `🛵 ${c.name}`,
            action: `طلبات المندوب ${c.name}`
          }));
          return {
            reply: `يا أبو الأكبر، تقصد استعلام طلبات أي مندوب من هذولي؟ 👇`,
            buttons
          };
        }

        const [undeliveredCount, deliveredCount, archivedCount, activeOrders] = await Promise.all([
          prisma.order.count({
            where: {
              assignedCourierId: matchedCourier.id,
              status: { in: ["assigned", "delivering", "pending"] }
            }
          }),
          prisma.order.count({
            where: {
              assignedCourierId: matchedCourier.id,
              status: { in: ["delivered", "completed", "received"] }
            }
          }),
          prisma.order.count({
            where: {
              assignedCourierId: matchedCourier.id,
              status: "archived"
            }
          }),
          prisma.order.findMany({
            where: {
              assignedCourierId: matchedCourier.id,
              status: { in: ["assigned", "delivering"] }
            },
            take: 5,
            include: { shop: true, customerRegion: true }
          })
        ]);

        let replyText = `🛵 **إحصائية طلبات الكابتن (${matchedCourier.name}) حالياً:**\n`;
        replyText += `🔹 **طلبات غير واصلة (قيد التوصيل):** ${undeliveredCount} طلبات\n`;
        replyText += `🔹 **طلبات واصلة ومسلّمة:** ${deliveredCount} طلبات\n`;
        replyText += `🔹 **طلبات مؤرشفة:** ${archivedCount} طلبات\n`;

        if (activeOrders.length > 0) {
          replyText += `\n📋 **الطلبات قيد التوصيل حالياً:**\n`;
          activeOrders.forEach((o, i) => {
            const sName = o.shop?.name || "محل";
            const rName = o.customerRegion?.name || "منطقة";
            const price = o.orderSubtotal ? Number(o.orderSubtotal) : 0;
            replyText += `${i + 1}. **طلب #${o.orderNumber}** ⬅️ (${sName}) إلى (${rName}) بمبلغ ${price} ألف\n`;
          });
        }

        const buttons = [];
        if (deliveredCount > 0) {
          buttons.push({
            text: `📦 أرشفة مسلّمات ${matchedCourier.name}`,
            action: `ارشف طلبيات ${matchedCourier.name} المسلمة`
          });
        }
        buttons.push({
          text: `💰 تصفير حساب ${matchedCourier.name}`,
          action: `صفر حساب المندوب ${matchedCourier.name}`
        });

        return { reply: replyText, buttons };
      }

      case "get_agent_profits": {
        const agentName = funcArgs.agent_name || userText;
        let matchedCourier = allCouriers.find(c => agentName && (c.name.toLowerCase().includes(agentName.toLowerCase()) || agentName.toLowerCase().includes(c.name.toLowerCase())));
        if (!matchedCourier && funcArgs.agent_name) {
          const { match } = findBestMatch(allCouriers, funcArgs.agent_name);
          matchedCourier = match;
        }

        if (!matchedCourier) {
          return { reply: `يا أبو الأكبر، ما لكيت مندوب مطابق للاسم (${funcArgs.agent_name || "المحدد"}). المندوبين: ${allCouriers.map(c => c.name).join("، ")}.` };
        }

        const deliveredOrders = await prisma.order.findMany({
          where: {
            assignedCourierId: matchedCourier.id,
            status: { in: ["delivered", "completed", "received"] }
          },
          select: { deliveryPrice: true, totalAmount: true }
        });

        const totalDelivered = deliveredOrders.length;
        const totalProfit = deliveredOrders.reduce((sum, o) => sum + Number(o.deliveryPrice || 0), 0);

        return {
          reply: `💰 **تقرير أرباح ومستحقات الكابتن (${matchedCourier.name}):**\n🔹 **الطلبات المسلمة اليوم:** ${totalDelivered} طلبات\n🔹 **أرباح التوصيل الصافية:** ${totalProfit} ألف دينار 🚀`,
          buttons: [
            { text: `💰 تصفير حساب ${matchedCourier.name}`, action: `صفر حساب المندوب ${matchedCourier.name}` },
            { text: `📦 أرشفة طلبات ${matchedCourier.name}`, action: `ارشف طلبيات ${matchedCourier.name} المسلمة` }
          ]
        };
      }

      case "get_supplier_balance": {
        const supplierName = funcArgs.supplier_name || userText;
        const preparers = await prisma.companyPreparer.findMany();
        let matched = preparers.find(p => supplierName && (p.name.toLowerCase().includes(supplierName.toLowerCase()) || supplierName.toLowerCase().includes(p.name.toLowerCase())));
        if (!matched && funcArgs.supplier_name) {
          const { match } = findBestMatch(preparers, funcArgs.supplier_name);
          matched = match;
        }

        if (!matched) {
          return { reply: `يا أبو الأكبر، ما لكيت مجهز باسم (${funcArgs.supplier_name || "المحدد"}). المجهزين: ${preparers.map(p => p.name).join("، ")}.` };
        }

        const salary = Number(matched.salary || 0);
        return {
          reply: `🏬 **محفظة وحساب المجهز (${matched.name}):**\n🔹 **الرصيد / المستحقات:** ${salary} ألف دينار 💼`
        };
      }

      case "get_pending_orders_summary": {
        const pendingCount = await prisma.order.count({ where: { status: "pending" } });
        if (pendingCount === 0) {
          return { reply: "يا أبو الأكبر، ما عندنا أي طلبات جديدة معلقة حالياً! كل الطلبات مفرزة ومسندة 🎉" };
        }

        const pendingOrders = await prisma.order.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { shop: true, customerRegion: true }
        });

        let replyText = `📋 **عندنا حالياً (${pendingCount}) طلبات جديدة معلقة يا أبو الأكبر:**\n\n`;
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

      case "archive_agent_orders": {
        let courier = allCouriers.find(c => funcArgs.agent_name && (c.name.toLowerCase().includes(funcArgs.agent_name.toLowerCase()) || funcArgs.agent_name.toLowerCase().includes(c.name.toLowerCase())));
        if (!courier && funcArgs.agent_name) {
          const { match } = findBestMatch(allCouriers, funcArgs.agent_name);
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

      case "reset_agent_balance": {
        const agentName = funcArgs.agent_name || userText;
        let matchedCourier = allCouriers.find(c => agentName && (c.name.toLowerCase().includes(agentName.toLowerCase()) || agentName.toLowerCase().includes(c.name.toLowerCase())));
        if (!matchedCourier && funcArgs.agent_name) {
          const { match } = findBestMatch(allCouriers, funcArgs.agent_name);
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

      case "assign_order_to_agent": {
        let orderNum = Number(funcArgs.order_number);
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

        let courier = allCouriers.find(c => funcArgs.agent_name && (c.name.toLowerCase().includes(funcArgs.agent_name.toLowerCase()) || funcArgs.agent_name.toLowerCase().includes(c.name.toLowerCase())));
        if (!courier && funcArgs.agent_name) {
          const { match } = findBestMatch(allCouriers, funcArgs.agent_name);
          courier = match;
        }

        if (!courier) {
          const buttons = allCouriers.slice(0, 6).map(c => ({
            text: `🛵 ${c.name}`,
            action: `اسند طلب ${targetOrder.orderNumber} للمندوب ${c.name}`
          }));
          return {
            reply: `يا أبو الأكبر، أسند طلب #${targetOrder.orderNumber} لأي كابتن؟ 👇`,
            buttons
          };
        }

        const updated = await prisma.order.update({
          where: { id: targetOrder.id },
          data: {
            assignedCourierId: courier.id,
            status: "assigned"
          }
        });

        ctx.lastOrderNumber = updated.orderNumber;
        ctx.updatedAt = Date.now();

        const shopName = targetOrder.shop?.name || "المحل";
        const regionName = targetOrder.customerRegion?.name || "غير محددة";
        const orderType = targetOrder.orderType || "غير محدد";
        const noteTime = targetOrder.orderNoteTime || "الان";
        const subtotalVal = targetOrder.orderSubtotal ? Number(targetOrder.orderSubtotal) : 0;
        const totalVal = targetOrder.totalAmount ? Number(targetOrder.totalAmount) : subtotalVal;

        return {
          reply: `تم يا أبو الأكبر! أسندت طلب #${updated.orderNumber} إلى الكابتن (${courier.name}) 🛵\n🏪 **المحل:** ${shopName} | 📍 **المنطقة:** ${regionName}\n📦 **نوع الطلب:** ${orderType} | ⏰ **وقت الطلب:** ${noteTime}\n💰 **سعر الطلب:** ${subtotalVal} ألف (المجموع: ${totalVal} ألف)`
        };
      }

      case "create_order": {
        const initialDraft: OrderDraftState = {
          step: "waiting_shop",
          shopId: null,
          shopName: funcArgs.shop_name || null,
          regionId: null,
          regionName: funcArgs.region_name || null,
          phone: funcArgs.phone || null,
          orderType: funcArgs.order_type || null,
          price: funcArgs.price !== undefined && funcArgs.price !== null ? Number(funcArgs.price) : undefined,
          noteTime: funcArgs.note_time || null
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

      case "get_daily_summary": {
        const { getDailySummaryReport } = await import("./ai-order-wizard");
        return await getDailySummaryReport();
      }

      case "update_agent_name": {
        const oldName = funcArgs.old_name;
        const newName = funcArgs.new_name;
        let targetCourier = allCouriers.find(c => oldName && (c.name.toLowerCase().includes(oldName.toLowerCase()) || oldName.toLowerCase().includes(c.name.toLowerCase())));
        if (!targetCourier && oldName) {
          const { match } = findBestMatch(allCouriers, oldName);
          targetCourier = match;
        }

        if (!targetCourier) {
          return { reply: `يا أبو الأكبر، ما لكيت مندوب باسم (${oldName}). المندوبين: ${allCouriers.map(c => c.name).join("، ")}.` };
        }

        if (!newName) {
          return { reply: `يا أبو الأكبر، اذكرلي الاسم الجديد بوضوح لأعدل بيه المندوب (${targetCourier.name}).` };
        }

        const updated = await prisma.courier.update({
          where: { id: targetCourier.id },
          data: { name: newName }
        });

        return {
          reply: `تم يا أبو الأكبر! عدلت اسم الكابتن من (${targetCourier.name}) إلى (${updated.name}) بنجاح 🚀`
        };
      }

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

      case "GET_COURIER_ORDERS_STATUS": {
        const courierQuery = plan.courier_name || userText;
        let matchedCourier = allCouriers.find(c => courierQuery && (c.name.toLowerCase().includes(courierQuery.toLowerCase()) || courierQuery.toLowerCase().includes(c.name.toLowerCase())));
        if (!matchedCourier && plan.courier_name) {
          const { match } = findBestMatch(allCouriers, plan.courier_name);
          matchedCourier = match;
        }

        if (!matchedCourier) {
          const buttons = allCouriers.slice(0, 6).map(c => ({
            text: `🛵 ${c.name}`,
            action: `طلبات المندوب ${c.name}`
          }));
          return {
            reply: `يا أبو الأكبر، تقصد استعلام طلبات أي مندوب من هذولي؟ 👇`,
            buttons
          };
        }

        const [undeliveredCount, deliveredCount, archivedCount, activeOrders] = await Promise.all([
          prisma.order.count({
            where: {
              assignedCourierId: matchedCourier.id,
              status: { in: ["assigned", "delivering", "pending"] }
            }
          }),
          prisma.order.count({
            where: {
              assignedCourierId: matchedCourier.id,
              status: { in: ["delivered", "completed", "received"] }
            }
          }),
          prisma.order.count({
            where: {
              assignedCourierId: matchedCourier.id,
              status: "archived"
            }
          }),
          prisma.order.findMany({
            where: {
              assignedCourierId: matchedCourier.id,
              status: { in: ["assigned", "delivering"] }
            },
            take: 5,
            include: { shop: true, customerRegion: true }
          })
        ]);

        let replyText = `🛵 **إحصائية طلبات الكابتن (${matchedCourier.name}) حالياً:**\n`;
        replyText += `🔹 **طلبات غير واصلة (قيد التوصيل):** ${undeliveredCount} طلبات\n`;
        replyText += `🔹 **طلبات واصلة ومسلّمة:** ${deliveredCount} طلبات\n`;
        replyText += `🔹 **طلبات مؤرشفة:** ${archivedCount} طلبات\n`;

        if (activeOrders.length > 0) {
          replyText += `\n📋 **الطلبات قيد التوصيل حالياً:**\n`;
          activeOrders.forEach((o, i) => {
            const sName = o.shop?.name || "محل";
            const rName = o.customerRegion?.name || "منطقة";
            const price = o.orderSubtotal ? Number(o.orderSubtotal) : 0;
            replyText += `${i + 1}. **طلب #${o.orderNumber}** ⬅️ (${sName}) إلى (${rName}) بمبلغ ${price} ألف\n`;
          });
        }

        const buttons = [];
        if (deliveredCount > 0) {
          buttons.push({
            text: `📦 أرشفة مسلّمات ${matchedCourier.name}`,
            action: `ارشف طلبيات ${matchedCourier.name} المسلمة`
          });
        }
        buttons.push({
          text: `💰 تصفير حساب ${matchedCourier.name}`,
          action: `صفر حساب المندوب ${matchedCourier.name}`
        });

        return { reply: replyText, buttons };
      }

      case "GET_PENDING_ORDERS": {
        const pendingCount = await prisma.order.count({ where: { status: "pending" } });
        if (pendingCount === 0) {
          return { reply: "يا أبو الأكبر، ما عندنا أي طلبات جديدة معلقة حالياً! كل الطلبات مفرزة ومسندة 🎉" };
        }

        const pendingOrders = await prisma.order.findMany({
          where: { status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { shop: true, customerRegion: true }
        });

        let replyText = `📋 **عندنا حالياً (${pendingCount}) طلبات جديدة معلقة يا أبو الأكبر:**\n\n`;
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
        if (plan.reply_text && plan.reply_text.trim().length > 3 && !plan.reply_text.includes("تدلل يا أبو الأكبر، آمرني")) {
          return { reply: plan.reply_text.trim() };
        }

        const freeReply = await askGeminiFreeChat(userText);
        if (freeReply) {
          return { reply: freeReply };
        }

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

/**
 * دالة الاستشارة الحرة والمحادثة الذكية المباشرة عبر Google Gemini
 */
export async function askGeminiFreeChat(userText: string): Promise<string | null> {
  try {
    const keys = await getAllActiveGeminiKeys();
    if (!keys || keys.length === 0) return null;

    const candidateModels = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-3.6-flash"];
    const cleanInput = userText.replace(/#/g, "").trim();

    for (const k of keys) {
      for (const model of candidateModels) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${k.key}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const res = await fetch(url, {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `أنت نموذج الذكاء الاصطناعي Google Gemini (المساعد الذكي والشخصي والعقل المفكر لـ أبو الأكبر).
تحدث بلهجة عراقية محترمة، واعية، ذكية، ومباشرة.
أجب عن سؤال واستشارة ونقاش أبو الأكبر بأسلوب ذكي ومقنع ومفيد ومختصر بدون إطالة زائدة وبدون قوالب مسبقة:
سؤال وكلام أبو الأكبر: "${cleanInput}"`
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 500
              }
            })
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const txt = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (txt?.trim()) {
              return txt.trim();
            }
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
  return null;
}

// تصدير الاسم البديل لضمان التوافق مع أي استيراد في المشروع
export const executeAutonomousGeminiAgent = executeAutonomousAiCommand;
