package com.aboakbar.admin

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.graphics.Point
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.*
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.Toast
import androidx.core.app.NotificationCompat
import kotlin.math.abs

class FloatingWidgetService : Service() {

    private var windowManager: WindowManager? = null
    private var floatingBubbleView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    private val CHANNEL_ID = "floating_widget_channel"
    private val NOTIFICATION_ID = 2002

    companion object {
        const val ACTION_SHOW = "com.aboakbar.admin.ACTION_SHOW_FLOATING_WIDGET"
        const val ACTION_HIDE = "com.aboakbar.admin.ACTION_HIDE_FLOATING_WIDGET"
        const val ACTION_SET_INVISIBLE = "com.aboakbar.admin.ACTION_SET_INVISIBLE"
        const val ACTION_SET_VISIBLE = "com.aboakbar.admin.ACTION_SET_VISIBLE"
        var isRunning = false
            private set
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        stopSelf()
        return START_NOT_STICKY
    }

    private fun startForegroundNotification() {
        val stopIntent = Intent(this, FloatingWidgetService::class.java).apply {
            action = ACTION_HIDE
        }
        val pendingIntentFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        val stopPendingIntent = PendingIntent.getService(this, 1, stopIntent, pendingIntentFlags)

        val openFloatingHubIntent = Intent(this, FloatingAdminActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val openPendingIntent = PendingIntent.getActivity(this, 0, openFloatingHubIntent, pendingIntentFlags)

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("الزر العائم - أبو الأكبر")
            .setContentText("اضغط هنا لفتح لوحة إضافة الطلب والمساعد الذكي فوراً")
            .setSmallIcon(R.drawable.ic_notification_small)
            .setContentIntent(openPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(R.drawable.ic_close_floating, "إخفاء الزر", stopPendingIntent)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    @SuppressLint("InflateParams", "ClickableViewAccessibility")
    private fun initFloatingBubble() {
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val inflater = LayoutInflater.from(this)
        floatingBubbleView = inflater.inflate(R.layout.layout_floating_widget, null)

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val screenSize = Point()
        @Suppress("DEPRECATION")
        windowManager?.defaultDisplay?.getSize(screenSize)

        layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = screenSize.x - 200
            y = screenSize.y / 3
        }

        setupBubbleTouch()

        try {
            windowManager?.addView(floatingBubbleView, layoutParams)
        } catch (e: Exception) {
            e.printStackTrace()
            stopSelf()
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupBubbleTouch() {
        val bubble = floatingBubbleView?.findViewById<FrameLayout>(R.id.layoutFloatingBubble) ?: return

        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var isDragging = false

        bubble.setOnTouchListener { _, event ->
            val params = layoutParams ?: return@setOnTouchListener false
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = (event.rawX - initialTouchX).toInt()
                    val deltaY = (event.rawY - initialTouchY).toInt()

                    if (abs(deltaX) > 12 || abs(deltaY) > 12) {
                        isDragging = true
                    }

                    if (isDragging) {
                        params.x = initialX + deltaX
                        params.y = initialY + deltaY
                        try {
                            windowManager?.updateViewLayout(floatingBubbleView, params)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isDragging) {
                        openFloatingAdminHub()
                    } else {
                        snapToEdge()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun openFloatingAdminHub() {
        try {
            val params = layoutParams
            val clickX = params?.x ?: 80
            val clickY = params?.y ?: 300
            val intent = Intent(this, FloatingAdminActivity::class.java).apply {
                putExtra("CLICK_X", clickX)
                putExtra("CLICK_Y", clickY)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun snapToEdge() {
        val params = layoutParams ?: return
        val screenSize = Point()
        @Suppress("DEPRECATION")
        windowManager?.defaultDisplay?.getSize(screenSize)

        val screenWidth = screenSize.x
        val middleX = screenWidth / 2
        val buttonWidthPx = (56 * resources.displayMetrics.density).toInt()
        val marginPx = (10 * resources.displayMetrics.density).toInt()
        val targetX = if (params.x + buttonWidthPx / 2 < middleX) marginPx else screenWidth - buttonWidthPx - marginPx

        val animator = ValueAnimator.ofInt(params.x, targetX)
        animator.duration = 180
        animator.interpolator = DecelerateInterpolator()
        animator.addUpdateListener { animation ->
            params.x = animation.animatedValue as Int
            try {
                windowManager?.updateViewLayout(floatingBubbleView, params)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        animator.start()
    }


    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "خدمة الزر العائم",
                NotificationManager.IMPORTANCE_LOW
            )
            serviceChannel.description = "إبقاء الزر العائم نشطاً على الشاشة"
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        if (floatingBubbleView != null) {
            try {
                windowManager?.removeView(floatingBubbleView)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            floatingBubbleView = null
        }
    }
}
