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

            // التحقق من طلب الموقع الجغرافي (سحب الموقع)
            if (type == "request_location") {
                try {
                    LocationHelper.fetchAndSendLocation(context)
                    event.preventDefault()
                } catch (e: Exception) {
                    // تجاهل
                }
                return
            }
            
            // التحقق من التنبيه القوي (الاستدعاء العاجل)
            if (type == "strong_alert") {
                // منع إشعار OneSignal التلقائي فوراً
                event.preventDefault()
                
                try {
                    val action = additionalData.optString("action", "stop")
                    val alertId = additionalData.optString("alertId", "")
                    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                    val strongAlertNotificationId = 9999
                    
                    if (action == "start") {
                        val prefs = context.getSharedPreferences("AboAkbarPrefs", Context.MODE_PRIVATE)
                        val lastAlertId = prefs.getString("last_strong_alert_id", "")
                        
                        // منع التكرار بناءً على المعرف الفريد للتنبيه
                        if (alertId.isNotEmpty() && alertId == lastAlertId) {
                            return
                        }
                        
                        if (alertId.isNotEmpty()) {
                            prefs.edit().putString("last_strong_alert_id", alertId).apply()
                        }
                        
                        // استخراج المتغيرات المخصصة من ون سجنل
                        val customTitle = additionalData.optString("customTitle", "")
                        val customBody = additionalData.optString("customBody", "")
                        val showWhatsapp = additionalData.optString("showWhatsapp", "false")
                        val showOpenApp = additionalData.optString("showOpenApp", "false")
                        val showDismiss = additionalData.optString("showDismiss", "true")
                        val theme = additionalData.optString("theme", "red")

                        // 1. بناء نية التنبيه وتمرير البيانات المخصصة
                        val alertIntent = Intent(context, StrongAlertActivity::class.java).apply {
                            putExtra("alertId", alertId)
                            putExtra("role", "employee")
                            putExtra("customTitle", customTitle)
                            putExtra("customBody", customBody)
                            putExtra("showWhatsapp", showWhatsapp)
                            putExtra("showOpenApp", showOpenApp)
                            putExtra("showDismiss", showDismiss)
                            putExtra("theme", theme)
                            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                        }
                        
                        // 2. محاولة تشغيل الشاشة مباشرة (في حال كان التطبيق في المقدمة أو مسموحاً له)
                        try {
                            context.startActivity(alertIntent)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                        
                        // 3. بناء وإرسال إشعار نظام ذو أولوية قصوى (fullScreenIntent) لفتح الشاشة حتى لو كان الهاتف مغلقاً
                        val channelId = "aboakbar_strong_alert_channel"
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            val channelName = "التنبيهات العاجلة"
                            val channel = android.app.NotificationChannel(
                                channelId,
                                channelName,
                                android.app.NotificationManager.IMPORTANCE_HIGH
                            ).apply {
                                description = "قناة الاستدعاءات العاجلة"
                                enableLights(true)
                                enableVibration(true)
                                vibrationPattern = longArrayOf(0, 1000, 250, 1000, 250)
                                setSound(null, null) // نتحكم بالصوت يدوياً في Activity
                            }
                            notificationManager.createNotificationChannel(channel)
                        }
                        
                        val alertFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
                        } else {
                            android.app.PendingIntent.FLAG_UPDATE_CURRENT
                        }
                        val alertPendingIntent = android.app.PendingIntent.getActivity(context, strongAlertNotificationId, alertIntent, alertFlags)
                        
                        val builder = NotificationCompat.Builder(context, channelId)
                            .setSmallIcon(R.drawable.ic_stat_onesignal_default)
                            .setContentTitle(customTitle)
                            .setContentText(customBody)
                            .setPriority(NotificationCompat.PRIORITY_MAX)
                            .setCategory(NotificationCompat.CATEGORY_CALL)
                            .setAutoCancel(false)
                            .setOngoing(true) // لا يمكن للمستخدم إزالته بالسحب
                            .setFullScreenIntent(alertPendingIntent, true)
                        
                        notificationManager.notify(strongAlertNotificationId, builder.build())
                        
                    } else if (action == "stop") {
                        // إيقاف التنبيه
                        val stopIntent = Intent("com.aboakbar.modf.ACTION_STOP_STRONG_ALERT")
                        context.sendBroadcast(stopIntent)
                        
                        // إلغاء إشعار النظام
                        try {
                            notificationManager.cancel(strongAlertNotificationId)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                return
            }
            
            if (type == "new_order") {
                // منع إشعار OneSignal التلقائي فوراً لتجنب التكرار
                event.preventDefault()
                try {
                    val orderNumber = additionalData.optInt("orderNumber", 0)
                    if (orderNumber > 0) {
                        val prefs = context.getSharedPreferences("AboAkbarPrefs", Context.MODE_PRIVATE)
                        val dismissedSet = prefs.getStringSet("dismissed_order_numbers", null)
                        if (dismissedSet != null && dismissedSet.contains(orderNumber.toString())) {
                            return
                        }
                    }
                    
                    // تحديث رقم الطلب الأخير المشاهد في الإعدادات المشتركة لمنع تكراره من الخدمة الخلفية
                    val prefs = context.getSharedPreferences("AboAkbarPrefs", Context.MODE_PRIVATE)
                    prefs.edit().putInt("last_seen_order_number", orderNumber).apply()
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
                        putExtra("target_url", "https://aboakbr.com/abo1stor3hlaa2kbr8-47/orders/pending")
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
