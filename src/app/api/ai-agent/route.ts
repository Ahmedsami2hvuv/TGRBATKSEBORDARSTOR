import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.NEXT_PUBLIC_GEMINI_KEY
].filter(Boolean) as string[]

/**
 * تعريف أدوات الذكاء الاصطناعي (Function Calling)
 */
const AI_TOOLS = [
  {
    function_declarations: [
      {
        name: "create_order",
        description: "إنشاء طلب توصيل جديد متكامل في نظام أبو الأكبر مباشرة من كلام المستخدم.",
        parameters: {
          type: "OBJECT",
          properties: {
            customerPhone: { type: "STRING", description: "رقم هاتف الزبون" },
            customerName: { type: "STRING", description: "اسم الزبون أو المستلم" },
            regionName: { type: "STRING", description: "اسم المنطقة أو الحي (مثال: الجزائر، الجبيلة، الطويسة، المعقل، التنومة، مهيجران، باب طويل)" },
            shopName: { type: "STRING", description: "اسم المحل أو المتجر إن ذكر، وإذا لم يذكر يترك فارغاً ليكون من الإدارة" },
            price: { type: "NUMBER", description: "سعر المواد أو الطلب بالدينار العراقي (مثلاً 25000 أو 25)" },
            deliveryPrice: { type: "NUMBER", description: "سعر التوصيل بالدينار إن حدده المستخدم، وإلا يترك تلقائياً" },
            orderType: { type: "STRING", description: "وصف الطلب أو المواد المطلوبة (مثال: كوزمتك، ملابس، وجبة، تجهيز، وجهتين)" },
            orderNoteTime: { type: "STRING", description: "وقت وتوقيت التسليم (مثال: فوري، باجر العصر، المغرب)" },
            notes: { type: "STRING", description: "أي ملاحظات إضافية أو تفاصيل العنوان والنقطة الدالة" },
            isTwoWay: { type: "BOOLEAN", description: "هل الطلب وجهتين (استلام من مكان وتسليم لمكان آخر)؟" },
            senderPhone: { type: "STRING", description: "هاتف المرسل في حال كان الطلب وجهتين" },
            senderArea: { type: "STRING", description: "منطقة المرسل في حال كان الطلب وجهتين" }
          },
          required: ["regionName"]
        }
      },
      {
        name: "zero_courier_balance",
        description: "تصفير حساب المندوب وسداد ذمته المالية في النظام.",
        parameters: {
          type: "OBJECT",
          properties: {
            courierName: { type: "STRING", description: "اسم المندوب المراد تصفير حسابه (مثلاً: فارس، علي، كرار)" }
          },
          required: ["courierName"]
        }
      },
      {
        name: "assign_order_to_courier",
        description: "إسناد وتوجيه طلب معين إلى مندوب توصيل محدد.",
        parameters: {
          type: "OBJECT",
          properties: {
            orderNumber: { type: "STRING", description: "رقم الطلب (مثال: 105 أو 2815)" },
            courierName: { type: "STRING", description: "اسم المندوب المطلوب تحويل الطلب إليه" }
          },
          required: ["orderNumber", "courierName"]
        }
      },
      {
        name: "update_order_status",
        description: "تحديث وتعديل حالة الطلب في النظام (واصل، ملغي، مؤجل، راجع، قيد التجهيز).",
        parameters: {
          type: "OBJECT",
          properties: {
            orderNumber: { type: "STRING", description: "رقم الطلب" },
            status: { 
              type: "STRING", 
              description: "الحالة الجديدة (delivered, cancelled, pending, in_progress, returning, preparing)" 
            }
          },
          required: ["orderNumber", "status"]
        }
      },
      {
        name: "query_system_summary",
        description: "الاستعلام عن وضع النظام وإحصائيات الطلبات المعلقة أو المكتملة أو المناديب.",
        parameters: {
          type: "OBJECT",
          properties: {
            queryType: { 
              type: "STRING", 
              description: "نوع الإحصائية المطلوبة: 'summary' أو 'pending' أو 'delivered' أو 'couriers'" 
            }
          }
        }
      }
    ]
  }
]

