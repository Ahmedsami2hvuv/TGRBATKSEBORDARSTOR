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
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Toast
import androidx.core.app.NotificationCompat
import kotlin.math.abs

class FloatingWidgetService : Service() {

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    private var layoutFloatingBubble: FrameLayout? = null
    private var layoutFloatingMenu: LinearLayout? = null
    private var btnDismissMenu: ImageView? = null
    private var btnShortcutAi: LinearLayout? = null
    private var btnShortcutAddOrder: LinearLayout? = null
    private var btnShortcutOrders: LinearLayout? = null
    private var btnShortcutHome: LinearLayout? = null
    private var btnHideFloatingWidget: LinearLayout? = null

    private var isMenuExpanded = false
    private val CHANNEL_ID = "floating_widget_channel"
    private val NOTIFICATION_ID = 2002

    companion object {
        const val ACTION_SHOW = "com.aboakbar.admin.ACTION_SHOW_FLOATING_WIDGET"
        const val ACTION_HIDE = "com.aboakbar.admin.ACTION_HIDE_FLOATING_WIDGET"
        const val ACTION_TOGGLE = "com.aboakbar.admin.ACTION_TOGGLE_FLOATING_WIDGET"
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
        if (intent?.action == ACTION_HIDE) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Toast.makeText(this, getString(R.string.floating_widget_permission_required), Toast.LENGTH_LONG).show()
            stopSelf()
            return START_NOT_STICKY
        }

        startForegroundNotification()

        if (floatingView == null) {
            initFloatingWidget()
        }

        return START_STICKY
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

        val openAppIntent = Intent(this, MainActivity::class.java)
        val openAppPendingIntent = PendingIntent.getActivity(this, 0, openAppIntent, pendingIntentFlags)

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("الزر العائم - أبو الأكبر")
            .setContentText("الزر العائم متاح الآن على شاشتك للاختصارات السريعة")
            .setSmallIcon(R.drawable.ic_notification_small)
            .setContentIntent(openAppPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MIN)
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
    private fun initFloatingWidget() {
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val inflater = LayoutInflater.from(this)
        floatingView = inflater.inflate(R.layout.layout_floating_widget, null)

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
            x = screenSize.x - 180
            y = screenSize.y / 2 - 100
        }

        layoutFloatingBubble = floatingView?.findViewById(R.id.layoutFloatingBubble)
        layoutFloatingMenu = floatingView?.findViewById(R.id.layoutFloatingMenu)
        btnDismissMenu = floatingView?.findViewById(R.id.btnDismissMenu)
        btnShortcutAi = floatingView?.findViewById(R.id.btnShortcutAi)
        btnShortcutAddOrder = floatingView?.findViewById(R.id.btnShortcutAddOrder)
        btnShortcutOrders = floatingView?.findViewById(R.id.btnShortcutOrders)
        btnShortcutHome = floatingView?.findViewById(R.id.btnShortcutHome)
        btnHideFloatingWidget = floatingView?.findViewById(R.id.btnHideFloatingWidget)

        setupInteractions()

        try {
            windowManager?.addView(floatingView, layoutParams)
        } catch (e: Exception) {
            e.printStackTrace()
            stopSelf()
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupInteractions() {
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var isDragging = false

        layoutFloatingBubble?.setOnTouchListener { _, event ->
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

                    if (abs(deltaX) > 10 || abs(deltaY) > 10) {
                        isDragging = true
                    }

                    if (isDragging) {
                        params.x = initialX + deltaX
                        params.y = initialY + deltaY
                        try {
                            windowManager?.updateViewLayout(floatingView, params)
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isDragging) {
                        toggleMenu()
                    } else {
                        snapToEdge()
                    }
                    true
                }
                else -> false
            }
        }

        btnDismissMenu?.setOnClickListener {
            collapseMenu()
        }

        // 1. زر المساعد الذكي
        btnShortcutAi?.setOnClickListener {
            collapseMenu()
            val intent = Intent(this, FloatingAiChatActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            startActivity(intent)
        }

        // 2. زر إضافة طلب
        btnShortcutAddOrder?.setOnClickListener {
            collapseMenu()
            val intent = Intent(this, MainActivity::class.java).apply {
                putExtra("OPEN_URL", "https://aboakbr.com/abo1stor3hlaa2kbr8-47/orders/new")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
        }

        // 3. زر قائمة الطلبات
        btnShortcutOrders?.setOnClickListener {
            collapseMenu()
            val intent = Intent(this, MainActivity::class.java).apply {
                putExtra("OPEN_URL", "https://aboakbr.com/abo1stor3hlaa2kbr8-47/orders/pending")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
        }

        // 4. زر الرئيسية
        btnShortcutHome?.setOnClickListener {
            collapseMenu()
            val intent = Intent(this, MainActivity::class.java).apply {
                putExtra("OPEN_URL", "https://aboakbr.com/abo1stor3hlaa2kbr8-47")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            startActivity(intent)
        }

        // 5. زر إخفاء الزر العائم
        btnHideFloatingWidget?.setOnClickListener {
            collapseMenu()
            Toast.makeText(this, getString(R.string.floating_widget_stopped), Toast.LENGTH_SHORT).show()
            stopSelf()
        }
    }

    private fun toggleMenu() {
        if (isMenuExpanded) {
            collapseMenu()
        } else {
            expandMenu()
        }
    }

    private fun expandMenu() {
        isMenuExpanded = true
        layoutFloatingMenu?.visibility = View.VISIBLE
    }

    private fun collapseMenu() {
        isMenuExpanded = false
        layoutFloatingMenu?.visibility = View.GONE
    }

    private fun snapToEdge() {
        val params = layoutParams ?: return
        val screenSize = Point()
        @Suppress("DEPRECATION")
        windowManager?.defaultDisplay?.getSize(screenSize)

        val screenWidth = screenSize.x
        val middleX = screenWidth / 2
        val targetX = if (params.x + 30 < middleX) 16 else screenWidth - 190

        val animator = ValueAnimator.ofInt(params.x, targetX)
        animator.duration = 200
        animator.interpolator = DecelerateInterpolator()
        animator.addUpdateListener { animation ->
            params.x = animation.animatedValue as Int
            try {
                windowManager?.updateViewLayout(floatingView, params)
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
                NotificationManager.IMPORTANCE_MIN
            )
            serviceChannel.description = "إبقاء الزر العائم نشطاً على الشاشة"
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        if (floatingView != null) {
            try {
                windowManager?.removeView(floatingView)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            floatingView = null
        }
    }
}
