package com.aboakbar.modf

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Window
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class EvaluationAlertActivity : Activity() {

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val BACKEND_URL = "https://aboakbr.com"

    private var orderId: String = ""
    private var orderNumber: Int = 0
    private var customerPhone: String = ""
    private var generatedMessage: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestWindowFeature(Window.FEATURE_NO_TITLE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }

        setContentView(R.layout.activity_evaluation_alert)
        setFinishOnTouchOutside(false)

        orderId = intent.getStringExtra("orderId") ?: ""
        orderNumber = intent.getIntExtra("orderNumber", 0)
        val shopName = intent.getStringExtra("shopName") ?: "—"
        val regionName = intent.getStringExtra("regionName") ?: "—"
        customerPhone = intent.getStringExtra("customerPhone") ?: ""
        generatedMessage = intent.getStringExtra("generatedMessage") ?: ""
        val remainingCount = intent.getIntExtra("remainingCount", 0)

        findViewById<TextView>(R.id.tvOrderNumber).text = "#$orderNumber"
        findViewById<TextView>(R.id.tvShopName).text = "المحل: $shopName"
        findViewById<TextView>(R.id.tvRegionAndPhone).text = "📍 $regionName | 📞 $customerPhone"
        findViewById<TextView>(R.id.tvGeneratedMessage).text = generatedMessage
        findViewById<TextView>(R.id.tvRemainingCount).text = "الطلبات المتبقية بانتظار التقييم: $remainingCount"

        val btnSend = findViewById<Button>(R.id.btnSendEvaluation)
        val btnSkip = findViewById<Button>(R.id.btnSkipEvaluation)

        btnSend.setOnClickListener {
            sendEvaluationViaWhatsapp()
        }

        btnSkip.setOnClickListener {
            // جدولة الموعد القادم بعد ساعة من الآن لحماية الفواصل الزمنية
            EvaluationSchedulerService.scheduleNextEvaluation(this, 60)
            finish()
        }
    }

    private fun sendEvaluationViaWhatsapp() {
        if (customerPhone.isEmpty()) {
            Toast.makeText(this, "رقم هاتف الزبون غير متوفر", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        // 1. فتح تطبيق الواتساب مباشرة برقم الزبون والرسالة
        try {
            val encodedMessage = Uri.encode(generatedMessage)
            val waUri = Uri.parse("https://api.whatsapp.com/send?phone=$customerPhone&text=$encodedMessage")
            val intent = Intent(Intent.ACTION_VIEW, waUri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
        } catch (e: Exception) {
            try {
                val waIntent = Intent(Intent.ACTION_VIEW, Uri.parse("whatsapp://send?phone=$customerPhone&text=" + Uri.encode(generatedMessage)))
                waIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                startActivity(waIntent)
            } catch (ex: Exception) {
                Toast.makeText(this, "تعذر فتح تطبيق الواتساب", Toast.LENGTH_SHORT).show()
            }
        }

        // 2. تأشير الطلب في السيرفر كمُرسل تقييم
        markOrderRatedOnServer(orderId)

        // 3. جدولة التنبيه القادم بعد ساعة كاملة من الآن (حماية تباعد الرسائل)
        EvaluationSchedulerService.scheduleNextEvaluation(this, 60)

        Toast.makeText(this, "تم توجيهك للواتساب لإرسال طلب التقييم بنجاح!", Toast.LENGTH_SHORT).show()
        finish()
    }

    private fun markOrderRatedOnServer(id: String) {
        if (id.isEmpty()) return

        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val se = sharedPreferences.getString("se", "") ?: ""
        val exp = sharedPreferences.getString("exp", "") ?: ""
        val sig = sharedPreferences.getString("sig", "") ?: ""

        val json = JSONObject().apply {
            put("orderId", id)
        }
        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())

        val request = Request.Builder()
            .url("$BACKEND_URL/api/employee/evaluation-queue/mark-sent")
            .header("x-employee-se", se)
            .header("x-employee-exp", exp)
            .header("x-employee-sig", sig)
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) {}
        })
    }
}
