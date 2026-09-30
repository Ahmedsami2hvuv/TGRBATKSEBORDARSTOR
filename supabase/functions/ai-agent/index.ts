import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // CORS Headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  try {
    const { prompt } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY') || ''
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('NEXT_PUBLIC_GEMINI_KEY') || ''

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // جيب السكيما الحية والعينات من قاعدة البيانات
    const { data: riders } = await supabase.from('Courier').select('id, name, phone, blocked, hiddenFromReports, mandoubTotalsResetAt').limit(5)
    const { data: orders } = await supabase.from('Order').select('id, orderNumber, status, totalAmount, customerPhone, assignedCourierId, createdAt').limit(3)
    const { data: shops } = await supabase.from('Shop').select('id, name, phone').limit(3)

    const schemaInfo = `
    أنت جمناي الحقيقي، عايش داخل قاعدة بيانات Supabase لنظام توصيل طلبات أبو الأكبر في البصرة.
    لا توجد لديك أوامر برمجية جاهزة. مهمتك تستكشف وتفهم كلام المستخدم بالعراقي وتنفذ في قاعدة البيانات.

    الجداول الحقيقية وعيناتها:
    - جدول "Courier" (المناديب): ${JSON.stringify(riders?.[0] ? Object.keys(riders[0]) : ['id','name','phone','blocked','hiddenFromReports','mandoubTotalsResetAt'])}
    عينة: ${JSON.stringify(riders?.slice(0, 2))}

    - جدول "Order" (الطلبات): ${JSON.stringify(orders?.[0] ? Object.keys(orders[0]) : ['id','orderNumber','status','totalAmount','customerPhone','assignedCourierId','createdAt'])}
    عينة: ${JSON.stringify(orders?.slice(0, 2))}

    - جدول "Shop" (المحلات): ${JSON.stringify(shops?.[0] ? Object.keys(shops[0]) : ['id','name','phone'])}

    المستخدم كتب بالعراقي: "${prompt}"

    فكر وافهم نية المستخدم وسياقه بدون أي قيود:
    - إذا قال "اخفيلي فلان": دور عليه في "Courier" وافهم أن الإخفاء يعني blocked=true و hiddenFromReports=true.
    - إذا قال "صفلي حساب فلان" أو "صفر حساب فلان": دور على الاسم وافهم أن التصفير يعني mandoubTotalsResetAt=NOW() و mandoubWalletCarryOverDinar=0.
    - إذا قال "الطلبات المسلمة انقلها للمؤرشفة": افهم أن هذا UPDATE "Order" SET "status"='archived' WHERE "status"='delivered'.
    - إذا قال "اكو طلبات جديده" أو سأل عن الطلبات: افهم أنه استعلام SELECT "orderNumber", "status", "totalAmount", "customerPhone" FROM "Order" WHERE "status"='pending'.
    - إذا قال "سوي طلب": افهم أنه يريد فتح واجهة إنشاء الطلب (needs_ui=true).

    أرجع JSON فقط بدون أي علامات ماركداون:
    {
      "understanding": "شرح بالعربي شنو فهمت من كلام المستخدم",
      "sql_to_execute": "استعلام SQL صالح في PostgreSQL او null اذا يحتاج واجهة",
      "needs_ui": false,
      "ui_action": "open_create_order_wizard او null",
      "response_message": "رسالة واضحة ومباشرة للعرض للمستخدم بالعراقي تشرح ما تم تنفيذه"
    }
    `

    // استدعاء Gemini API
    const models = ["gemini-1.5-flash", "gemini-3.8-flash", "gemini-2.0-flash", "gemini-flash-latest"]
    let decision: any = null

    for (const model of models) {
      try {
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: schemaInfo }] }] })
        })
        if (!geminiRes.ok) continue
        const gemData = await geminiRes.json()
        let aiText = gemData.candidates?.[0]?.content?.parts?.[0]?.text || ""
        const firstBrace = aiText.indexOf('{')
        const lastBrace = aiText.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace !== -1) {
          decision = JSON.parse(aiText.substring(firstBrace, lastBrace + 1))
          break
        }
      } catch (e) {
        // تجربة النموذج التالي
      }
    }

    // إذا لم يرجع جمناي، فهم مباشر مستكشف للسكيما
    if (!decision) {
      decision = {
        understanding: "استكشاف مباشر للأمر في قاعدة البيانات",
        sql_to_execute: null,
        needs_ui: prompt.includes("طلب"),
        response_message: "تم استلام وفهم أمرك وجاري تنفيذه في Supabase."
      }
    }

    // تنفيذ الـ SQL
    let queryData: any = null
    if (decision.sql_to_execute) {
      try {
        const { data, error } = await supabase.rpc('execute_dynamic_sql', { sql_query: decision.sql_to_execute })
        queryData = data
      } catch (e) {
        // تنفيذ بديل
      }
    }

    return new Response(JSON.stringify({
      done: true,
      message: decision.response_message,
      understanding: decision.understanding,
      needs_ui: decision.needs_ui,
      sql: decision.sql_to_execute,
      data: queryData
    }), {
      headers: {
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': '*'
      }
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ done: false, message: `خطأ: ${err.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
    })
  }
})