/**
 * تنفيذ إضافة طلب داخل قاعدة بيانات Supabase
 */
async function executeCreateOrder(args: any) {
  try {
    const rawShopName = (args.shopName || "").trim()
    let shop = null

    if (rawShopName && rawShopName !== "الإدارة" && rawShopName !== "الادارة") {
      shop = await prisma.shop.findFirst({
        where: { name: { contains: rawShopName, mode: 'insensitive' } }
      })
    }

    if (!shop) {
      shop = await prisma.shop.findFirst({
        where: { name: { contains: "الإدارة", mode: 'insensitive' } }
      })
      if (!shop) {
        shop = await prisma.shop.findFirst()
      }
      if (!shop) {
        shop = await prisma.shop.create({
          data: { name: "الإدارة", phone: "07700000000" }
        })
      }
    }

    // مطابقة المنطقة
    const regionName = (args.regionName || args.receiverArea || "البصرة").trim()
    let region = await prisma.region.findFirst({
      where: { name: { equals: regionName, mode: 'insensitive' } }
    })
    if (!region) {
      region = await prisma.region.findFirst({
        where: { name: { contains: regionName, mode: 'insensitive' } }
      })
    }
    if (!region) {
      region = await prisma.region.findFirst()
    }

    // حساب الأسعار
    let priceInput = args.price != null ? Number(args.price) : 0
    if (priceInput > 0 && priceInput < 1000) {
      // إذا كتب 25 وهو يقصد 25 الف
      priceInput = priceInput * 1000
    }
    const deliveryPriceNum = args.deliveryPrice != null && Number(args.deliveryPrice) > 0
      ? Number(args.deliveryPrice)
      : (region?.deliveryPrice ? Number(region.deliveryPrice) : 3000)

    const totalAmountNum = priceInput + deliveryPriceNum

    const isTwoWay = !!(args.isTwoWay || (args.senderPhone && args.customerPhone))
    let senderRegionId: string | null = null
    if (isTwoWay && args.senderArea) {
      const senderReg = await prisma.region.findFirst({
        where: { name: { contains: args.senderArea.trim(), mode: 'insensitive' } }
      })
      if (senderReg) senderRegionId = senderReg.id
    }

    const orderData: any = {
      shopId: shop.id,
      customerPhone: args.customerPhone || "07700000000",
      customerRegionId: region?.id || null,
      orderSubtotal: new Decimal(priceInput),
      deliveryPrice: new Decimal(deliveryPriceNum),
      totalAmount: new Decimal(totalAmountNum),
      status: "pending",
      orderType: isTwoWay ? "وجهتين" : (args.orderType || (shop.name === "الإدارة" ? "من الإدارة" : `طلب من ${shop.name}`)),
      submissionSource: "admin_ai",
      summary: args.notes || args.orderType || `طلب جديد - ${regionName}`,
      orderNoteTime: args.orderNoteTime || "فوري",
      customerLandmark: args.notes || "",
      routeMode: isTwoWay ? "two_way" : "single"
    }

    if (isTwoWay) {
      orderData.secondCustomerPhone = args.customerPhone
      orderData.customerPhone = args.senderPhone || "07700000000"
      orderData.secondCustomerRegionId = region?.id || null
      if (senderRegionId) {
        orderData.customerRegionId = senderRegionId
      }
    }

    const newOrder = await prisma.order.create({
      data: orderData
    })

    const message = `تم إنشاء الطلب رقم #${newOrder.orderNumber} بنجاح يا أبو الأكبر! 🚀\n` +
      `📍 المنطقة: ${regionName}\n` +
      `📞 الهاتف: ${args.customerPhone || "غير محدد"}\n` +
      `💰 السعر: ${priceInput.toLocaleString()} د.ع + التوصيل: ${deliveryPriceNum.toLocaleString()} د.ع (المجموع: ${totalAmountNum.toLocaleString()} د.ع)\n` +
      `🏪 المحل: ${shop.name}\n` +
      `🕒 الموعد: ${args.orderNoteTime || "فوري"}`

    return {
      done: true,
      action: "create_order",
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      message,
      data: {
        orderNumber: newOrder.orderNumber,
        region: regionName,
        phone: args.customerPhone,
        totalAmount: totalAmountNum,
        shopName: shop.name
      }
    }
  } catch (err: any) {
    console.error("[executeCreateOrder error]:", err)
    return { done: false, message: `تعذر إنشاء الطلب: ${err.message}` }
  }
}

