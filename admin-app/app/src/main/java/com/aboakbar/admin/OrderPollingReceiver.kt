package com.aboakbar.admin

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import okhttp3.*
import org.json.JSONObject
import java.io.IOException

class OrderPollingReceiver : BroadcastReceiver() {

    private val client = OkHttpClient()

    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token"
    private val BACKEND_URL = "https://aboakbar.vercel.app"
    private val CHANNEL_ID = "aboakbar_admin_notifications"

    override fun onReceive(context: Context, intent: Intent) {
        val pendingResult = goAsync()

        // التحقق من حدث إقلاع الهاتف
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            val sharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val token = sharedPreferences.getString(KEY_TOKEN, null)
            if (!token.isNullOrEmpty()) {
                scheduleNextAlarm(context)
            }
            pendingResult.finish()
            return
        }

        val sharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = sharedPreferences.getString(KEY_TOKEN, null)

        if (token.isNullOrEmpty()) {
            // لا يوجد رمز مصادقة نشط، نتوقف عن التكرار
            pendingResult.finish()
            return
        }

        val request = Request.Builder()
            .url("$BACKEND_URL/api/notifications/admin-pending?token=$token")
            .addHeader("Cookie", "admin_token=$token")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                // فشل مؤقت للشبكة، نجدول التنبيه القادم على أي حال
                scheduleNextAlarm(context)
                pendingResult.finish()
            }

            override fun onResponse(call: Call, response: Response) {
                try {
                    if (response.isSuccessful) {
                        val responseBody = response.body?.string()
                        if (responseBody != null) {
                            val json = JSONObject(responseBody)
                            val pendingCount = json.optInt("pendingCount", 0)
                            val latestOrderNumber = json.optInt("latestOrderNumber", 0)
                            val details = json.optJSONObject("latestOrderDetails")

                            val shopName = details?.optString("shopName", "—") ?: "—"
                            val regionName = details?.optString("regionName", "—") ?: "—"
                            val orderTime = details?.optString("orderTime", "فوري") ?: "فوري"
                            val orderType = details?.optString("orderType", "—") ?: "—"
                            val subtotal = details?.optInt("subtotal", 0) ?: 0

                            var lastSeenOrderNumber = sharedPreferences.getInt("last_seen_order_number", 0)

                            if (latestOrderNumber > 0 && lastSeenOrderNumber > 0 && latestOrderNumber > lastSeenOrderNumber) {
                                // تحديث رقم آخر طلب معروض
                                sharedPreferences.edit().putInt("last_seen_order_number", latestOrderNumber).apply()

                                // تهيئة قناة الإشعارات
                                createNotificationChannel(context)

                                // عرض إشعار النظام
                                showNotification(context, latestOrderNumber, pendingCount, shopName, regionName, orderTime, orderType, subtotal)

                                // تشغيل النافذة المنبثقة الإجبارية
                                triggerPopupActivity(context, shopName, regionName, orderTime, orderType, subtotal, pendingCount, latestOrderNumber)
                            } else if (latestOrderNumber > 0 && lastSeenOrderNumber == 0) {
                                sharedPreferences.edit().putInt("last_seen_order_number", latestOrderNumber).apply()
                            }
                        }
                    }
                } catch (e: Exception) {
                    // تجاهل
                } finally {
                    scheduleNextAlarm(context)
                    pendingResult.finish()
                }
            }
        })
    }

    private fun scheduleNextAlarm(context: Context) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, OrderPollingReceiver::class.java)

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        } else {
            PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT)
        }

        // جدولة الفحص القادم بعد 15 ثانية بدقة متناهية
        val triggerTime = SystemClock.elapsedRealtime() + 15000

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, flags)
            } else {
                alarmManager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, flags)
            }
        } catch (e: SecurityException) {
            // fallback to non-exact alarm if permission is missing on Android 12+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, flags)
            } else {
                alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, flags)
            }
        }
    }

    companion object {
        fun startAlarm(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, OrderPollingReceiver::class.java)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            } else {
                PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT)
            }
            val triggerTime = SystemClock.elapsedRealtime() + 1000
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, flags)
                } else {
                    alarmManager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, flags)
                }
            } catch (e: SecurityException) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, flags)
                } else {
                    alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerTime, flags)
                }
            }
        }
    }

    private fun triggerPopupActivity(
        context: Context,
        shopName: String,
        regionName: String,
        orderTime: String,
        orderType: String,
        subtotal: Int,
        pendingCount: Int,
        latestOrderNumber: Int
    ) {
        try {
            val alertIntent = Intent(context, OrderAlertActivity::class.java).apply {
                putExtra("shopName", shopName)
                putExtra("regionName", regionName)
                putExtra("orderTime", orderTime)
                putExtra("orderType", orderType)
                putExtra("subtotal", subtotal)
                putExtra("pendingCount", pendingCount)
                putExtra("orderNumber", latestOrderNumber)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            }
            context.startActivity(alertIntent)
        } catch (e: Exception) {
            // تجاهل
        }
    }

    private fun showNotification(
        context: Context,
        orderNumber: Int,
        count: Int,
        shopName: String,
        regionName: String,
        orderTime: String,
        orderType: String,
        subtotal: Int
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("target_url", "https://aboakbar.vercel.app/abo1stor3hlaa2kbr8-47/orders/pending")
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(context, 0, intent, flags)

        val title = "$shopName — $regionName"
        val body = "⏰ $orderTime | 📦 $orderType | 💵 ${formatNumber(subtotal)} د.ع"

        val notification = androidx.core.app.NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(androidx.core.app.NotificationCompat.PRIORITY_HIGH)
            .setDefaults(androidx.core.app.NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(orderNumber, notification)
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "إشعارات الطلبات"
            val descriptionText = "تنبيهات عند وصول طلبات جديدة للنظام"
            val importance = NotificationManager.IMPORTANCE_HIGH
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
                enableLights(true)
                enableVibration(true)
            }
            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun formatNumber(num: Int): String {
        return try {
            String.format("%,d", num)
        } catch (e: Exception) {
            num.toString()
        }
    }
}
