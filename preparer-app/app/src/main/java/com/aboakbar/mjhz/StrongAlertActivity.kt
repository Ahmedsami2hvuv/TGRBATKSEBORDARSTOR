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

        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        
        // 1. تشغيل المؤقت التنازلي
        handler.postDelayed(countdownRunnable, 1000)

        // 2. تشغيل التأثيرات (الصوت والاهتزاز)
        startAlertEffects()

        // 3. زر كتم التنبيه محلياً
        findViewById<Button>(R.id.btnDismissStrongAlert).setOnClickListener {
            finish()
        }

        // 4. تسجيل مستقبل البث لإشارة الإيقاف من السيرفر
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(stopReceiver, IntentFilter("com.aboakbar.mjhz.ACTION_STOP_STRONG_ALERT"), Context.RECEIVER_NOT_EXPORTED)
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
