import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * جلب مفاتيح Gemini من البيئة ومن جدول المفاتيح في قاعدة البيانات
 */
async function getAvailableGeminiKeys(): Promise<string[]> {
  const envKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.NEXT_PUBLIC_GEMINI_KEY
  ].filter(Boolean) as string[]

  try {
    const dbKeysRecords: any = await prisma.$queryRawUnsafe(
      'SELECT "key" FROM "GeminiApiKey" WHERE "active" = true ORDER BY "updatedAt" DESC LIMIT 5'
    ).catch(() => [])

    if (Array.isArray(dbKeysRecords)) {
      for (const row of dbKeysRecords) {
        if (row?.key && !envKeys.includes(row.key)) {
          envKeys.push(row.key)
        }
      }
    }
  } catch (e) {
    // تجاهل إن لم يكن الجدول موجوداً
  }

  return envKeys
}

/**
 * استخراج السكيما الحقيقية الحية من قاعدة بيانات Supabase
 */
async function getDatabaseSchemaContext(): Promise<string> {
  try {
    const rows: any = await prisma.$queryRaw`
      SELECT 
        c.table_name,
        string_agg(c.column_name || ' (' || c.data_type || ')', ', ') AS columns
      FROM information_schema.columns c
      JOIN information_schema.tables t ON c.table_name = t.table_name
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
        AND c.table_name NOT IN ('_prisma_migrations', 'SchemaPlaceholder')
      GROUP BY c.table_name
      ORDER BY c.table_name;
    `

    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r: any) => `جدول "${r.table_name}": ${r.columns}`).join("\n")
    }
  } catch (err) {
    console.warn("[ai-agent] Could not query full schema, using fallback structure:", err)
  }

  return `
جدول "Courier": id (text), name (text), phone (text), blocked (boolean), hiddenFromReports (boolean), mandoubTotalsResetAt (timestamp), mandoubWalletCarryOverDinar (numeric)
جدول "Order": id (text), orderNumber (integer), status (text), totalAmount (numeric), orderSubtotal (numeric), deliveryPrice (numeric), customerPhone (text), customerRegionId (text), shopId (text), assignedCourierId (text), summary (text), createdAt (timestamp)
جدول "Shop": id (text), name (text), phone (text)
جدول "Region": id (text), name (text), deliveryPrice (numeric)
جدول "Customer": id (text), name (text), phone (text)
`
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const prompt = (body.prompt || body.message || "").trim()

    if (!prompt) {
      return NextResponse.json({ done: false, message: "يرجى إرسال أمر أو رسالة." })
    }

    // 1. استخراج السكيما الحية الحقيقية من Supabase
    const schemaContext = await getDatabaseSchemaContext()
    const geminiKeys = await getAvailableGeminiKeys()

    // 2. توجيه الذكاء الاصطناعي للاستكشاف والفهم والتنفيذ بدون أوامر مسبقة
    const systemPrompt = `
أنت وكيل ذكي ومستكشف حقيقي لقاعدة بيانات Supabase (PostgreSQL) الخاصة بنظام توصيل طلبات "أبو الأكبر".
ليس لديك أي أوامر مبرمجة مسبقاً. مهمتك هي قراءة سكيما قاعدة البيانات الحقيقية وفهم كلام المستخدم باللهجة العراقية، ثم استنتاج ما يريده بدقة وتنفيذه كاستعلام SQL.

سكيما الجداول الحقيقية المتاحة حالياً في Supabase:
${schemaContext}

كلام المستخدم: "${prompt}"

قواعد هامة جداً:
1. فكر وافهم نية المستخدم وسياقه في نظام التوصيل:
   - إذا أراد إخفاء مندوب: ابحث عن حقول الإخفاء أو الحظر في جدول "Courier" مثل blocked و hiddenFromReports.
   - إذا أراد تصفير حساب مندوب: ابحث عن حقول التصفير والوقت في "Courier" مثل mandoubTotalsResetAt و mandoubWalletCarryOverDinar.
   - إذا أراد إسناد طلب: اربط رقم الطلب بالمندوب في جدول "Order".
   - إذا أراد الاستعلام عن بيانات أو إحصائيات: اكتب استعلام SELECT لجلبها.
   - إذا أراد إنشاء طلب: إذا كانت البيانات غير مكتملة، اطلب التفاصيل أو حدد needMoreInfo=true.
2. أسماء الجداول في PostgreSQL حساسة لحالة الأحرف، ضع دائماً أسماء الجداول والحقول المركبة بين علامتي اقتباس مزدوجتين مثل: "Courier", "Order", "mandoubTotalsResetAt", "orderNumber".
3. استخدم ILIKE للبحث بالأسماء حتى لا تتأثر بحالة الأحرف أو الهمزات.

أرجع فقط كائن JSON صالح وبدون أي علامات ماركداون:
{
  "reasoning": "شرح باللغة العربية لما فهمته من كلام المستخدم وما تنوي فعله في قاعدة البيانات",
  "actionType": "EXECUTE_SQL" | "QUERY_SQL" | "NEED_INFO" | "CHAT",
  "sql": "أمر الـ SQL المطلوب تنفيذه",
  "needMoreInfo": false,
  "userReply": "رسالة ودية وواضحة للمستخدم تشرح النتيجة باللهجة العراقية"
}
`

    let aiResult: any = null
    const models = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest", "gemini-pro"]

    for (const key of geminiKeys) {
      for (const model of models) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
          })

          if (!res.ok) continue

          const data = await res.json()
          let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ""
          const firstBrace = text.indexOf('{')
          const lastBrace = text.lastIndexOf('}')
          if (firstBrace !== -1 && lastBrace !== -1) {
            text = text.substring(firstBrace, lastBrace + 1)
            aiResult = JSON.parse(text)
            break
          }
        } catch (e) {
          // تجربة الموديل التالي أو المفتاح التالي
        }
      }
      if (aiResult) break
    }

    // 3. إذا لم ينجح الاتصال بالنموذج الخارجي، استخدم محرك الاستكشاف الذاتي لقاعدة البيانات
    if (!aiResult) {
      // تفكيك الكلمات لاستكشاف الجداول والأسماء تلقائياً في Supabase
      const words = prompt.split(/\s+/).filter(Boolean)
      let foundCourier: any = null

      for (const w of words) {
        if (w.length >= 3) {
          const c: any = await prisma.$queryRawUnsafe(
            `SELECT id, name FROM "Courier" WHERE name ILIKE '%${w}%' LIMIT 1`
          ).catch(() => null)
          if (Array.isArray(c) && c.length > 0) {
            foundCourier = c[0]
            break
          }
        }
      }

      if (foundCourier && (prompt.includes("اخفي") || prompt.includes("حظر") || prompt.includes("عطل"))) {
        aiResult = {
          reasoning: `استكشفت اسم المندوب (${foundCourier.name}) في جدول Courier، والمستخدم يريد إخفاءه من النظام`,
          actionType: "EXECUTE_SQL",
          sql: `UPDATE "Courier" SET "blocked" = true, "hiddenFromReports" = true WHERE id = '${foundCourier.id}'`,
          userReply: `تم إخفاء وحظر المندوب ${foundCourier.name} بنجاح من النظام والتقارير ✅`
        }
      } else if (foundCourier && (prompt.includes("صفر") || prompt.includes("تصفير") || prompt.includes("مسح"))) {
        aiResult = {
          reasoning: `استكشفت اسم المندوب (${foundCourier.name}) في جدول Courier، والمستخدم يريد تصفير حسابه`,
          actionType: "EXECUTE_SQL",
          sql: `UPDATE "Courier" SET "mandoubTotalsResetAt" = NOW(), "mandoubWalletCarryOverDinar" = 0 WHERE id = '${foundCourier.id}'`,
          userReply: `تم تصفير حساب المندوب ${foundCourier.name} وسداد ذمته المالية بنجاح 💰✅`
        }
      } else if (foundCourier && (prompt.includes("اظهر") || prompt.includes("فعل") || prompt.includes("فك"))) {
        aiResult = {
          reasoning: `استكشفت اسم المندوب (${foundCourier.name}) في جدول Courier، والمستخدم يريد إظهاره وتفعيله`,
          actionType: "EXECUTE_SQL",
          sql: `UPDATE "Courier" SET "blocked" = false, "hiddenFromReports" = false WHERE id = '${foundCourier.id}'`,
          userReply: `تم إظهار وتفعيل المندوب ${foundCourier.name} في النظام بنجاح 🛵✅`
        }
      } else if (prompt.includes("طلب") && (prompt.includes("سوي") || prompt.includes("انشاء") || prompt.includes("اريد"))) {
        aiResult = {
          reasoning: "المستخدم يريد إنشاء طلب جديد",
          actionType: "NEED_INFO",
          needMoreInfo: true,
          userReply: "تأمرني يا أبو الأكبر! شنو نوع الطلب اللي تريده؟\n1️⃣ من الإدارة\n2️⃣ وجهتين\n3️⃣ من محل\n4️⃣ تجهيز طلب"
        }
      } else {
        aiResult = {
          reasoning: "استفسار عام عن النظام",
          actionType: "CHAT",
          userReply: "يا هلا ومية هلا بيك يا أبو الأكبر! 🌹 أنا وكيلك الذكي المستكشف المتصل مباشرة بقاعدة البيانات. اكتب أي أمر تريده بدون قيود وسأفهمه وأنفذه فوراً."
        }
      }
    }

    // 4. تنفيذ استعلام الـ SQL المستنتج مباشرة في Supabase
    if (aiResult.sql && (aiResult.actionType === "EXECUTE_SQL" || aiResult.actionType === "UPDATE" || aiResult.actionType === "INSERT")) {
      try {
        await prisma.$queryRawUnsafe(aiResult.sql)
        return NextResponse.json({
          done: true,
          message: `${aiResult.userReply || "تم تنفيذ الأمر بنجاح في قاعدة البيانات"}`,
          sql: aiResult.sql,
          reasoning: aiResult.reasoning
        })
      } catch (dbErr: any) {
        console.error("[ai-agent] SQL execution error:", dbErr)
        return NextResponse.json({
          done: false,
          message: `فهمت قصدك: ${aiResult.reasoning || ""} لكن حدث خطأ أثناء تنفيذ الأمر في قاعدة البيانات: ${dbErr.message}`,
          sql: aiResult.sql
        })
      }
    }

    // 5. استعلامات القراءة (SELECT)
    if (aiResult.sql && (aiResult.actionType === "QUERY_SQL" || aiResult.actionType === "SELECT")) {
      try {
        const queryData: any = await prisma.$queryRawUnsafe(aiResult.sql)
        return NextResponse.json({
          done: true,
          message: `${aiResult.userReply || "إليك نتائج الاستعلام:"}\n\n${JSON.stringify(queryData, null, 2)}`,
          data: queryData,
          sql: aiResult.sql,
          reasoning: aiResult.reasoning
        })
      } catch (dbErr: any) {
        return NextResponse.json({
          done: false,
          message: `تعذر جلب البيانات: ${dbErr.message}`,
          sql: aiResult.sql
        })
      }
    }

    return NextResponse.json({
      done: !aiResult.needMoreInfo,
      needType: aiResult.needMoreInfo,
      message: aiResult.userReply || aiResult.reasoning
    })

  } catch (error: any) {
    console.error("[ai-agent POST critical error]:", error)
    return NextResponse.json(
      { done: false, message: `عذراً يا أبو الأكبر، حدث خطأ: ${error.message}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: "الوكيل المستكشف الحقيقي داخل Supabase متصل وشغال 🚀"
  })
}
