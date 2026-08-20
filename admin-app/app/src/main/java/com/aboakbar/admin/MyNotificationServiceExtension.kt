package com.aboakbar.admin

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
            if (type == "new_order") {
                try {
                    val orderNumber = additionalData.optInt("orderNumber", 0)
                    if (orderNumber > 0) {
                        val prefs = context.getSharedPreferences("AboAkbarPrefs", Context.MODE_PRIVATE)
                        val dismissedSet = prefs.getStringSet("dismissed_order_numbers", null)
                        if (dismissedSet != null && dismissedSet.contains(orderNumber.toString())) {
                            event.preventDefault()
                            return
                        }
                    }
                    val shopName = additionalData.optString("shopName", "â€”")
                    val regionName = additionalData.optString("regionName", "â€”")
                    val orderTime = additionalData.optString("orderTime", "ÙÙˆØ±ÙŠ")
                    val orderType = additionalData.optString("orderType", "ØªÙˆØµÙŠÙ„")
                    val subtotal = additionalData.optDouble("subtotal", 0.0)

                    // 1. Ø¨Ù†Ø§Ø¡ ÙˆØ¹Ø±Ø¶ Ø¥Ø´Ø¹Ø§Ø± Ù†Ø¸Ø§Ù… ÙŠØ¯ÙˆÙŠ ÙÙˆØ±Ø§Ù‹ ÙÙŠ Ø§Ù„Ø¨Ø±Ø¯Ø© Ø°Ùˆ Ø£ÙˆÙ„ÙˆÙŠØ© Ù‚ØµÙˆÙ‰ Ù„Ø¶Ù…Ø§Ù† Ø¸Ù‡ÙˆØ±Ù‡ ÙÙŠ Ø§Ù„Ø®Ù„ÙÙŠØ©
                    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                    val channelId = "aboakbar_admin_notifications"

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val channelName = "ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©"
                        val channel = android.app.NotificationChannel(
                            channelId,
                            channelName,
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        ).apply {
                            description = "Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¬Ø¯ÙŠØ¯Ø©"
                            enableLights(true)
                            enableVibration(true)
                            vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)
                        }
                        notificationManager.createNotificationChannel(channel)
                    }

                    // Ø¥Ø¹Ø¯Ø§Ø¯ Ù†ÙŠØ© ÙØªØ­ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø¹Ù„Ù‰ ØµÙØ­Ø© Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù…Ø¹Ù„Ù‚Ø© Ù…Ø¨Ø§Ø´Ø±Ø©
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
                        putExtra("type", "new_order")
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

                    val title = "ðŸ”” Ø·Ù„Ø¨ Ø¬Ø¯ÙŠØ¯: $shopName â€” $regionName"
                    val body = "â° $orderTime | ðŸ“¦ $orderType | ðŸ’µ ${formatNumber(subtotal)} Ø¯.Ø¹"

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

                    // ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø§Ù‡ØªØ²Ø§Ø² Ø§Ù„Ù‚ÙˆÙŠ Ù„Ù„ØªÙ†Ø¨ÙŠÙ‡ Ø§Ù„ÙÙˆØ±ÙŠ
                    val pattern = longArrayOf(0, 400, 200, 400, 200, 400)
                    builder.setVibrate(pattern)

                    notificationManager.notify(orderNumber, builder.build())

                    // 2. ØªØ´ØºÙŠÙ„ Ø§Ù„Ø´Ø§Ø´Ø© Ø§Ù„Ù…Ù†Ø¨Ø«Ù‚Ø© Ø§Ù„Ø¥Ø¬Ø¨Ø§Ø±ÙŠØ© Ù…Ø¨Ø§Ø´Ø±Ø© ÙÙˆÙ‚ ÙƒÙ„ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª
                    context.startActivity(alertIntent)

                } catch (e: Exception) {
                    // ØªØ¬Ø§Ù‡Ù„ Ø§Ù„Ø£Ø®Ø·Ø§Ø¡
                }
            } else if (type == "store_order") {
                try {
                    val shopName = additionalData.optString("shopName", "")
                    val regionName = additionalData.optString("regionName", "")
                    val orderTime = additionalData.optString("orderTime", "")
                    val orderType = additionalData.optString("orderType", "")
                    val subtotal = additionalData.optDouble("subtotal", 0.0)
                    val orderNumber = additionalData.optInt("orderNumber", 0)

                    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                    val channelId = "aboakbar_admin_notifications"

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val channelName = "إشعارات المدير"
                        val channel = android.app.NotificationChannel(
                            channelId,
                            channelName,
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        ).apply {
                            description = "إشعارات الطلبات لمدير النظام"
                            enableLights(true)
                            enableVibration(true)
                            vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)
                        }
                        notificationManager.createNotificationChannel(channel)
                    }

                    val openIntent = Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                        putExtra("target_url", "https://aboakbr.com/abo1stor3hlaa2kbr8-47/orders/pending?tab=preparing")
                    }
                    val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                    } else {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val pendingIntent = android.app.PendingIntent.getActivity(context, orderNumber, openIntent, pendingIntentFlags)

                    val alertIntent = Intent(context, OrderAlertActivity::class.java).apply {
                        putExtra("type", "store_order")
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

                    val title = "🛒 طلب من المتجر: $regionName"
                    val body = "⏰ $orderTime | 📦 عدد المنتجات: " + additionalData.optInt("pendingCount", 1)

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
                }
            } else if (type == "preparer_withdrawal") {
                try {
                    val preparerName = additionalData.optString("preparerName", "â€”")
                    val amount = additionalData.optString("amount", "0")
                    val remain = additionalData.optString("remain", "0")
                    val time = additionalData.optString("time", "â€”")

                    // 1. Ø¨Ù†Ø§Ø¡ ÙˆØ¹Ø±Ø¶ Ø¥Ø´Ø¹Ø§Ø± Ù†Ø¸Ø§Ù… ÙŠØ¯ÙˆÙŠ ÙÙˆØ±Ø§Ù‹ ÙÙŠ Ø§Ù„Ø¨Ø±Ø¯Ø©
                    val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                    val channelId = "aboakbar_admin_notifications"

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        val channelName = "ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ØªØ³ÙˆÙŠØ© Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø¬Ù‡Ø²ÙŠÙ†"
                        val channel = android.app.NotificationChannel(
                            channelId,
                            channelName,
                            android.app.NotificationManager.IMPORTANCE_HIGH
                        ).apply {
                            description = "Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ØªØ³ÙˆÙŠØ© Ø­Ø³Ø§Ø¨ Ø§Ù„Ù…Ø¬Ù‡Ø²ÙŠÙ†"
                            enableLights(true)
                            enableVibration(true)
                            vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)
                        }
                        notificationManager.createNotificationChannel(channel)
                    }

                    // Ø¥Ø¹Ø¯Ø§Ø¯ Ù†ÙŠØ© ÙØªØ­ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø¹Ù„Ù‰ ØµÙØ­Ø© Ø¯ÙØªØ± Ø§Ù„Ø¯ÙŠÙˆÙ† Ù…Ø¨Ø§Ø´Ø±Ø©
                    val openIntent = Intent(context, MainActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                        putExtra("target_url", "https://aboakbr.com/abo1stor3hlaa2kbr8-47/credit-book")
                    }
                    val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
                    } else {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val pendingIntent = android.app.PendingIntent.getActivity(context, 1, openIntent, pendingIntentFlags)

                    val alertIntent = Intent(context, OrderAlertActivity::class.java).apply {
                        putExtra("type", "preparer_withdrawal")
                        putExtra("preparerName", preparerName)
                        putExtra("amount", amount)
                        putExtra("remain", remain)
                        putExtra("time", time)
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    }
                    val alertFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_MUTABLE
                    } else {
                        android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    }
                    val alertPendingIntent = android.app.PendingIntent.getActivity(context, 999, alertIntent, alertFlags)

                    val title = "ðŸ’µ Ø·Ù„Ø¨ ØªØ³ÙˆÙŠØ© Ø­Ø³Ø§Ø¨ Ù…Ø¬Ù‡Ø²: $preparerName"
                    val body = "Ø§Ù„Ù…Ø¨Ù„Øº: $amount | Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ: $remain"

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

                    notificationManager.notify(999, builder.build())

                    // 2. ØªØ´ØºÙŠÙ„ Ø§Ù„Ø´Ø§Ø´Ø© Ø§Ù„Ù…Ù†Ø¨Ø«Ù‚Ø© Ø§Ù„Ø¥Ø¬Ø¨Ø§Ø±ÙŠØ© Ù…Ø¨Ø§Ø´Ø±Ø© ÙÙˆÙ‚ ÙƒÙ„ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª
                    context.startActivity(alertIntent)

                } catch (e: Exception) {
                    // ØªØ¬Ø§Ù‡Ù„ Ø§Ù„Ø£Ø®Ø·Ø§Ø¡
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
