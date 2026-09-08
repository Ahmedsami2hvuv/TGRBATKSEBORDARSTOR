package com.aboakbar.modf

import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.*
import android.widget.TextView
import android.widget.Toast
import kotlin.math.abs

class FloatingAssistantService : Service() {

    private var windowManager: WindowManager? = null
    private var floatingBubbleView: View? = null
    private var actionDialogView: View? = null

    private var initialX = 0
    private var initialY = 0
    private var initialTouchX = 0f
    private var initialTouchY = 0f
    private var isDragging = false
    private var touchStartTime = 0L

    private val longPressHandler = Handler(Looper.getMainLooper())
    private var isLongPressed = false

    companion object {
        var isRunning = false
            private set

        fun start(context: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!android.provider.Settings.canDrawOverlays(context)) {
                    Toast.makeText(context, "يرجى منح إذن الظهور فوق التطبيقات لتفعيل المساعد العائم", Toast.LENGTH_LONG).show()
                    return
                }
            }
            val intent = Intent(context, FloatingAssistantService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            val intent = Intent(context, FloatingAssistantService::class.java)
            context.stopService(intent)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    @SuppressLint("InflateParams", "ClickableViewAccessibility")
    override fun onCreate() {
        super.onCreate()
        isRunning = true

        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val inflater = LayoutInflater.from(this)

        floatingBubbleView = inflater.inflate(R.layout.layout_floating_bubble, null)

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
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 30
            y = 350
        }

        val bubbleRoot = floatingBubbleView?.findViewById<View>(R.id.bubbleRoot)

        val longPressRunnable = Runnable {
            isLongPressed = true
            // اهتزاز خفيف للإشعار بالاختفاء
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
            vibrator?.vibrate(60)
            Toast.makeText(this@FloatingAssistantService, "تم إخفاء المساعد العائم", Toast.LENGTH_SHORT).show()
            stopSelf()
        }

        bubbleRoot?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDragging = false
                    isLongPressed = false
                    touchStartTime = System.currentTimeMillis()

                    longPressHandler.postDelayed(longPressRunnable, 700)
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = (event.rawX - initialTouchX).toInt()
                    val deltaY = (event.rawY - initialTouchY).toInt()

                    if (abs(deltaX) > 10 || abs(deltaY) > 10) {
                        isDragging = true
                        longPressHandler.removeCallbacks(longPressRunnable)
                    }

                    if (isDragging && !isLongPressed) {
                        params.x = initialX + deltaX
                        params.y = initialY + deltaY
                        try {
                            windowManager?.updateViewLayout(floatingBubbleView, params)
                        } catch (e: Exception) {}
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    longPressHandler.removeCallbacks(longPressRunnable)
                    val duration = System.currentTimeMillis() - touchStartTime

                    if (!isDragging && !isLongPressed && duration < 600) {
                        // نقرة عادية: فتح قائمة الخيارات السريعة
                        showActionDialog()
                    }
                    true
                }
                else -> false
            }
        }

        try {
            windowManager?.addView(floatingBubbleView, params)
            Toast.makeText(this, "تم تفعيل المساعد العائم ⚡ (اسحبه لأي مكان أو انقر مطولاً لإخفائه)", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            e.printStackTrace()
            stopSelf()
        }
    }

    @SuppressLint("InflateParams")
    private fun showActionDialog() {
        if (actionDialogView != null) return

        val inflater = LayoutInflater.from(this)
        actionDialogView = inflater.inflate(R.layout.dialog_floating_actions, null)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val dialogParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_DIM_BEHIND or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
            dimAmount = 0.5f
        }

        actionDialogView?.findViewById<View>(R.id.btnCloseFloatingMenu)?.setOnClickListener {
            dismissActionDialog()
        }

        // 1. طلب جديد
        actionDialogView?.findViewById<View>(R.id.btnOptQuickDraft)?.setOnClickListener {
            dismissActionDialog()
            val intent = Intent(this, QuickDraftActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(intent)
        }

        // 2. طلب ذو وجهتين
        actionDialogView?.findViewById<View>(R.id.btnOptDoubleOrder)?.setOnClickListener {
            dismissActionDialog()
            val intent = Intent(this, DoubleOrderActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(intent)
        }

        // 3. طلب تجهيز
        actionDialogView?.findViewById<View>(R.id.btnOptPrepOrder)?.setOnClickListener {
            dismissActionDialog()
            val intent = Intent(this, PreparationOrderActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(intent)
        }

        try {
            windowManager?.addView(actionDialogView, dialogParams)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun dismissActionDialog() {
        if (actionDialogView != null) {
            try {
                windowManager?.removeView(actionDialogView)
            } catch (e: Exception) {}
            actionDialogView = null
        }
    }

    override fun onDestroy() {
        isRunning = false
        dismissActionDialog()
        if (floatingBubbleView != null) {
            try {
                windowManager?.removeView(floatingBubbleView)
            } catch (e: Exception) {}
            floatingBubbleView = null
        }
        super.onDestroy()
    }
}
