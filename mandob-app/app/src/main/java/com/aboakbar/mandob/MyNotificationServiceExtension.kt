package com.aboakbar.mandob

import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.annotation.Keep
import androidx.core.app.NotificationCompat
import com.onesignal.notifications.INotificationReceivedEvent
import com.onesignal.notifications.INotificationServiceExtension

@Keep
class MyNotificationServiceExtension : INotificationServiceExtension {
    override fun onNotificationReceived(event: INotificationReceivedEvent) {
        val context = event.context
        val notification = event.notification
        val additionalData = notification.additionalData

        // التحقق من التنبيه القوي (الاستدعاء العاجل)
        if (additionalData != null && additionalData.has("type") && additionalData.getString("type") == "strong_alert") {
            try {
                val action = additionalData.optString("action", "start")
                if (action == "start") {
                    val alertIntent = Intent(context, StrongAlertActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    context.startActivity(alertIntent)
                } else if (action == "stop") {
                    val stopIntent = Intent("com.aboakbar.mandob.ACTION_STOP_STRONG_ALERT")
                    context.sendBroadcast(stopIntent)
                }
                event.preventDefault()
            } catch (e: Exception) {
                // تجاهل
            }
            return
        }

        // التحقق من أن الإشعار يخص طلب جديد
        if (additionalData != null && additionalData.has("type") && additionalData.getString("type") == "new_order") {
            // منع إشعار OneSignal التلقائي فوراً لتجنب التكرار
            event.preventDefault()
            try {
                val orderNumber = additionalData.optInt("orderNumber", 0)
                
                // تحديث رقم الطلب الأخير المشاهد في الإعدادات المشتركة لمنع تكراره من الخدمة الخلفية
                val prefs = context.getSharedPreferences("AboAkbarPrefs", Context.MODE_PRIVATE)
                prefs.edit().putInt("last_seen_order_number", orderNumber).apply()
                val shopName = additionalData.optString("shopName", "—")
                val regionName = additionalData.optString("regionName", "—")
                val orderTime = additionalData.optString("orderTime", "فوري")
                val orderType = additionalData.optString("orderType", "توصيل")
                val subtotal = additionalData.optDouble("subtotal", 0.0)

                // 1. بناء وعرض إشعار نظام يدوي فوراً في البردة ذو أولوية قصوى لضمان ظهوره في الخلفية
                val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                val channelId = "aboakbar_admin_notifications"

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val channelName = "تنبيهات الطلبات الجديدة"
                    val channel = android.app.NotificationChannel(
                        channelId,
                        channelName,
                        android.app.NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "إشعارات الطلبات الجديدة"
                        enableLights(true)
                        enableVibration(true)
                        vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)
                    }
                    notificationManager.createNotificationChannel(channel)
                }


                // إعداد نية فتح التطبيق
                val openIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                }
                val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                } else {
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT
                }
                val pendingIntent = android.app.PendingIntent.getActivity(context, 0, openIntent, pendingIntentFlags)

                val alertIntent = Intent(context, OrderAlertActivity::class.java).apply {
                    putExtra("shopName", shopName)
                    putExtra("regionName", regionName)
                    putExtra("orderTime", orderTime)
                    putExtra("orderType", orderType)
                    putExtra("subtotal", subtotal)
                    putExtra("pendingCount", additionalData.optInt("pendingCount", 1))
                    putExtra("orderNumber", orderNumber)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val alertFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
                } else {
                    android.app.PendingIntent.FLAG_UPDATE_CURRENT
                }
                val alertPendingIntent = android.app.PendingIntent.getActivity(context, orderNumber, alertIntent, alertFlags)

                val title = "🔔 طلب جديد: $shopName — $regionName"
                val body = "⏰ $orderTime | 📦 $orderType | 💵 ${formatNumber(subtotal)} د.ع"

                val largeIconBitmap = android.graphics.BitmapFactory.decodeResource(context.resources, R.drawable.ic_notification_large)

                val builder = NotificationCompat.Builder(context, channelId)
                    .setSmallIcon(R.drawable.ic_stat_onesignal_default)
                    .setLargeIcon(largeIconBitmap)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_CALL)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setFullScreenIntent(alertPendingIntent, true)

                // تفعيل الاهتزاز القوي للتنبيه الفوري
                val pattern = longArrayOf(0, 400, 200, 400, 200, 400)
                builder.setVibrate(pattern)

                notificationManager.notify(orderNumber, builder.build())

                // 2. تشغيل الشاشة المنبثقة الإجبارية مباشرة فوق كل التطبيقات
                context.startActivity(alertIntent)

            } catch (e: Exception) {
                // تجاهل الأخطاء
            }
        }
    }

    private fun formatNumber(num: Double): String {
        return try {
            if (num % 1.0 == 0.0) {
                String.format("%,d", num.toLong())
            } else {
                String.format("%,.2f", num)
            }
        } catch (e: Exception) {
            num.toString()
        }
    }
}
