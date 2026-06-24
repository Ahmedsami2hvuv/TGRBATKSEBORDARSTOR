package com.aboakbar.mjhz

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import okhttp3.*
import org.json.JSONObject
import java.io.IOException

class OrderForegroundService : Service() {

    private val client = OkHttpClient()
    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token"
    private val BACKEND_URL = "https://aboakbr.com"
    
    private val NOTIFICATION_CHANNEL_ID = "aboakbar_foreground_service"
    private val ORDER_NOTIFICATION_CHANNEL_ID = "aboakbar_admin_notifications"
    private val FOREGROUND_NOTIFICATION_ID = 9999

    private var wakeLock: PowerManager.WakeLock? = null
    private var serviceThread: android.os.HandlerThread? = null
    private var serviceHandler: Handler? = null
    private var isRunning = false



    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        
        // إعداد خيط خلفي مخصص لتشغيل فترات الفحص بانتظام ودون تأثر بالخلفية
        serviceThread = android.os.HandlerThread("OrderServiceThread", android.os.Process.THREAD_PRIORITY_BACKGROUND).apply {
            start()
        }
        serviceHandler = Handler(serviceThread!!.looper)

        // إبقاء المعالج مستيقظاً لضمان عدم تجميد الاتصال بالشبكة
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AboAkbar::OrderServiceWakeLock").apply {
            acquire() // إبقاء القفل مفعلاً بشكل دائم بدون مهلة
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (!isRunning) {
            isRunning = true
            
            // إطلاق الخدمة في الواجهة الأمامية مع إشعار مستمر
            val notification = createForegroundNotification()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    FOREGROUND_NOTIFICATION_ID, 
                    notification, 
                    android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                startForeground(FOREGROUND_NOTIFICATION_ID, notification)
            }
        }

        // تشغيل الفحص الفوري على الخيط الخلفي
        serviceHandler?.post {
            checkPendingOrders()
        }

        // جدولة المنبه الدقيق التالي بعد 30 ثانية لتجاوز Doze Mode
        scheduleNextAlarm()

        return START_STICKY
    }

    private fun checkPendingOrders() {
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = sharedPreferences.getString(KEY_TOKEN, null)

        if (token.isNullOrEmpty()) {
            stopSelf()
            return
        }

        val request = Request.Builder()
            .url("$BACKEND_URL/api/notifications/admin-pending?token=$token")
            .addHeader("Cookie", "admin_token=$token")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                // فشل شبكة مؤقت، سنحاول مجدداً في الدورة القادمة
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
                                 val dismissedSet = sharedPreferences.getStringSet("dismissed_order_numbers", null)
                                 val isDismissed = dismissedSet != null && dismissedSet.contains(latestOrderNumber.toString())

                                 if (!isDismissed) {
                                     // تحديث آخر رقم طلب تم مشاهدته
                                     sharedPreferences.edit().putInt("last_seen_order_number", latestOrderNumber).apply()

                                     // عرض الإشعار بالنظام
                                     showNotification(latestOrderNumber, pendingCount, shopName, regionName, orderTime, orderType, subtotal)

                                     // تشغيل النافذة المنبثقة الإجبارية
                                     triggerPopupActivity(shopName, regionName, orderTime, orderType, subtotal, pendingCount, latestOrderNumber)
                                 }
                             } else if (latestOrderNumber > 0 && lastSeenOrderNumber == 0) {
                                sharedPreferences.edit().putInt("last_seen_order_number", latestOrderNumber).apply()
                            }
                        }
                    }
                } catch (e: Exception) {
                    // تجاهل
                }
            }
        })
    }

    private fun showNotification(
        orderNumber: Int,
        count: Int,
        shopName: String,
        regionName: String,
        orderTime: String,
        orderType: String,
        subtotal: Int
    ) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("target_url", "https://aboakbr.com/abo1stor3hlaa2kbr8-47/orders/pending")
        }

        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingIntentFlags)

        // نية تشغيل الشاشة المنبثقة الإجبارية
        val alertIntent = Intent(this, OrderAlertActivity::class.java).apply {
            putExtra("shopName", shopName)
            putExtra("regionName", regionName)
            putExtra("orderTime", orderTime)
            putExtra("orderType", orderType)
            putExtra("subtotal", subtotal)
            putExtra("pendingCount", count)
            putExtra("orderNumber", orderNumber)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val alertFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val alertPendingIntent = PendingIntent.getActivity(this, orderNumber, alertIntent, alertFlags)

        val title = "$shopName — $regionName"
        val body = "⏰ $orderTime | 📦 $orderType | 💵 ${formatNumber(subtotal)} د.ع"

        val notification = NotificationCompat.Builder(this, ORDER_NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setFullScreenIntent(alertPendingIntent, true)
            .build()

        notificationManager.notify(orderNumber, notification)
    }

    private fun triggerPopupActivity(
        shopName: String,
        regionName: String,
        orderTime: String,
        orderType: String,
        subtotal: Int,
        pendingCount: Int,
        latestOrderNumber: Int
    ) {
        try {
            val alertIntent = Intent(this, OrderAlertActivity::class.java).apply {
                putExtra("shopName", shopName)
                putExtra("regionName", regionName)
                putExtra("orderTime", orderTime)
                putExtra("orderType", orderType)
                putExtra("subtotal", subtotal)
                putExtra("pendingCount", pendingCount)
                putExtra("orderNumber", latestOrderNumber)
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            }
            startActivity(alertIntent)
        } catch (e: Exception) {
            // تجاهل
        }
    }



    private fun createForegroundNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, flags)

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("مراقبة الطلبات نشطة")
            .setContentText("يتم فحص الطلبات الجديدة تلقائياً بالخلفية كل 15 ثانية...")
            .setSmallIcon(android.R.drawable.ic_popup_sync)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            
            // 1. قناة الخدمة الأمامية المستمرة
            val fgChannel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "خدمة فحص الطلبات بالخلفية",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "قناة الخدمة الأمامية المستمرة لمراقبة الطلبات"
            }
            notificationManager.createNotificationChannel(fgChannel)

            // 2. قناة إشعارات الطلبات الجديدة
            val orderChannel = NotificationChannel(
                ORDER_NOTIFICATION_CHANNEL_ID,
                "إشعارات الطلبات",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "تنبيهات عند وصول طلبات جديدة للنظام"
                enableLights(true)
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(orderChannel)
        }
    }

    private fun formatNumber(num: Int): String {
        return try {
            String.format("%,d", num)
        } catch (e: Exception) {
            num.toString()
        }
    }

    private fun scheduleNextAlarm() {
        val alarmManager = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
        val intent = Intent(this, OrderPollingReceiver::class.java).apply {
            action = "com.aboakbar.mjhz.ACTION_CHECK_ORDERS"
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getBroadcast(this, 0, intent, flags)

        val triggerTime = System.currentTimeMillis() + 30000 // بعد 30 ثانية
        
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val alarmClockInfo = android.app.AlarmManager.AlarmClockInfo(triggerTime, pendingIntent)
                alarmManager.setAlarmClock(alarmClockInfo, pendingIntent)
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                } else {
                    alarmManager.setExact(android.app.AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
                }
            }
        } catch (e: Exception) {
            // تراجع تلقائي للأجهزة التي لا تسمح بالمنبه الدقيق
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            } else {
                alarmManager.set(android.app.AlarmManager.RTC_WAKEUP, triggerTime, pendingIntent)
            }
        }
    }

    private fun cancelAlarm() {
        try {
            val alarmManager = getSystemService(Context.ALARM_SERVICE) as android.app.AlarmManager
            val intent = Intent(this, OrderPollingReceiver::class.java).apply {
                action = "com.aboakbar.mjhz.ACTION_CHECK_ORDERS"
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(this, 0, intent, flags)
            alarmManager.cancel(pendingIntent)
        } catch (e: Exception) {
            // تجاهل
        }
    }

    override fun onDestroy() {
        isRunning = false
        serviceThread?.quitSafely()
        cancelAlarm() // إلغاء المنبه لتفادي استمرار الاستيقاظ
        try {
            if (wakeLock?.isHeld == true) {
                wakeLock?.release()
            }
        } catch (e: Exception) {
            // تجاهل
        }
        super.onDestroy()
    }
}