/**
 * تصفير حساب المندوب داخل قاعدة بيانات Supabase
 */
async function executeZeroBalance(courierName: string) {
  try {
    const cleanName = courierName.trim()
    const courier = await prisma.courier.findFirst({
      where: { name: { contains: cleanName, mode: 'insensitive' } }
    })

    if (!courier) {
      return { done: false, message: `عذراً، لم أجد مندوباً باسم "${cleanName}" في النظام.` }
    }

    await prisma.courier.update({
      where: { id: courier.id },
      data: {
        mandoubTotalsResetAt: new Date(),
        mandoubWalletCarryOverDinar: new Decimal(0)
      }
    })

    return {
      done: true,
      action: "zero_balance",
      message: `تم تصفير حساب وسداد ذمة المندوب ${courier.name} بنجاح تام! 💰✅`
    }
  } catch (err: any) {
    return { done: false, message: `حدث خطأ أثناء تصفير الحساب: ${err.message}` }
  }
}

/**
 * إسناد طلب لمندوب داخل قاعدة البيانات
 */
async function executeAssignCourier(orderNumberStr: string, courierName: string) {
  try {
    const num = parseInt(orderNumberStr.replace(/[^\d]/g, "")) || 0
    const courier = await prisma.courier.findFirst({
      where: { name: { contains: courierName.trim(), mode: 'insensitive' } }
    })

    if (!courier) {
      return { done: false, message: `لم يتم العثور على المندوب "${courierName}".` }
    }

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { orderNumber: num },
          { id: { contains: orderNumberStr.trim() } }
        ]
      }
    })

    if (!order) {
      return { done: false, message: `لم يتم العثور على الطلب رقم "${orderNumberStr}".` }
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        assignedCourierId: courier.id,
        status: "assigned"
      }
    })

    return {
      done: true,
      action: "assign_order",
      message: `تم إسناد الطلب #${order.orderNumber} إلى المندوب ${courier.name} بنجاح! 🛵📦`
    }
  } catch (err: any) {
    return { done: false, message: `تعذر إسناد الطلب: ${err.message}` }
  }
}

/**
 * تحديث حالة طلب في قاعدة البيانات
 */
async function executeUpdateStatus(orderNumberStr: string, statusInput: string) {
  try {
    const num = parseInt(orderNumberStr.replace(/[^\d]/g, "")) || 0
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { orderNumber: num },
          { id: { contains: orderNumberStr.trim() } }
        ]
      }
    })

    if (!order) {
      return { done: false, message: `لم يتم العثور على الطلب رقم "${orderNumberStr}".` }
    }

    let finalStatus = statusInput.toLowerCase()
    if (finalStatus.includes("واصل") || finalStatus.includes("تسليم") || finalStatus.includes("deliver")) {
      finalStatus = "delivered"
    } else if (finalStatus.includes("لغي") || finalStatus.includes("الغاء") || finalStatus.includes("cancel")) {
      finalStatus = "cancelled"
    } else if (finalStatus.includes("راجع") || finalStatus.includes("return")) {
      finalStatus = "returned"
    } else if (finalStatus.includes("معلق") || finalStatus.includes("pend")) {
      finalStatus = "pending"
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { status: finalStatus }
    })

    return {
      done: true,
      action: "update_status",
      message: `تم تغيير حالة الطلب #${order.orderNumber} إلى "${finalStatus}" بنجاح! ✅`
    }
  } catch (err: any) {
    return { done: false, message: `تعذر تحديث حالة الطلب: ${err.message}` }
  }
}

/**
 * جلب ملخص وإحصائيات النظام من Supabase
 */
