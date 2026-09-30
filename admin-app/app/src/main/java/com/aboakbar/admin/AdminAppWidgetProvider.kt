package com.aboakbar.admin

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews

class AdminAppWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.layout_admin_widget)

            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }

            // 1. فتح التطبيق الرئيسي
            val mainIntent = Intent(context, MainActivity::class.java)
            val mainPendingIntent = PendingIntent.getActivity(context, 101, mainIntent, flags)
            views.setOnClickPendingIntent(R.id.widgetBtnMainApp, mainPendingIntent)

            // 2. تشغيل / إخفاء الزر العائم
            val floatingIntent = Intent(context, FloatingWidgetActionActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            val floatingPendingIntent = PendingIntent.getActivity(context, 102, floatingIntent, flags)
            views.setOnClickPendingIntent(R.id.widgetBtnFloating, floatingPendingIntent)

            // 3. المساعد الذكي AI
            val aiIntent = Intent(context, FloatingAiChatActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val aiPendingIntent = PendingIntent.getActivity(context, 103, aiIntent, flags)
            views.setOnClickPendingIntent(R.id.widgetBtnAi, aiPendingIntent)

            // 4. إضافة طلب
            val addOrderIntent = Intent(context, MainActivity::class.java).apply {
                putExtra("OPEN_URL", "https://aboakbr.com/abo1stor3hlaa2kbr8-47/orders/new")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            val addOrderPendingIntent = PendingIntent.getActivity(context, 104, addOrderIntent, flags)
            views.setOnClickPendingIntent(R.id.widgetBtnAddOrder, addOrderPendingIntent)

            // 5. إدارة الطلبات
            val ordersIntent = Intent(context, MainActivity::class.java).apply {
                putExtra("OPEN_URL", "https://aboakbr.com/abo1stor3hlaa2kbr8-47/orders/pending")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            val ordersPendingIntent = PendingIntent.getActivity(context, 105, ordersIntent, flags)
            views.setOnClickPendingIntent(R.id.widgetBtnOrders, ordersPendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
