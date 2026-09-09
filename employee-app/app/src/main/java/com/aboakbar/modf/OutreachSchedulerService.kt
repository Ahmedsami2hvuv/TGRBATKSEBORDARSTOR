package com.aboakbar.modf

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.Toast
import okhttp3.*
import org.json.JSONObject
import java.io.IOException

object OutreachSchedulerService {

    private const val PREFS_NAME = "AboAkbarPrefs"
    private const val KEY_OUTREACH_ENABLED = "outreach_scheduler_enabled"
    private const val KEY_OUTREACH_INTERVAL_MINUTES = "outreach_interval_minutes"
    private const val BACKEND_URL = "https://aboakbr.com"
    private val client = OkHttpClient()

    private const val KEY_OUTREACH_NEXT_TRIGGER = "outreach_next_trigger_time"

    fun isEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_OUTREACH_ENABLED, false) // غير مفعل افتراضياً حتى يفعله الموظف
    }

    fun setEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_OUTREACH_ENABLED, enabled).apply()
        if (enabled) {
            scheduleNextOutreach(context, getIntervalMinutes(context))
        } else {
            cancelSchedule(context)
        }
    }

    fun getIntervalMinutes(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt(KEY_OUTREACH_INTERVAL_MINUTES, 60) // افتراضياً كل 60 دقيقة
    }

    fun setIntervalMinutes(context: Context, minutes: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putInt(KEY_OUTREACH_INTERVAL_MINUTES, minutes).apply()
        if (isEnabled(context)) {
            scheduleNextOutreach(context, minutes)
        }
    }

    fun getNextTriggerTime(context: Context): Long {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getLong(KEY_OUTREACH_NEXT_TRIGGER, 0L)
    }

    fun scheduleNextOutreach(context: Context, minutes: Int) {
        try {
            val triggerTime = System.currentTimeMillis() + (minutes * 60 * 1000L)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putLong(KEY_OUTREACH_NEXT_TRIGGER, triggerTime).apply()

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, OutreachAlarmReceiver::class.java).apply {
                action = "com.aboakbar.modf.ACTION_TRIGGER_OUTREACH"
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(context, 9991, intent, flags)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                val intent = Intent(context, OutreachAlarmReceiver::class.java).apply {
                    action = "com.aboakbar.modf.ACTION_TRIGGER_OUTREACH"
                }
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
                val pendingIntent = PendingIntent.getBroadcast(context, 9991, intent, flags)
                val triggerTime = System.currentTimeMillis() + (minutes * 60 * 1000L)
                alarmManager?.set(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            } catch (ex: Exception) {
                ex.printStackTrace()
            }
        }
    }

    fun cancelSchedule(context: Context) {
        try {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, OutreachAlarmReceiver::class.java).apply {
                action = "com.aboakbar.modf.ACTION_TRIGGER_OUTREACH"
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(context, 9991, intent, flags)
            alarmManager.cancel(pendingIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * فحص وجلب الزبون التالي غير المراسل من السيرفر وإظهار النافذة العائمة
     */
    fun fetchAndTriggerOutreachAlert(context: Context, isManual: Boolean = false) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val se = prefs.getString("se", "") ?: ""
        val exp = prefs.getString("exp", "") ?: ""
        val sig = prefs.getString("sig", "") ?: ""
        val staffId = prefs.getString("staff_id", "") ?: ""
        val savedPortalUrl = prefs.getString("admin_token", "") ?: ""

        if (se.isEmpty() && exp.isEmpty() && sig.isEmpty() && savedPortalUrl.isEmpty() && staffId.isEmpty()) {
            if (isManual) {
                Toast.makeText(context, "يرجى تسجيل الدخول إلى بوابتك في التطبيق أولاً", Toast.LENGTH_SHORT).show()
            }
            return
        }

        val requestBuilder = Request.Builder()
            .url("$BACKEND_URL/api/employee/outreach-queue")
            .get()

        if (se.isNotEmpty()) requestBuilder.header("x-employee-se", se)
        if (exp.isNotEmpty()) requestBuilder.header("x-employee-exp", exp)
        if (sig.isNotEmpty()) requestBuilder.header("x-employee-sig", sig)
        if (staffId.isNotEmpty()) requestBuilder.header("x-employee-staff-id", staffId)
        if (savedPortalUrl.isNotEmpty()) requestBuilder.header("Authorization", "Bearer $savedPortalUrl")

        val request = requestBuilder.build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                if (isManual) {
                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                        Toast.makeText(context, "فشل الاتصال بالسيرفر", Toast.LENGTH_SHORT).show()
                    }
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    try {
                        val json = JSONObject(body)
                        if (json.optBoolean("success", false)) {
                            val totalPending = json.optInt("totalPendingCount", 0)
                            val queueArray = json.optJSONArray("queue")
                            val locallySentSet = prefs.getStringSet("locally_outreach_sent_ids", setOf()) ?: setOf()

                            var targetItem: JSONObject? = null

                            if (queueArray != null && queueArray.length() > 0) {
                                for (i in 0 until queueArray.length()) {
                                    val item = queueArray.getJSONObject(i)
                                    val id = item.getString("id")
                                    if (!locallySentSet.contains(id)) {
                                        targetItem = item
                                        break
                                    }
                                }
                            }

                            if (targetItem == null && json.has("nextItem") && !json.isNull("nextItem")) {
                                val item = json.getJSONObject("nextItem")
                                if (!locallySentSet.contains(item.getString("id"))) {
                                    targetItem = item
                                }
                            }

                            if (targetItem != null) {
                                val itemId = targetItem.getString("id")
                                val phone = targetItem.optString("phone", "")
                                val originalInput = targetItem.optString("originalInput", "")
                                val generatedMessage = targetItem.optString("generatedMessage", "")

                                val alertIntent = Intent(context, OutreachAlertActivity::class.java).apply {
                                    putExtra("itemId", itemId)
                                    putExtra("phone", phone)
                                    putExtra("originalInput", originalInput)
                                    putExtra("generatedMessage", generatedMessage)
                                    putExtra("remainingCount", totalPending)
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                                }

                                // 1. فتح النافذة مباشرة
                                try {
                                    context.startActivity(alertIntent)
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }

                                // 2. إصدار إشعار عالي الأولوية
                                showOutreachNotification(context, itemId, phone, originalInput, generatedMessage, totalPending, alertIntent)
                            } else {
                                if (isManual) {
                                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                                        Toast.makeText(context, "تمت مراسلة جميع الأرقام في قائمة التواصل بنجاح! لا توجد أرقام معلقة.", Toast.LENGTH_LONG).show()
                                    }
                                }
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                } else {
                    if (isManual) {
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            Toast.makeText(context, "خطأ من السيرفر: ${response.code}", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
        })
    }

    private fun showOutreachNotification(
        context: Context,
        itemId: String,
        phone: String,
        originalInput: String,
        generatedMessage: String,
        remainingCount: Int,
        alertIntent: Intent
    ) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager ?: return
            val channelId = "outreach_scheduler_channel"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = android.app.NotificationChannel(
                    channelId,
                    "تذكيرات مراسلة وتخزين أرقام الزبائن",
                    android.app.NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "إشعارات تذكير الموظف بإرسال رسائل التواصل وتخزين الأرقام للزبائن"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 300, 200, 300)
                    lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                }
                notificationManager.createNotificationChannel(channel)
            }

            val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            val pendingIntent = PendingIntent.getActivity(context, 9993, alertIntent, pendingFlags)

            val displayName = if (originalInput.isNotEmpty() && originalInput != phone) "$originalInput ($phone)" else phone

            val builder = androidx.core.app.NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("💬 حان موعد مراسلة الزبون")
                .setContentText("الرقم: $displayName — اضغط للإرسال بالواتساب")
                .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
                .setCategory(androidx.core.app.NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(pendingIntent, true)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setVibrate(longArrayOf(0, 300, 200, 300))
                .addAction(
                    android.R.drawable.ic_menu_send,
                    "💬 إرسال الرسالة الآن",
                    pendingIntent
                )

            notificationManager.notify(9994, builder.build())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
