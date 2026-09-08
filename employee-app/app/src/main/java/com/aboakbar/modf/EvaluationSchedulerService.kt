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

    fun scheduleNextEvaluation(context: Context, minutes: Int) {
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

            val triggerTime = SystemClock.elapsedRealtime() + (minutes * 60 * 1000L)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, pendingIntent)
            } else {
                alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, pendingIntent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
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

        if (se.isEmpty() || exp.isEmpty() || sig.isEmpty()) {
            if (isManual) {
                Toast.makeText(context, "يرجى تسجيل الدخول إلى بوابتك في التطبيق أولاً", Toast.LENGTH_SHORT).show()
            }
            return
        }

        val request = Request.Builder()
            .url("$BACKEND_URL/api/employee/evaluation-queue")
            .header("x-employee-se", se)
            .header("x-employee-exp", exp)
            .header("x-employee-sig", sig)
            .get()
            .build()

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
                            val nextItem = json.optJSONObject("nextItem")
                            val totalPending = json.optInt("totalPendingCount", 0)

                            if (nextItem != null) {
                                val orderId = nextItem.getString("id")
                                val orderNumber = nextItem.getInt("orderNumber")
                                val shopName = nextItem.optString("shopName", "")
                                val regionName = nextItem.optString("regionName", "")
                                val customerPhone = nextItem.optString("customerPhone", "")
                                val generatedMessage = nextItem.optString("generatedMessage", "")

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
                                context.startActivity(alertIntent)
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
                }
            }
        })
    }
}