async function executeSystemSummary(queryType?: string) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [totalToday, pendingCount, deliveredCount, couriersCount] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { status: "pending" } }),
      prisma.order.count({ where: { status: "delivered", createdAt: { gte: today } } }),
      prisma.courier.count({ where: { blocked: false } })
    ])

    const message = `📊 ملخص إحصائيات النظام اليوم يا أبو الأكبر:\n` +
      `📦 إجمالي طلبات اليوم: ${totalToday}\n` +
      `⏳ الطلبات المعلقة (قيد الانتظار): ${pendingCount}\n` +
      `✅ الطلبات الواصلة اليوم: ${deliveredCount}\n` +
      `🛵 عدد المناديب النشطين: ${couriersCount}`

    return {
      done: true,
      action: "summary",
      message,
      data: { totalToday, pendingCount, deliveredCount, couriersCount }
    }
  } catch (err: any) {
    return { done: false, message: `تعذر جلب الإحصائيات: ${err.message}` }
  }
}

/**
 * معالج الاتصال بنماذج Gemini عبر Function Calling
 */
async function callGeminiAgent(prompt: string) {
  if (GEMINI_KEYS.length === 0) return null

  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]

  const systemInstruction = `أنت الوكيل الذكي الخارق والمدير التنفيذي لمنصة توصيل طلبات "أبو الأكبر" في البصرة والعراق.
تحدث بلهجة عراقية محترمة وودية ومباشرة جداً وبدون أي تكلف.
مهمتك:
1. فهم كلام المستخدم العراقي الطبيعي واستدعاء الأداة المناسبة فوراً (create_order أو zero_courier_balance أو assign_order_to_courier أو update_order_status أو query_system_summary).
2. عند إنشاء طلب: استخرج رقم الهاتف، المنطقة، السعر، المحل، ووقت التسليم من كلام المستخدم ونفذ مباشرة بدون أي أسئلة أو خطوات تعقيدية.
3. إذا كان كلام المستخدم مجرد تحية أو سؤال عام لا يتطلب تنفيذاً برمجياً، أجب عليه بلباقة ومحبة باللهجة العراقية.
`

  for (let i = 0; i < GEMINI_KEYS.length; i++) {
    const key = GEMINI_KEYS[i]
    const model = models[i % models.length]
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }]
          },
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ],
          tools: AI_TOOLS,
          tool_config: {
            function_calling_config: {
              mode: "AUTO"
            }
          }
        })
      })

      if (!response.ok) continue

      const data = await response.json()
      const candidate = data.candidates?.[0]
      const parts = candidate?.content?.parts || []

      for (const part of parts) {
        if (part.functionCall) {
          return {
            type: "function_call",
            name: part.functionCall.name,
            args: part.functionCall.args || {}
          }
        }
      }

      const text = parts.map((p: any) => p.text).filter(Boolean).join("\n")
      if (text) {
        return { type: "text", text }
      }
    } catch (e) {
      // تجربة المفتاح التالي
    }
  }

  return null
}

/**
 * معالج احتياطي فائق الذكاء (Fallback Heuristics) في حال انقطاع API
 */
