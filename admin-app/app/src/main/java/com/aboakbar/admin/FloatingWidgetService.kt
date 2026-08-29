package com.aboakbar.admin

import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import android.widget.Toast

class FloatingWidgetService : Service() {

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    private var initialX: Int = 0
    private var initialY: Int = 0
    private var initialTouchX: Float = 0f
    private var initialTouchY: Float = 0f
    private var isClick: Boolean = false

    private val handler = Handler(Looper.getMainLooper())
    private var longClickRunnable: Runnable? = null
    private var isLongClickHandled = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val bubbleText = TextView(this).apply {
            text = "✨ AI"
            textSize = 14f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER

            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#0284C7"))
                setStroke(4, Color.WHITE)
            }
            background = bg
            elevation = 16f
        }

        floatingView = bubbleText

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        layoutParams = WindowManager.LayoutParams(
            140, // width
            140, // height
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 40
            y = 300
        }

        floatingView?.setOnTouchListener(object : View.OnTouchListener {
            override fun onTouch(v: View?, event: MotionEvent?): Boolean {
                if (event == null || layoutParams == null) return false

                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = layoutParams!!.x
                        initialY = layoutParams!!.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isClick = true
                        isLongClickHandled = false

                        // جدولة النقر المطول للإخفاء بعد 700 ملي ثانية
                        longClickRunnable = Runnable {
                            if (isClick && !isLongClickHandled) {
                                isLongClickHandled = true
                                Toast.makeText(applicationContext, "تم إخفاء الزر العائم", Toast.LENGTH_SHORT).show()
                                stopSelf()
                            }
                        }
                        handler.postDelayed(longClickRunnable!!, 700)

                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val diffX = (event.rawX - initialTouchX).toInt()
                        val diffY = (event.rawY - initialTouchY).toInt()

                        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
                            isClick = false
                            longClickRunnable?.let { handler.removeCallbacks(it) }
                        }

                        layoutParams!!.x = initialX + diffX
                        layoutParams!!.y = initialY + diffY
                        windowManager?.updateViewLayout(floatingView, layoutParams)
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        longClickRunnable?.let { handler.removeCallbacks(it) }
                        if (isClick && !isLongClickHandled) {
                            openVoiceAssistant()
                        }
                        return true
                    }
                    MotionEvent.ACTION_CANCEL -> {
                        longClickRunnable?.let { handler.removeCallbacks(it) }
                    }
                }
                return false
            }
        })

        try {
            windowManager?.addView(floatingView, layoutParams)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun openVoiceAssistant() {
        val intent = Intent(this, VoiceAssistantActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        longClickRunnable?.let { handler.removeCallbacks(it) }
        if (floatingView != null && windowManager != null) {
            try {
                windowManager?.removeView(floatingView)
            } catch (e: Exception) {}
        }
    }
}
