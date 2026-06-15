package com.aboakbar.admin

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Window
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView

class OrderAlertActivity : Activity() {

    private var ringtone: Ringtone? = null
    private var vibrator: Vibrator? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // إعداد النافذة لتظهر فوق شاشة القفل وتوقظ الشاشة
        requestWindowFeature(Window.FEATURE_NO_TITLE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
            )
        }
        
        // جعل النافذة تظهر كـ Dialog
        setContentView(R.layout.activity_order_alert)
        setFinishOnTouchOutside(false) // منع الإغلاق بالضغط خارج النافذة

        // استخراج البيانات المرسلة
        val shopName = intent.getStringExtra("shopName") ?: "—"
        val regionName = intent.getStringExtra("regionName") ?: "—"
        val orderTime = intent.getStringExtra("orderTime") ?: "فوري"
        val orderType = intent.getStringExtra("orderType") ?: "—"
        val subtotal = intent.getDoubleExtra("subtotal", 0.0)
        val pendingCount = intent.getIntExtra("pendingCount", 0)
        val orderNumber = intent.getIntExtra("orderNumber", 0)

        // ربط عناصر الواجهة وتعبئة البيانات
        findViewById<TextView>(R.id.tvAlertTitle).text = "$shopName — $regionName"
        findViewById<TextView>(R.id.tvOrderNumber).text = "طلب رقم: #$orderNumber"
        findViewById<TextView>(R.id.tvOrderDetails).text = 
            "⏰ الوقت: $orderTime\n" +
            "📦 النوع: $orderType\n" +
            "💵 السعر بدون توصيل: ${formatNumber(subtotal)} د.ع\n" +
            "🔔 إجمالي الطلبات المعلقة: $pendingCount"

        // أزرار التحكم
        findViewById<Button>(R.id.btnOpenApp).setOnClickListener {
            // فتح التطبيق الرئيسي وتمرير رابط الطلبات المعلقة مباشرة
            val mainIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                putExtra("target_url", "https://aboakbar.vercel.app/abo1stor3hlaa2kbr8-47/orders/pending")
            }
            startActivity(mainIntent)
            finish()
        }

        findViewById<Button>(R.id.btnCloseAlert).setOnClickListener {
            finish()
        }

        // تشغيل الاهتزاز فقط
        playNotificationEffects()
    }

    private fun playNotificationEffects() {
        try {
            // تشغيل الارتجاج فقط لتجنب تداخل النغمات المزدوجة
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            
            // نمط ارتجاج متكرر
            val pattern = longArrayOf(0, 500, 200, 500, 200, 500)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(android.os.VibrationEffect.createWaveform(pattern, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, -1)
            }
        } catch (e: Exception) {
            // تجاهل
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

    override fun onDestroy() {
        // إيقاف الارتجاج عند إغلاق النافذة
        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            // تجاهل
        }
        super.onDestroy()
    }
}