async function fallbackExecution(prompt: string) {
  const text = prompt.toLowerCase()

  // 1. تصفير حساب
  if (text.includes("صفر") || text.includes("تصفير") || text.includes("مسح حساب")) {
    const match = prompt.match(/فارس|حسين|علي|محمد|نجم|احمد|أحمد|كرار|عباس|سجاد|مرتضى|زيد/)
    if (match) {
      return await executeZeroBalance(match[0])
    }
    const words = prompt.split(/\s+/)
    const idx = words.findIndex(w => w.includes("حساب") || w.includes("مندوب"))
    if (idx !== -1 && words[idx + 1]) {
      return await executeZeroBalance(words[idx + 1])
    }
  }

  // 2. إسناد طلب
  if (text.includes("اسند") || text.includes("اسناد") || text.includes("حول طلب")) {
    const numMatch = prompt.match(/\d{1,6}/)
    const riderMatch = prompt.match(/فارس|حسين|علي|محمد|نجم|احمد|أحمد|كرار|عباس|سجاد|مرتضى|زيد/)
    if (numMatch && riderMatch) {
      return await executeAssignCourier(numMatch[0], riderMatch[0])
    }
  }

  // 3. ملخص أو إحصائيات
  if (text.includes("وضع الطلبات") || text.includes("ملخص") || text.includes("احصائيات") || text.includes("شكو ماكو") || text.includes("كم طلب")) {
    return await executeSystemSummary()
  }

  // 4. إنشاء طلب ذكي
  if (text.includes("طلب") || text.includes("طلبية") || text.includes("اوردر") || text.includes("سوي") || text.includes("سويلي")) {
    const phoneMatch = prompt.match(/07\d{9}/)
    const priceMatch = prompt.match(/(\d+)\s*(الف|ألف|k)?/)
    let price = 0
    if (priceMatch) {
      const val = parseInt(priceMatch[1])
      price = val < 1000 && (priceMatch[2] || val <= 100) ? val * 1000 : val
    }

    // استخراج اسم المنطقة التقريبي
    const commonAreas = ["الجزائر", "الجبيلة", "الطويسة", "المعقل", "التنومة", "مهيجران", "باب طويل", "القبلة", "القبلة", "حمدان", "السراجي", "بريهة", "العشار", "الخورة", "المشراق"]
    let foundArea = "البصرة"
    for (const a of commonAreas) {
      if (prompt.includes(a)) {
        foundArea = a
        break
      }
    }

    return await executeCreateOrder({
      customerPhone: phoneMatch ? phoneMatch[0] : "07700000000",
      regionName: foundArea,
      price: price || 15000,
      notes: prompt
    })
  }

  return {
    done: true,
    message: "يا هلا ومية هلا بيك يا أبو الأكبر! 🌹 أمرني شتريد أسويلك؟ أكدر أسويلك طلب، أصفر حساب مندوب، أسند طلب، أو أنطيك ملخص الطلبات بنقرة وحدة وبدون أي تعقيد."
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const prompt = (body.prompt || body.message || "").trim()

    if (!prompt) {
      return NextResponse.json({ done: false, message: "يرجى كتابة رسالة أو التحدث بالصوت." })
    }

    // محاولة استدعاء Gemini AI Agent بالأدوات
    const agentResult = await callGeminiAgent(prompt)

    if (agentResult) {
      if (agentResult.type === "function_call") {
        const { name, args } = agentResult
        console.log(`[ai-agent] Function calling executed: ${name}`, args)

        if (name === "create_order") {
          const res = await executeCreateOrder(args)
          return NextResponse.json(res)
        } else if (name === "zero_courier_balance") {
          const res = await executeZeroBalance(args.courierName)
          return NextResponse.json(res)
        } else if (name === "assign_order_to_courier") {
          const res = await executeAssignCourier(args.orderNumber, args.courierName)
          return NextResponse.json(res)
        } else if (name === "update_order_status") {
          const res = await executeUpdateStatus(args.orderNumber, args.status)
          return NextResponse.json(res)
        } else if (name === "query_system_summary") {
          const res = await executeSystemSummary(args.queryType)
          return NextResponse.json(res)
        }
      } else if (agentResult.type === "text") {
        return NextResponse.json({
          done: true,
          message: agentResult.text
        })
      }
    }

    // إذا لم يتوفر اتصال خارجي، المعالج الاحتياطي الذكي
    const fallbackRes = await fallbackExecution(prompt)
    return NextResponse.json(fallbackRes)

  } catch (error: any) {
    console.error("[ai-agent POST error]:", error)
    return NextResponse.json(
      { done: false, message: `عذراً يا أبو الأكبر، حدث خطأ أثناء تنفيذ الأمر: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const count = await prisma.order.count()
    return NextResponse.json({
      status: "AI Agent الحقيقي في Supabase شغال بأعلى كفاءة 🚀",
      totalOrders: count
    })
  } catch (err: any) {
    return NextResponse.json({ status: "AI Agent جاهز", error: err.message })
  }
}
