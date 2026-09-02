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

class FloatingBubbleService : Service() {

    private var windowManager: WindowManager? = null
    private var bubbleView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    private var initialX: Int = 0
    private var initialY: Int = 0
    private var initialTouchX: Float = 0f
    private var initialTouchY: Float = 0f
    private var isClick: Boolean = false

    private val handler = Handler(Looper.getMainLooper())
    private var longClickRunnable: Runnable? = null
    private var isLongClickHandled = false

    companion object {
        var isServiceRunning = false
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        isServiceRunning = true

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val bubbleText = TextView(this).apply {
            text = "✨ AI"
            textSize = 15f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER

            val bg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#0284C7"))
                setStroke(4, Color.WHITE)
            }
            background = bg
            elevation = 18f
        }

        bubbleView = bubbleText

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val sizePx = (58 * resources.displayMetrics.density).toInt()

        layoutParams = WindowManager.LayoutParams(
            sizePx, // width
            sizePx, // height
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = 40
            y = 350
        }

        bubbleView?.setOnTouchListener(object : View.OnTouchListener {
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

                        if (Math.abs(diffX) > 12 || Math.abs(diffY) > 12) {
                            isClick = false
                            longClickRunnable?.let { handler.removeCallbacks(it) }
                        }

                        layoutParams!!.x = initialX + diffX
                        layoutParams!!.y = initialY + diffY
                        try {
                            windowManager?.updateViewLayout(bubbleView, layoutParams)
                        } catch (e: Exception) {}
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        longClickRunnable?.let { handler.removeCallbacks(it) }
                        if (isClick && !isLongClickHandled) {
                            openFloatingChatWindow()
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
            windowManager?.addView(bubbleView, layoutParams)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun openFloatingChatWindow() {
        val intent = Intent(this, FloatingAiChatActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        startActivity(intent)
    }

    override fun onDestroy() {
        super.onDestroy()
        isServiceRunning = false
        longClickRunnable?.let { handler.removeCallbacks(it) }
        if (bubbleView != null && windowManager != null) {
            try {
                windowManager?.removeView(bubbleView)
            } catch (e: Exception) {}
        }
    }
}
