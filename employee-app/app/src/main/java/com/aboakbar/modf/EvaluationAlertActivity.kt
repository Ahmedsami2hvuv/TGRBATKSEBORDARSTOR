package com.aboakbar.modf

import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.*
import androidx.appcompat.widget.SwitchCompat
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
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }

        setContentView(R.layout.activity_evaluation_alert)
        setFinishOnTouchOutside(false)

        // جعل النافذة عريضة وواضحة (95% من عرض الشاشة)
        val displayMetrics = resources.displayMetrics
        val width = (displayMetrics.widthPixels * 0.95).toInt()
        window.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT)

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
        val btnChangeInterval = findViewById<Button>(R.id.btnChangeInterval)

        // زر إرسال التقييم بالواتساب
        btnSend.setOnClickListener {
            sendEvaluationViaWhatsapp()
        }

        // زر تخطي / لاحقاً
        btnSkip.setOnClickListener {
            val interval = EvaluationSchedulerService.getIntervalMinutes(this)
            EvaluationSchedulerService.scheduleNextEvaluation(this, interval)
            finish()
        }

        // زر ضبط وقت الإشعار
        btnChangeInterval.setOnClickListener {
            showIntervalSettingsDialog()
        }
    }

    private fun showIntervalSettingsDialog() {
        val dialog = Dialog(this)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(R.layout.dialog_evaluation_settings)
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
        dialog.window?.setLayout((resources.displayMetrics.widthPixels * 0.90).toInt(), ViewGroup.LayoutParams.WRAP_CONTENT)

        val switchEnable = dialog.findViewById<SwitchCompat>(R.id.switchEnableEvaluation)
        val rgInterval = dialog.findViewById<RadioGroup>(R.id.rgInterval)
        val btnSave = dialog.findViewById<Button>(R.id.btnSaveInterval)

        val currentEnabled = EvaluationSchedulerService.isEnabled(this)
        val currentInterval = EvaluationSchedulerService.getIntervalMinutes(this)

        switchEnable.isChecked = currentEnabled

        when (currentInterval) {
            15 -> dialog.findViewById<RadioButton>(R.id.rb15Min)?.isChecked = true
            30 -> dialog.findViewById<RadioButton>(R.id.rb30Min)?.isChecked = true
            60 -> dialog.findViewById<RadioButton>(R.id.rb60Min)?.isChecked = true
            120 -> dialog.findViewById<RadioButton>(R.id.rb120Min)?.isChecked = true
            180 -> dialog.findViewById<RadioButton>(R.id.rb180Min)?.isChecked = true
            else -> dialog.findViewById<RadioButton>(R.id.rb60Min)?.isChecked = true
        }

        btnSave.setOnClickListener {
            val isEnabled = switchEnable.isChecked
            var newInterval = 60
            when (rgInterval.checkedRadioButtonId) {
                R.id.rb15Min -> newInterval = 15
                R.id.rb30Min -> newInterval = 30
                R.id.rb60Min -> newInterval = 60
                R.id.rb120Min -> newInterval = 120
                R.id.rb180Min -> newInterval = 180
            }

            EvaluationSchedulerService.setEnabled(this, isEnabled)
            EvaluationSchedulerService.setIntervalMinutes(this, newInterval)

            Toast.makeText(this, "تم حفظ إعدادات الوقت: كل $newInterval دقيقة", Toast.LENGTH_SHORT).show()
            dialog.dismiss()
        }

        dialog.show()
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

        // 2. تأشير الطلب في السيرفر ومحلياً كمُرسل تقييم
        markOrderRatedOnServer(orderId)

        // 3. جدولة التنبيه القادم بعد الفاصل الزمني المحدد من الآن
        val interval = EvaluationSchedulerService.getIntervalMinutes(this)
        EvaluationSchedulerService.scheduleNextEvaluation(this, interval)

        Toast.makeText(this, "تم إرسال طلب التقييم وتأشير الطلب في النظام بنجاح!", Toast.LENGTH_SHORT).show()
        finish()
    }

    private fun markOrderRatedOnServer(id: String) {
        if (id.isEmpty()) return

        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val se = sharedPreferences.getString("se", "") ?: ""
        val exp = sharedPreferences.getString("exp", "") ?: ""
        val sig = sharedPreferences.getString("sig", "") ?: ""
        val staffId = sharedPreferences.getString("staff_id", "") ?: ""
        val savedPortalUrl = sharedPreferences.getString("admin_token", "") ?: ""

        // حفظ محلي فوري لمنع التكرار
        val locallyRatedSet = sharedPreferences.getStringSet("locally_rated_order_ids", mutableSetOf())?.toMutableSet() ?: mutableSetOf()
        locallyRatedSet.add(id)
        sharedPreferences.edit().putStringSet("locally_rated_order_ids", locallyRatedSet).apply()

        val json = JSONObject().apply {
            put("orderId", id)
        }
        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())

        val requestBuilder = Request.Builder()
            .url("$BACKEND_URL/api/employee/evaluation-queue/mark-sent?orderId=$id")
            .post(body)

        if (se.isNotEmpty()) requestBuilder.header("x-employee-se", se)
        if (exp.isNotEmpty()) requestBuilder.header("x-employee-exp", exp)
        if (sig.isNotEmpty()) requestBuilder.header("x-employee-sig", sig)
        if (staffId.isNotEmpty()) requestBuilder.header("x-employee-staff-id", staffId)
        if (savedPortalUrl.isNotEmpty()) requestBuilder.header("Authorization", "Bearer $savedPortalUrl")

        val request = requestBuilder.build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                // فشل الشبكة - تم حفظه محلياً كإجراء احترازي
            }
            override fun onResponse(call: Call, response: Response) {
                response.close()
            }
        })
    }
}
