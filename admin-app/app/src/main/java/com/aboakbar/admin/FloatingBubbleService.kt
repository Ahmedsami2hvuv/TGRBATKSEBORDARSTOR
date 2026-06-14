package com.aboakbar.admin

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.*
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import android.os.Vibrator
import android.os.VibratorManager
import android.graphics.Color
import android.util.TypedValue
import kotlin.math.abs

class FloatingBubbleService : Service() {

    private lateinit var windowManager: WindowManager
    private var bubbleView: FrameLayout? = null
    private var vibrator: Vibrator? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val pendingCount = intent?.getIntExtra("pendingCount", 1) ?: 1
        val orderNumber = intent?.getIntExtra("orderNumber", 0) ?: 0

        // إزالة أي فقاعة سابقة لتجنب التكرار
        removeBubble()

        // إنشاء وعرض الفقاعة الجديدة
        createFloatingBubble(pendingCount, orderNumber)

        // تشغيل الاهتزاز لتنبيه المستخدم
        vibrateDevice()

        return START_NOT_STICKY
    }

    private fun createFloatingBubble(pendingCount: Int, orderNumber: Int) {
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager

        // تهيئة الحاوية الرئيسية للفقاعة العائمة
        bubbleView = FrameLayout(this)

        // تصميم الدائرة الرئيسية برمجياً
        val mainCircle = FrameLayout(this).apply {
            val size = dpToPx(65)
            layoutParams = FrameLayout.LayoutParams(size, size).apply {
                gravity = Gravity.CENTER
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                // تدرج لوني جذاب (برتقالي محمر ليعطي شعور الاستعجال)
                colors = intArrayOf(Color.parseColor("#FF4E50"), Color.parseColor("#F9D423"))
                orientation = GradientDrawable.Orientation.TL_BR
                setStroke(dpToPx(2), Color.WHITE)
            }
            elevation = dpToPx(8).toFloat()
        }

        // إضافة أيقونة الجرس داخل الدائرة
        val bellIcon = ImageView(this).apply {
            setImageResource(android.R.drawable.ic_popup_reminder)
            layoutParams = FrameLayout.LayoutParams(dpToPx(30), dpToPx(30)).apply {
                gravity = Gravity.CENTER
            }
            setColorFilter(Color.WHITE)
        }
        mainCircle.addView(bellIcon)

        // إضافة شارة الرقم للطلبات المعلقة (Badge)
        val badge = TextView(this).apply {
            text = pendingCount.toString()
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            val badgeSize = dpToPx(22)
            layoutParams = FrameLayout.LayoutParams(badgeSize, badgeSize).apply {
                gravity = Gravity.TOP or Gravity.END
                topMargin = dpToPx(2)
                rightMargin = dpToPx(2)
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#D50000")) // لون أحمر غامق للتنبيه
                setStroke(dpToPx(1), Color.WHITE)
            }
        }
        mainCircle.addView(badge)

        // إضافة زر إغلاق عائم صغير (X)
        val closeBtn = TextView(this).apply {
            text = "✕"
            setTextColor(Color.WHITE)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 10f)
            gravity = Gravity.CENTER
            val closeSize = dpToPx(18)
            layoutParams = FrameLayout.LayoutParams(closeSize, closeSize).apply {
                gravity = Gravity.TOP or Gravity.START
                topMargin = dpToPx(2)
                leftMargin = dpToPx(2)
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.BLACK)
                alpha = 180 // نصف شفاف
            }
            setOnClickListener {
                stopSelf()
            }
        }
        bubbleView?.addView(mainCircle)
        bubbleView?.addView(closeBtn)

        // إعداد متغيرات العرض فوق التطبيقات الأخرى
        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 100
            y = 200
        }

        // إضافة ميزة السحب واللمس للفقاعة العائمة
        mainCircle.setOnTouchListener(object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f
            private var clickStartTime = 0L

            override fun onTouch(v: View?, event: MotionEvent?): Boolean {
                if (event == null) return false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        clickStartTime = System.currentTimeMillis()
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        params.x = initialX + (event.rawX - initialTouchX).toInt()
                        params.y = initialY + (event.rawY - initialTouchY).toInt()
                        try {
                            windowManager.updateViewLayout(bubbleView, params)
                        } catch (e: Exception) {
                            // تجاهل
                        }
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        val clickDuration = System.currentTimeMillis() - clickStartTime
                        val moveX = abs(event.rawX - initialTouchX)
                        val moveY = abs(event.rawY - initialTouchY)

                        // إذا كان التحريك بسيطاً والوقت قصيراً، يعتبر نقرة واحدة (Click) لفتح التطبيق
                        if (clickDuration < 300 && moveX < 15 && moveY < 15) {
                            openAdminApp(orderNumber)
                        }
                        return true
                    }
                }
                return false
            }
        })

        try {
            windowManager.addView(bubbleView, params)
        } catch (e: Exception) {
            stopSelf()
        }
    }

    private fun openAdminApp(orderNumber: Int) {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("target_url", "https://aboakbar.vercel.app/abo1stor3hlaa2kbr8-47/orders/pending")
        }
        startActivity(intent)
        stopSelf()
    }

    private fun vibrateDevice() {
        try {
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            // نمط اهتزاز متكرر ينبه الأدمن بقوة
            val pattern = longArrayOf(0, 400, 200, 400, 200, 400)
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

    private fun removeBubble() {
        try {
            if (bubbleView != null) {
                windowManager.removeView(bubbleView)
                bubbleView = null
            }
        } catch (e: Exception) {
            // تجاهل
        }
    }

    private fun dpToPx(dp: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

    override fun onDestroy() {
        removeBubble()
        try {
            vibrator?.cancel()
        } catch (e: Exception) {
            // تجاهل
        }
        super.onDestroy()
    }
}
