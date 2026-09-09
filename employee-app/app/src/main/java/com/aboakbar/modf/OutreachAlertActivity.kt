package com.aboakbar.modf

import android.app.Activity
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class OutreachAlertActivity : Activity() {

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val BACKEND_URL = "https://aboakbr.com"

    private var itemId: String = ""
    private var phone: String = ""
    private var originalInput: String = ""
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

        setContentView(R.layout.activity_outreach_alert)
        setFinishOnTouchOutside(false)

        val displayMetrics = resources.displayMetrics
        val width = (displayMetrics.widthPixels * 0.95).toInt()
        window.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT)

        itemId = intent.getStringExtra("itemId") ?: ""
        phone = intent.getStringExtra("phone") ?: ""
        originalInput = intent.getStringExtra("originalInput") ?: ""
        generatedMessage = intent.getStringExtra("generatedMessage") ?: ""
        val remainingCount = intent.getIntExtra("remainingCount", 0)

        findViewById<TextView>(R.id.tvOutreachPhone).text = "📞 $phone"
        if (originalInput.isNotEmpty() && originalInput != phone) {
            findViewById<TextView>(R.id.tvOutreachOriginalInput).text = "الاسم/المدخل: $originalInput"
            findViewById<TextView>(R.id.tvOutreachOriginalInput).visibility = android.view.View.VISIBLE
        } else {
            findViewById<TextView>(R.id.tvOutreachOriginalInput).visibility = android.view.View.GONE
        }
        findViewById<TextView>(R.id.tvOutreachMessage).text = generatedMessage
        findViewById<TextView>(R.id.tvOutreachRemainingCount).text = "الزبائن المتبقين في القائمة: $remainingCount"

        val btnSend = findViewById<Button>(R.id.btnSendOutreach)
        val btnSkip = findViewById<Button>(R.id.btnSkipOutreach)
        val btnChangeInterval = findViewById<Button>(R.id.btnChangeOutreachInterval)

        btnSend.setOnClickListener {
            sendOutreachViaWhatsapp()
        }

        btnSkip.setOnClickListener {
            val interval = OutreachSchedulerService.getIntervalMinutes(this)
            OutreachSchedulerService.scheduleNextOutreach(this, interval)
            finish()
        }

        btnChangeInterval.setOnClickListener {
            RemindersSettingsHelper.showCombinedSettingsDialog(this)
        }
    }

    private fun normalizeIraqiPhoneForWhatsApp(raw: String): String {
        var clean = raw.replace("[^0-9]".toRegex(), "")
        while (clean.startsWith("00")) {
            clean = clean.substring(2)
        }
        if (clean.startsWith("964") && clean.length >= 12) {
            return clean
        }
        if (clean.startsWith("07") && clean.length == 11) {
            return "964" + clean.substring(1)
        }
        if (clean.startsWith("7") && clean.length == 10) {
            return "964" + clean
        }
        return clean
    }

    private fun sendOutreachViaWhatsapp() {
        if (phone.isEmpty()) {
            Toast.makeText(this, "رقم هاتف الزبون غير متوفر", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val waFormattedPhone = normalizeIraqiPhoneForWhatsApp(phone)

        // 1. فتح تطبيق الواتساب مباشرة برقم الزبون الدولي والرسالة
        try {
            val encodedMessage = Uri.encode(generatedMessage)
            val waUri = Uri.parse("https://api.whatsapp.com/send?phone=$waFormattedPhone&text=$encodedMessage")
            val intent = Intent(Intent.ACTION_VIEW, waUri).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            startActivity(intent)
        } catch (e: Exception) {
            try {
                val waIntent = Intent(Intent.ACTION_VIEW, Uri.parse("whatsapp://send?phone=$waFormattedPhone&text=" + Uri.encode(generatedMessage)))
                waIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                startActivity(waIntent)
            } catch (ex: Exception) {
                Toast.makeText(this, "تعذر فتح تطبيق الواتساب", Toast.LENGTH_SHORT).show()
            }
        }

        // 2. تأشير الرقم في السيرفر ومحلياً كمكتمل فورياً ليتحول لقائمة المكتمل
        markOutreachSentOnServer(itemId)

        // 3. جدولة تنبيه فتح تطبيق الاتصال بعد 15 ثانية بالضبط لحفظ الرقم
        scheduleSaveContactPrompt(this, phone, originalInput, 15)

        // 4. جدولة الزبون التالي بعد الفاصل الزمني المحدد
        val interval = OutreachSchedulerService.getIntervalMinutes(this)
        OutreachSchedulerService.scheduleNextOutreach(this, interval)

        Toast.makeText(this, "تم فتح الواتساب وتأشير الزبون كمكتمل! سيظهر تنبيه حفظ الرقم بعد 15 ثانية ⏰", Toast.LENGTH_LONG).show()
        finish()
    }

    private fun scheduleSaveContactPrompt(context: Context, targetPhone: String, targetName: String, delaySeconds: Int) {
        try {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, SaveContactReceiver::class.java).apply {
                putExtra("phone", targetPhone)
                putExtra("contactName", targetName)
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(context, 7712, intent, flags)
            val triggerTime = System.currentTimeMillis() + (delaySeconds * 1000L)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun markOutreachSentOnServer(id: String) {
        if (id.isEmpty()) return

        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val se = sharedPreferences.getString("se", "") ?: ""
        val exp = sharedPreferences.getString("exp", "") ?: ""
        val sig = sharedPreferences.getString("sig", "") ?: ""
        val staffId = sharedPreferences.getString("staff_id", "") ?: ""
        val savedPortalUrl = sharedPreferences.getString("admin_token", "") ?: ""

        val locallySentSet = sharedPreferences.getStringSet("locally_outreach_sent_ids", mutableSetOf())?.toMutableSet() ?: mutableSetOf()
        locallySentSet.add(id)
        sharedPreferences.edit().putStringSet("locally_outreach_sent_ids", locallySentSet).apply()

        val json = JSONObject().apply {
            put("itemId", id)
        }
        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())

        val requestBuilder = Request.Builder()
            .url("$BACKEND_URL/api/employee/outreach-queue/mark-sent?itemId=$id")
            .post(body)

        if (se.isNotEmpty()) requestBuilder.header("x-employee-se", se)
        if (exp.isNotEmpty()) requestBuilder.header("x-employee-exp", exp)
        if (sig.isNotEmpty()) requestBuilder.header("x-employee-sig", sig)
        if (staffId.isNotEmpty()) requestBuilder.header("x-employee-staff-id", staffId)
        if (savedPortalUrl.isNotEmpty()) requestBuilder.header("Authorization", "Bearer $savedPortalUrl")

        val request = requestBuilder.build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {}
            override fun onResponse(call: Call, response: Response) {
                response.close()
            }
        })
    }
}
