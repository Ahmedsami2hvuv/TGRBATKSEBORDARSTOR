package com.aboakbar.mjhz

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.view.*
import android.webkit.*
import android.widget.ImageButton
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.view.ContextThemeWrapper
import androidx.core.app.NotificationCompat

class FloatingAssistantService : Service() {

    private val TAG = "FloatingAssistant"
    private lateinit var windowManager: WindowManager
    private var assistantView: View? = null
    private var bubbleView: View? = null

    private lateinit var assistantParams: WindowManager.LayoutParams
    private lateinit var bubbleParams: WindowManager.LayoutParams

    private var webView: WebView? = null
    private var progressBar: ProgressBar? = null

    private var isExpanded = true
    private val PREFS_NAME = "AboAkbarpreparerPrefs"
    private val KEY_preparer_URL = "preparer_url"
    private val KEY_preparer_ID = "preparer_id"

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        try {
            windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
            startInForeground()
            initViews()
        } catch (e: Exception) {
            Log.e(TAG, "Error initializing FloatingAssistantService", e)
            Toast.makeText(this, "خطأ في تشغيل المساعد: ${e.message}", Toast.LENGTH_LONG).show()
            stopSelf()
        }
    }

    private fun startInForeground() {
        val channelId = "floating_assistant_channel"
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    channelId,
                    "مساعد المجهز العائم",
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "خدمة المساعد الذكي العائم فوق التطبيقات"
                }
                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.createNotificationChannel(channel)
            }

            val notification: Notification = NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_stat_onesignal_default)
                .setContentTitle("🪄 مساعد المجهز نشط")
                .setContentText("المساعد العائم جاهز لتسعير الطلبات فوراً")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try {
                    startForeground(1002, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
                } catch (e: Exception) {
                    startForeground(1002, notification)
                }
            } else {
                startForeground(1002, notification)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Foreground notification error", e)
        }
    }

    @SuppressLint("ClickableViewAccessibility", "SetJavaScriptEnabled")
    private fun initViews() {
        val themedContext = ContextThemeWrapper(this, R.style.Theme_AboAkbarAdmin)
        val inflater = LayoutInflater.from(themedContext)

        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        // 1. إعداد بارامترات النافذة الكاملة
        val displayMetrics = resources.displayMetrics
        val width = (displayMetrics.widthPixels * 0.94).toInt().coerceAtMost(dpToPx(440))
        val height = (displayMetrics.heightPixels * 0.70).toInt().coerceAtMost(dpToPx(650))

        assistantParams = WindowManager.LayoutParams(
            width,
            height,
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            y = dpToPx(50)
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        }

        // 2. إعداد بارامترات الفقاعة العائمة
        bubbleParams = WindowManager.LayoutParams(
            dpToPx(60),
            dpToPx(60),
            layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = displayMetrics.widthPixels - dpToPx(70)
            y = dpToPx(150)
        }

        // 3. تضخيم واجهة النافذة الكاملة
        assistantView = inflater.inflate(R.layout.layout_floating_assistant, null)
        val headerLayout = assistantView!!.findViewById<View>(R.id.headerLayout)
        val btnClose = assistantView!!.findViewById<ImageButton>(R.id.btnClose)
        val btnMinimize = assistantView!!.findViewById<ImageButton>(R.id.btnMinimize)
        val btnReload = assistantView!!.findViewById<ImageButton>(R.id.btnReload)
        webView = assistantView!!.findViewById(R.id.assistantWebView)
        progressBar = assistantView!!.findViewById(R.id.progressBar)

        // 4. تضخيم واجهة الفقاعة
        bubbleView = inflater.inflate(R.layout.layout_floating_bubble, null)

        // إغلاق المساعد
        btnClose?.setOnClickListener {
            stopSelf()
        }

        // تصغير إلى فقاعة
        btnMinimize?.setOnClickListener {
            minimizeToBubble()
        }

        // إعادة التحميل
        btnReload?.setOnClickListener {
            webView?.reload()
        }

        // توسيع من الفقاعة
        bubbleView?.setOnClickListener {
            expandToAssistant()
        }

        // تمكين سحب رأس النافذة
        headerLayout?.let { setupDragListener(it, assistantParams, isAssistant = true) }

        // تمكين سحب الفقاعة
        bubbleView?.let { setupDragListener(it, bubbleParams, isAssistant = false) }

        // إعداد الويب فيو
        setupWebView()

        // إضافة النافذة للشاشة
        try {
            windowManager.addView(assistantView, assistantParams)
            Toast.makeText(this, "🪄 ظهر المساعد العائم", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Log.e(TAG, "WindowManager addView error", e)
            Toast.makeText(this, "تعذر عرض النافذة العائمة: تأكد من منح إذن الظهور فوق التطبيقات", Toast.LENGTH_LONG).show()
            stopSelf()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val wv = webView ?: return
        val settings = wv.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.userAgentString = settings.userAgentString + " PreparerFloatingApp/1.0"

        wv.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                progressBar?.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar?.visibility = View.GONE
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                progressBar?.visibility = View.GONE
            }
        }

        wv.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress == 100) {
                    progressBar?.visibility = View.GONE
                } else {
                    progressBar?.visibility = View.VISIBLE
                }
            }
        }

        // جلب الرابط والمعرف المخزن للمجهز
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedUrl = prefs.getString(KEY_preparer_URL, "") ?: ""
        val savedId = prefs.getString(KEY_preparer_ID, "") ?: ""

        val baseUrl = if (savedUrl.isNotEmpty()) {
            val uri = android.net.Uri.parse(savedUrl)
            "${uri.scheme}://${uri.host}${if (uri.port != -1) ":${uri.port}" else ""}"
        } else {
            "https://tgrbatksebordarstor.vercel.app"
        }

        val assistantUrl = "$baseUrl/preparer/assistant?preparerId=${savedId}"
        wv.loadUrl(assistantUrl)
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun setupDragListener(view: View, params: WindowManager.LayoutParams, isAssistant: Boolean) {
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var hasMoved = false

        view.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    hasMoved = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = (event.rawX - initialTouchX).toInt()
                    val dy = (event.rawY - initialTouchY).toInt()
                    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                        hasMoved = true
                    }
                    params.x = initialX + dx
                    params.y = initialY + dy
                    val targetView = if (isAssistant) assistantView else bubbleView
                    if (targetView != null && targetView.isAttachedToWindow) {
                        try {
                            windowManager.updateViewLayout(targetView, params)
                        } catch (e: Exception) {
                            // تجاهل
                        }
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!hasMoved && !isAssistant) {
                        view.performClick()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun minimizeToBubble() {
        if (!isExpanded) return
        try {
            if (assistantView != null && assistantView!!.isAttachedToWindow) {
                windowManager.removeView(assistantView)
            }
            if (bubbleView != null && !bubbleView!!.isAttachedToWindow) {
                windowManager.addView(bubbleView, bubbleParams)
            }
            isExpanded = false
        } catch (e: Exception) {
            Log.e(TAG, "Error minimizing to bubble", e)
        }
    }

    private fun expandToAssistant() {
        if (isExpanded) return
        try {
            if (bubbleView != null && bubbleView!!.isAttachedToWindow) {
                windowManager.removeView(bubbleView)
            }
            if (assistantView != null && !assistantView!!.isAttachedToWindow) {
                windowManager.addView(assistantView, assistantParams)
            }
            isExpanded = true
        } catch (e: Exception) {
            Log.e(TAG, "Error expanding to assistant", e)
        }
    }

    private fun dpToPx(dp: Int): Int {
        val density = resources.displayMetrics.density
        return (dp * density).toInt()
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            if (assistantView != null && assistantView!!.isAttachedToWindow) {
                windowManager.removeView(assistantView)
            }
            if (bubbleView != null && bubbleView!!.isAttachedToWindow) {
                windowManager.removeView(bubbleView)
            }
            webView?.destroy()
        } catch (e: Exception) {
            Log.e(TAG, "Error in onDestroy", e)
        }
    }
}
