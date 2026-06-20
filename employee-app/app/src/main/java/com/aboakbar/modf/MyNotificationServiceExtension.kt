package com.aboakbar.modf

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

        if (additionalData != null && additionalData.has("type")) {
            val type = additionalData.getString("type")
            
            // التحقق من التنبيه القوي (الاستدعاء العاجل)
            if (type == "strong_alert") {
                try {
                    val action = additionalData.optString("action", "start")
                    if (action == "start") {
                        val alertIntent = Intent(context, StrongAlertActivity::class.java).apply {
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        }
                        context.startActivity(alertIntent)
                    } else if (action == "stop") {
                        val stopIntent = Intent("com.aboakbar.modf.ACTION_STOP_STRONG_ALERT")
                        context.sendBroadcast(stopIntent)
                    }
                    event.preventDefault()
                } catch (e: Exception) {
                    // تجاهل
                }
                return
            }
            
            // 1. تنبيهات الإدارة بالطلبات الجديدة
            if (type == "new_order") {
                try {
                    val orderNumber = additionalData.optInt("orderNumber", 0)
                    val shopName = additionalData.optString("shopName", "—")
                    val regionName = additionalData.optString("regionName", "—")
                    val orderTime = additionalData.optString("orderTime", "فوري")
                    val orderType = additionalData.optString("orderType", "توصيل")
                    val subtotal = additionalData.optDouble("subtotal", 0.0)

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

                    val openIntent = Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                        putExtra("target_url", "https://aboakbar.vercel.app/abo1stor3hlaa2kbr8-47/orders/pending")
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

                    val largeIcon = android.graphics.BitmapFactory.decodeResource(context.resources, R.drawable.ic_notification_logo)

                    val builder = NotificationCompat.Builder(context, channelId)
                        .setSmallIcon(R.drawable.ic_stat_onesignal_default)
                        .setLargeIcon(largeIcon)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_CALL)
                        .setDefaults(NotificationCompat.DEFAULT_ALL)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent)
                        .setFullScreenIntent(alertPendingIntent, true)

                    val pattern = longArrayOf(0, 400, 200, 400, 200, 400)
                    builder.setVibrate(pattern)

                    notificationManager.notify(orderNumber, builder.build())
                    context.startActivity(alertIntent)

                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
            
            // 2. تنبيهات الموظفين بتحديث حالة الطلب (عائم في الشاشة)
            else if (type == "staff_order_status") {
                try {
                    val orderNumber = additionalData.optInt("orderNumber", 0)
                    val status = additionalData.optString("status", "")
                    val title = additionalData.optString("title", "تحديث حالة الطلب")
                    val body = additionalData.optString("body", "")

                    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                    val channelId = "aboakbar_staff_notifications"

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val channelName = "تنبيهات حالة الطلبات للموظفين"
                        val channel = android.app.NotificationChannel(
                            channelId,
                            channelName,
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        ).apply {
                            description = "إشعارات تحديث حالة الطلبات للموظفين"
                            enableLights(true)
                            enableVibration(true)
                            vibrationPattern = longArrayOf(0, 300, 150, 300)
                        }
                        notificationManager.createNotificationChannel(channel)
                    }

                    // فتح التطبيق على قائمة الطلبات المرفوعة للموظف
                    val openIntent = Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                    }
                    val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                    } else {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val pendingIntent = android.app.PendingIntent.getActivity(context, 0, openIntent, pendingIntentFlags)

                    // إعداد نافذة التنبيه العائمة المخصصة للموظف
                    val alertIntent = Intent(context, OrderAlertActivity::class.java).apply {
                        putExtra("isStaffAlert", true)
                        putExtra("title", title)
                        putExtra("body", body)
                        putExtra("orderNumber", orderNumber)
                        putExtra("status", status)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    val alertFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
                    } else {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val alertPendingIntent = android.app.PendingIntent.getActivity(context, orderNumber + 10000, alertIntent, alertFlags)

                    val largeIcon = android.graphics.BitmapFactory.decodeResource(context.resources, R.drawable.ic_notification_logo)

                    val builder = NotificationCompat.Builder(context, channelId)
                        .setSmallIcon(R.drawable.ic_stat_onesignal_default)
                        .setLargeIcon(largeIcon)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                        .setDefaults(NotificationCompat.DEFAULT_ALL)
                        .setAutoCancel(true)
                        .setContentIntent(pendingIntent)
                        .setFullScreenIntent(alertPendingIntent, true)

                    val pattern = longArrayOf(0, 300, 150, 300)
                    builder.setVibrate(pattern)

                    notificationManager.notify(orderNumber + 10000, builder.build())
                    
                    // تشغيل الشاشة المنبثقة العائمة فوراً
                    context.startActivity(alertIntent)

                } catch (e: Exception) {
                    e.printStackTrace()
                }
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
