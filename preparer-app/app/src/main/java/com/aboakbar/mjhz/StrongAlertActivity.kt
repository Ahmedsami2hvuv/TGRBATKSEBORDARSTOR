package com.aboakbar.mjhz

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Vibrator
import android.os.VibratorManager
import android.view.Window
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView

class StrongAlertActivity : Activity() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var audioManager: AudioManager? = null
    private var originalVolume: Int = 0
    private var handler = Handler(Looper.getMainLooper())
    private var secondsLeft = 60

    // مستقبل بث لإيقاف التنبيه من السيرفر يدوياً
    private val stopReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent?.action == "com.aboakbar.mjhz.ACTION_STOP_STRONG_ALERT") {
                finish()
            }
        }
    }

    private val countdownRunnable = object : Runnable {
        override fun run() {
            secondsLeft--
            val tvTimer = findViewById<TextView>(R.id.tvStrongAlertTimer)
            if (secondsLeft > 0) {
                tvTimer.text = "سيتوقف التنبيه تلقائياً بعد: $secondsLeft ثانية"
                handler.postDelayed(this, 1000)
            } else {
                finish() // الإغلاق التلقائي بعد انتهاء الدقيقة
            }
        }
    }

    private fun sendAck(alertId: String, role: String, userId: String) {
        if (alertId.isNotEmpty()) {
            Thread {
                try {
                    val url = java.net.URL("https://aboakbr.com/api/admin/strong-alert/ack")
                    val conn = url.openConnection() as java.net.HttpURLConnection
                    conn.requestMethod = "POST"
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Android; Mobile)")
                    conn.doOutput = true
                    
                    val jsonInputString = "{\"alertId\": \"$alertId\", \"role\": \"$role\", \"userId\": \"$userId\"}"
                    conn.outputStream.use { os ->
                        val input = jsonInputString.toByteArray(Charsets.UTF_8)
                        os.write(input, 0, input.size)
                    }
                    conn.responseCode
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }.start()
        }
    }

    private fun applyTheme(theme: String) {
        val rootLayout = findViewById<android.view.View>(R.id.rootAlertLayout)
        val tvTitle = findViewById<TextView>(R.id.tvStrongAlertTitle)
        val tvMessage = findViewById<TextView>(R.id.tvStrongAlertMessage)
        val tvIcon = findViewById<TextView>(R.id.tvAlertIcon)
        val tvTimer = findViewById<TextView>(R.id.tvStrongAlertTimer)

        // ألوان التدرجات الافتراضية
        var startColor = android.graphics.Color.parseColor("#1b0a0a")
        var endColor = android.graphics.Color.parseColor("#0d0505")
        var titleColor = android.graphics.Color.parseColor("#ff4444")
        var messageColor = android.graphics.Color.parseColor("#ffaaaa")
        var timerColor = android.graphics.Color.parseColor("#ffcc00")
        var iconText = "🚨"

        when (theme) {
            "islamic" -> {
                startColor = android.graphics.Color.parseColor("#1B4D3E") // أخضر زيتوني داكن
                endColor = android.graphics.Color.parseColor("#0D2E24")
                titleColor = android.graphics.Color.parseColor("#E6C280") // ذهبي هادئ
                messageColor = android.graphics.Color.parseColor("#C2D1C9") // أخضر باهت ناعم
                timerColor = android.graphics.Color.parseColor("#E6C280")
                iconText = "🕌"
            }
            "official" -> {
                startColor = android.graphics.Color.parseColor("#0B192C") // كحلي ملكي
                endColor = android.graphics.Color.parseColor("#1E3E62")
                titleColor = android.graphics.Color.parseColor("#F1F6F9") // أبيض فضي
                messageColor = android.graphics.Color.parseColor("#9DB2BF") // رمادي باهت
                timerColor = android.graphics.Color.parseColor("#E6C280")
                iconText = "💼"
            }
            "sport" -> {
                startColor = android.graphics.Color.parseColor("#D84B16") // برتقالي حيوي
                endColor = android.graphics.Color.parseColor("#A33309")
                titleColor = android.graphics.Color.parseColor("#FFFFFF")
                messageColor = android.graphics.Color.parseColor("#FFD2BF")
                timerColor = android.graphics.Color.parseColor("#FFFFFF")
                iconText = "⚡"
            }
            "red" -> {
                startColor = android.graphics.Color.parseColor("#800000") // أحمر ناري ناعم
                endColor = android.graphics.Color.parseColor("#3C0000")
                titleColor = android.graphics.Color.parseColor("#FFD2D2")
                messageColor = android.graphics.Color.parseColor("#FFAAAA")
                timerColor = android.graphics.Color.parseColor("#FFCC00")
                iconText = "🚨"
            }
        }

        // تطبيق الخلفية ذات الحواف الدائرية الأنيقة (rounded design)
        val gradientDrawable = android.graphics.drawable.GradientDrawable(
            android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(startColor, endColor)
        ).apply {
            shape = android.graphics.drawable.GradientDrawable.RECTANGLE
            cornerRadius = 48f // حواف ناعمة جداً
            setStroke(2, android.graphics.Color.parseColor("#55ffffff")) // إطار أبيض خفيف لإعطاء مظهر زجاجي
        }
        rootLayout.background = gradientDrawable

        // تطبيق ألوان النصوص
        tvTitle.setTextColor(titleColor)
        tvMessage.setTextColor(messageColor)
        tvTimer.setTextColor(timerColor)

        // تطبيق الأيقونة ديناميكياً
        tvIcon.text = iconText
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // إعدادات الشاشة للظهور فوق قفل الشاشة وتشغيل الضوء
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

        setContentView(R.layout.activity_strong_alert)
        setFinishOnTouchOutside(false)

        // جلب النصوص المخصصة وخيارات الأزرار والستايل
        val customTitle = intent.getStringExtra("customTitle") ?: ""
        val customBody = intent.getStringExtra("customBody") ?: ""
        val showWhatsapp = intent.getStringExtra("showWhatsapp") ?: "false"
        val showOpenApp = intent.getStringExtra("showOpenApp") ?: "false"
        val showDismiss = intent.getStringExtra("showDismiss") ?: "true"
        val theme = intent.getStringExtra("theme") ?: "red"

        // تطبيق المظهر والتنسيق المختار
        applyTheme(theme)

        val tvTitle = findViewById<TextView>(R.id.tvStrongAlertTitle)
        val tvMessage = findViewById<TextView>(R.id.tvStrongAlertMessage)
        val tvIcon = findViewById<TextView>(R.id.tvAlertIcon)

        if (customTitle.trim().isEmpty()) {
            tvTitle.visibility = android.view.View.GONE
            tvIcon.visibility = android.view.View.GONE
        } else {
            tvTitle.text = customTitle
            tvTitle.visibility = android.view.View.VISIBLE
            tvIcon.visibility = android.view.View.VISIBLE
        }

        if (customBody.trim().isEmpty()) {
            tvMessage.visibility = android.view.View.GONE
        } else {
            tvMessage.text = customBody
            tvMessage.visibility = android.view.View.VISIBLE
        }

        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        
        // 1. تشغيل المؤقت التنازلي
        handler.postDelayed(countdownRunnable, 1000)

        // 2. تشغيل التأثيرات (الصوت والاهتزاز)
        startAlertEffects()

        // إلغاء إشعار النظام رقم 9999 فوراً لتجنب قيام أندرويد بإعادة تشغيل الشاشة المنبثقة عند شحن الهاتف أو استقبال إشعارات أخرى
        try {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            notificationManager.cancel(9999)
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // 3. إدارة كتم التنبيه محلياً مع الأزرار الديناميكية المخصصة
        val alertId = intent.getStringExtra("alertId") ?: ""
        val role = intent.getStringExtra("role") ?: "preparer"
        val prefs = getSharedPreferences("AboAkbarpreparerPrefs", Context.MODE_PRIVATE)
        val userId = prefs.getString("preparer_id", "") ?: ""

        val cancelNotification = {
            try {
                val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
                notificationManager.cancel(9999)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        val btnDismiss = findViewById<Button>(R.id.btnDismissStrongAlert)
        val btnWhatsapp = findViewById<Button>(R.id.btnOpenWhatsappAlert)
        val btnOpenApp = findViewById<Button>(R.id.btnOpenAppAlert)

        // أ. زر مراسلة الواتساب (اختياري)
        if (showWhatsapp == "true") {
            btnWhatsapp.visibility = android.view.View.VISIBLE
            btnWhatsapp.setOnClickListener {
                sendAck(alertId, role, userId)
                cancelNotification()
                try {
                    val waIntent = Intent(Intent.ACTION_VIEW)
                    waIntent.data = Uri.parse("https://api.whatsapp.com/send?phone=9647733921468&text=" + Uri.encode("جيتك من التنبيه"))
                    waIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    startActivity(waIntent)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                finish()
            }
        } else {
            btnWhatsapp.visibility = android.view.View.GONE
        }

        // ب. زر فتح التطبيق (اختياري)
        if (showOpenApp == "true") {
            btnOpenApp.visibility = android.view.View.VISIBLE
            btnOpenApp.setOnClickListener {
                sendAck(alertId, role, userId)
                cancelNotification()
                try {
                    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
                    launchIntent?.let {
                        it.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
                        startActivity(it)
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                finish()
            }
        } else {
            btnOpenApp.visibility = android.view.View.GONE
        }

        // ج. زر الإغلاق المعتاد (مع تحقق وقائي)
        // التحقق الوقائي: إذا ألغي زر الإغلاق ولم يكن هناك أي زر آخر مفعل، يجب إظهاره تلقائياً لمنع الهاتف من تعليق الرنين
        val isForceShowDismiss = (showWhatsapp != "true" && showOpenApp != "true")
        if (showDismiss == "true" || isForceShowDismiss) {
            btnDismiss.visibility = android.view.View.VISIBLE
            btnDismiss.setOnClickListener {
                sendAck(alertId, role, userId)
                cancelNotification()
                finish()
            }
        } else {
            btnDismiss.visibility = android.view.View.GONE
        }

        // 4. تسجيل مستقبل البث لإشارة الإيقاف من السيرفر
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(stopReceiver, IntentFilter("com.aboakbar.mjhz.ACTION_STOP_STRONG_ALERT"), Context.RECEIVER_EXPORTED)
        } else {
            registerReceiver(stopReceiver, IntentFilter("com.aboakbar.mjhz.ACTION_STOP_STRONG_ALERT"))
        }
    }

    private fun startAlertEffects() {
        try {
            // رفع مستوى صوت المنبه إلى الحد الأقصى لضمان تخطي الصامت
            audioManager?.let { am ->
                originalVolume = am.getStreamVolume(AudioManager.STREAM_ALARM)
                val maxVolume = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
                am.setStreamVolume(AudioManager.STREAM_ALARM, maxVolume, 0)
            }

            // تحديد نغمة إنذار قوية
            val alertUri: Uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)

            // إعداد وتشغيل مشغل الصوت
            mediaPlayer = MediaPlayer().apply {
                setDataSource(this@StrongAlertActivity, alertUri)
                setAudioStreamType(AudioManager.STREAM_ALARM)
                isLooping = true
                prepare()
                start()
            }

            // إعداد وتشغيل الاهتزاز القوي
            vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }

            // نمط اهتزاز قوي جداً: اهتزاز ثانية، توقف ربع ثانية، اهتزاز ثانية... بشكل متكرر (0 يعني تكرار)
            val pattern = longArrayOf(0, 1000, 250, 1000, 250)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(android.os.VibrationEffect.createWaveform(pattern, 0))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(pattern, 0)
            }

        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopAlertEffects() {
        try {
            // إيقاف الصوت
            mediaPlayer?.let { mp ->
                if (mp.isPlaying) {
                    mp.stop()
                }
                mp.release()
            }
            mediaPlayer = null

            // إيقاف الاهتزاز
            vibrator?.cancel()
            vibrator = null

            // إرجاع مستوى الصوت الأصلي للمنبه لعدم إزعاج المستخدم لاحقاً
            audioManager?.setStreamVolume(AudioManager.STREAM_ALARM, originalVolume, 0)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        handler.removeCallbacks(countdownRunnable)
        stopAlertEffects()
        try {
            unregisterReceiver(stopReceiver)
        } catch (e: Exception) {
            // تجاهل إذا لم يكن مسجلاً
        }
        super.onDestroy()
    }
}
