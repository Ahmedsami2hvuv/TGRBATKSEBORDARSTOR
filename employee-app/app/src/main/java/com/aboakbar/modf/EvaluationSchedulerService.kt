package com.aboakbar.modf

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.widget.Toast
import okhttp3.*
import org.json.JSONObject
import java.io.IOException

object EvaluationSchedulerService {

    private const val PREFS_NAME = "AboAkbarPrefs"
    private const val KEY_EVALUATION_ENABLED = "evaluation_scheduler_enabled"
    private const val KEY_INTERVAL_MINUTES = "evaluation_interval_minutes"
    private const val KEY_LAST_SENT_TIME = "evaluation_last_sent_time"
    private const val BACKEND_URL = "https://aboakbr.com"
    private val client = OkHttpClient()

    private const val KEY_EVALUATION_NEXT_TRIGGER = "evaluation_next_trigger_time"

    fun isEnabled(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(KEY_EVALUATION_ENABLED, true) // مفعل افتراضياً
    }

    fun setEnabled(context: Context, enabled: Boolean) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putBoolean(KEY_EVALUATION_ENABLED, enabled).apply()
        if (enabled) {
            scheduleNextEvaluation(context, getIntervalMinutes(context))
        } else {
            cancelSchedule(context)
        }
    }

    fun getIntervalMinutes(context: Context): Int {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getInt(KEY_INTERVAL_MINUTES, 60) // افتراضياً كل 60 دقيقة (ساعة)
    }

    fun setIntervalMinutes(context: Context, minutes: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putInt(KEY_INTERVAL_MINUTES, minutes).apply()
        if (isEnabled(context)) {
            scheduleNextEvaluation(context, minutes)
        }
    }

    fun getNextTriggerTime(context: Context): Long {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getLong(KEY_EVALUATION_NEXT_TRIGGER, 0L)
    }

    fun scheduleNextEvaluation(context: Context, minutes: Int) {
        try {
            val triggerTime = System.currentTimeMillis() + (minutes * 60 * 1000L)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().putLong(KEY_EVALUATION_NEXT_TRIGGER, triggerTime).apply()

            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
            val intent = Intent(context, EvaluationAlarmReceiver::class.java).apply {
                action = "com.aboakbar.modf.ACTION_TRIGGER_EVALUATION"
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(context, 8888, intent, flags)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
            try {
                val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
                val intent = Intent(context, EvaluationAlarmReceiver::class.java).apply {
                    action = "com.aboakbar.modf.ACTION_TRIGGER_EVALUATION"
                }
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
                val pendingIntent = PendingIntent.getBroadcast(context, 8888, intent, flags)
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
            val intent = Intent(context, EvaluationAlarmReceiver::class.java).apply {
                action = "com.aboakbar.modf.ACTION_TRIGGER_EVALUATION"
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(context, 8888, intent, flags)
            alarmManager.cancel(pendingIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * فحص وجلب الطلب التالي غير المقيم من السيرفر وإظهار النافذة العائمة
     */
    fun fetchAndTriggerEvaluationAlert(context: Context, isManual: Boolean = false) {
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
            .url("$BACKEND_URL/api/employee/evaluation-queue")
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
                        if (json.getBoolean("success")) {
                            val totalPending = json.optInt("totalPendingCount", 0)
                            val queueArray = json.optJSONArray("queue")
                            val locallyRatedSet = prefs.getStringSet("locally_rated_order_ids", setOf()) ?: setOf()

                            var targetItem: JSONObject? = null

                            if (queueArray != null && queueArray.length() > 0) {
                                for (i in 0 until queueArray.length()) {
                                    val item = queueArray.getJSONObject(i)
                                    val id = item.getString("id")
                                    if (!locallyRatedSet.contains(id)) {
                                        targetItem = item
                                        break
                                    }
                                }
                            }

                            if (targetItem == null && json.has("nextItem") && !json.isNull("nextItem")) {
                                val item = json.getJSONObject("nextItem")
                                if (!locallyRatedSet.contains(item.getString("id"))) {
                                    targetItem = item
                                }
                            }

                            if (targetItem != null) {
                                val orderId = targetItem.getString("id")
                                val orderNumber = targetItem.getInt("orderNumber")
                                val shopName = targetItem.optString("shopName", "—")
                                val regionName = targetItem.optString("regionName", "—")
                                val customerPhone = targetItem.optString("customerPhone", "")
                                val generatedMessage = targetItem.optString("generatedMessage", "")

                                val alertIntent = Intent(context, EvaluationAlertActivity::class.java).apply {
                                    putExtra("orderId", orderId)
                                    putExtra("orderNumber", orderNumber)
                                    putExtra("shopName", shopName)
                                    putExtra("regionName", regionName)
                                    putExtra("customerPhone", customerPhone)
                                    putExtra("generatedMessage", generatedMessage)
                                    putExtra("remainingCount", totalPending)
                                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                                }

                                // 1. محاولة فتح النافذة المنبثقة مباشرة فوق الشاشة
                                try {
                                    context.startActivity(alertIntent)
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }

                                // 2. إصدار إشعار عالي الأولوية (Heads-Up Banner) لضمان ظهور التنبيه حتى لو كان التطبيق بالخلفية
                                showEvaluationNotification(context, orderId, orderNumber, shopName, regionName, customerPhone, generatedMessage, totalPending, alertIntent)
                            } else {
                                if (isManual) {
                                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                                        Toast.makeText(context, "تم إرسال طلب التقييم لجميع الطلبات المؤرشفة بنجاح! لا توجد طلبات معلقة.", Toast.LENGTH_LONG).show()
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

    private fun showEvaluationNotification(
        context: Context,
        orderId: String,
        orderNumber: Int,
        shopName: String,
        regionName: String,
        customerPhone: String,
        generatedMessage: String,
        remainingCount: Int,
        alertIntent: Intent
    ) {
        try {
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? android.app.NotificationManager ?: return
            val channelId = "evaluation_scheduler_channel"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = android.app.NotificationChannel(
                    channelId,
                    "تذكيرات تقييم الطلبات",
                    android.app.NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "إشعارات تذكير الموظف بإرسال طلبات التقييم المجدولة للزبائن"
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

            val pendingIntent = PendingIntent.getActivity(context, 7777, alertIntent, pendingFlags)

            val builder = androidx.core.app.NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("⭐ حان موعد تقييم طلب #$orderNumber")
                .setContentText("محل: $shopName | $regionName — اضغط للإرسال بالواتساب")
                .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
                .setCategory(androidx.core.app.NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(pendingIntent, true)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setVibrate(longArrayOf(0, 300, 200, 300))
                .addAction(
                    android.R.drawable.ic_menu_send,
                    "💬 إرسال التقييم الآن",
                    pendingIntent
                )

            notificationManager.notify(7777, builder.build())
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
