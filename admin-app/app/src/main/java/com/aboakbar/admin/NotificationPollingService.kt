package com.aboakbar.admin

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import okhttp3.*
import org.json.JSONObject
import java.io.IOException

class NotificationPollingService : Service() {

    private val client = OkHttpClient()
    private val handler = Handler(Looper.getMainLooper())
    private var runnable: Runnable? = null

    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token"
    private val BACKEND_URL = "https://aboakbar.vercel.app"
    private val CHANNEL_ID = "aboakbar_admin_service_channel"
    private val NOTIFICATION_CHANNEL_ID = "aboakbar_admin_notifications"

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        startForegroundService()
        startPolling()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }

    private fun startForegroundService() {
        val intent = Intent(this, MainActivity::class.java)
        val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingFlags)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("نظام التوصيل")
            .setContentText("مراقبة الطلبات الجديدة نشطة في الخلفية")
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        startForeground(1, notification)
    }

    private fun startPolling() {
        runnable = object : Runnable {
            override fun run() {
                pollPendingOrders()
                handler.postDelayed(this, 10000) // فحص كل 10 ثوانٍ
            }
        }
        handler.post(runnable!!)
    }

    private fun pollPendingOrders() {
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = sharedPreferences.getString(KEY_TOKEN, null) ?: return
        var lastSeenOrderNumber = sharedPreferences.getInt("last_seen_order_number", 0)

        val request = Request.Builder()
            .url("$BACKEND_URL/api/notifications/admin-pending")
            .addHeader("Cookie", "admin_token=$token")
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                // تجاهل أخطاء الشبكة المؤقتة
            }

            override fun onResponse(call: Call, response: Response) {
                if (!response.isSuccessful) return
                val responseBody = response.body?.string() ?: return
                try {
                    val json = JSONObject(responseBody)
                    val pendingCount = json.optInt("pendingCount", 0)
                    val latestOrderNumber = json.optInt("latestOrderNumber", 0)
                    val details = json.optJSONObject("latestOrderDetails")

                    val shopName = details?.optString("shopName", "—") ?: "—"
                    val regionName = details?.optString("regionName", "—") ?: "—"
                    val orderTime = details?.optString("orderTime", "فوري") ?: "فوري"
                    val orderType = details?.optString("orderType", "—") ?: "—"
                    val subtotal = details?.optInt("subtotal", 0) ?: 0

                    if (latestOrderNumber > 0 && lastSeenOrderNumber > 0 && latestOrderNumber > lastSeenOrderNumber) {
                        lastSeenOrderNumber = latestOrderNumber
                        sharedPreferences.edit().putInt("last_seen_order_number", lastSeenOrderNumber).apply()

                        // إطلاق الإشعار المنبثق
                        showNativeNotification(latestOrderNumber, pendingCount, shopName, regionName, orderTime, orderType, subtotal)

                        // تشغيل الشاشة المنبثقة الإجبارية
                        triggerPopupActivity(shopName, regionName, orderTime, orderType, subtotal, pendingCount, latestOrderNumber)
                    } else if (latestOrderNumber > 0 && lastSeenOrderNumber == 0) {
                        lastSeenOrderNumber = latestOrderNumber
                        sharedPreferences.edit().putInt("last_seen_order_number", lastSeenOrderNumber).apply()
                    }
                } catch (e: Exception) {
                    // تجاهل
                }
            }
        })
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

    private fun showNativeNotification(
        orderNumber: Int,
        count: Int,
        shopName: String,
        regionName: String,
        orderTime: String,
        orderType: String,
        subtotal: Int
    ) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // توجيه المستخدم لصفحة الطلبات المعلقة مباشرة عند الضغط على الإشعار
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("target_url", "https://aboakbar.vercel.app/abo1stor3hlaa2kbr8-47/orders/pending")
        }

        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }

        val pendingIntent = PendingIntent.getActivity(this, 0, intent, flags)

        val title = "$shopName — $regionName"
        val body = "⏰ $orderTime | 📦 $orderType | 💵 ${formatNumber(subtotal)} د.ع"

        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(orderNumber, notification)
    }

    private fun formatNumber(num: Int): String {
        return try {
            String.format("%,d", num)
        } catch (e: Exception) {
            num.toString()
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // قناة الخدمة الدائمة
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "مراقبة الخلفية",
                NotificationManager.IMPORTANCE_LOW
            )
            manager.createNotificationChannel(serviceChannel)

            // قناة تنبيه الطلبات
            val notifChannel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "إشعارات الطلبات",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                enableLights(true)
                enableVibration(true)
            }
            manager.createNotificationChannel(notifChannel)
        }
    }

    override fun onDestroy() {
        runnable?.let { handler.removeCallbacks(it) }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
