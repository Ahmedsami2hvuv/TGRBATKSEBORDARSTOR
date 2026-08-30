package com.aboakbar.admin

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.Locale

class VoiceAssistantActivity : AppCompatActivity(), TextToSpeech.OnInitListener {

    private lateinit var tvStatus: TextView
    private lateinit var btnToggleChatVisibility: ImageButton
    private lateinit var progressBar: ProgressBar
    private lateinit var btnClose: ImageButton
    private lateinit var btnMicToggle: ImageButton
    private lateinit var btnGeminiPill: GeminiLivePillView
    private lateinit var btnKeyboardToggle: ImageButton
    private lateinit var btnVoiceToggle: ImageButton
    private lateinit var textInputContainer: LinearLayout
    private lateinit var etCommandInput: EditText
    private lateinit var btnSendText: Button
    private lateinit var transparentClickDismiss: View

    private lateinit var chatScrollView: ScrollView
    private lateinit var chatMessagesContainer: LinearLayout

    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    private var isTtsMuted = false
    private var isListening = false
    private var isMicPaused = false
    private var isChatVisible = true
    private val RECORD_AUDIO_REQUEST_CODE = 101
    private val SERVER_URL = "https://aboakbr.com/api/ai/admin-voice"
    private val PREFS_NAME = "AdminVoiceAssistantPrefs"
    private val KEY_TTS_MUTED = "is_tts_muted"

    // سجل الدردشة التراكمية في الجلسة المفتوحة المباشرة
    private val sessionHistory = JSONArray()

    // مؤقت معالجة الصمت والتنفس (Debounce Timer لمنع القطع السريع)
    private val handler = Handler(Looper.getMainLooper())
    private var pendingSpeechText: String? = null
    private val commitSpeechRunnable = Runnable {
        val textToSend = pendingSpeechText
        pendingSpeechText = null
        if (!textToSend.isNullOrBlank()) {
            stopListening()
            addMessageToChat(sender = "user", text = textToSend)
            sendToAdminVoiceApi(textToSend)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_voice_assistant)

        tvStatus = findViewById(R.id.tvStatus)
        btnToggleChatVisibility = findViewById(R.id.btnToggleChatVisibility)
        progressBar = findViewById(R.id.progressBar)
        btnClose = findViewById(R.id.btnClose)
        btnMicToggle = findViewById(R.id.btnMicToggle)
        btnGeminiPill = findViewById(R.id.btnGeminiPill)
        btnKeyboardToggle = findViewById(R.id.btnKeyboardToggle)
        btnVoiceToggle = findViewById(R.id.btnVoiceToggle)
        textInputContainer = findViewById(R.id.textInputContainer)
        etCommandInput = findViewById(R.id.etCommandInput)
        btnSendText = findViewById(R.id.btnSendText)
        transparentClickDismiss = findViewById(R.id.transparentClickDismiss)

        chatScrollView = findViewById(R.id.chatScrollView)
        chatMessagesContainer = findViewById(R.id.chatMessagesContainer)

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        isTtsMuted = prefs.getBoolean(KEY_TTS_MUTED, false) // الصوت مفعل افتراضياً
        updateVoiceButtonUi()

        textToSpeech = TextToSpeech(this, this)

        btnClose.setOnClickListener { clearSessionHistoryAndFinish() }
        transparentClickDismiss.setOnClickListener { clearSessionHistoryAndFinish() }

        // زر إخفاء وإظهار الدردشات
        btnToggleChatVisibility.setOnClickListener {
            isChatVisible = !isChatVisible
            if (isChatVisible) {
                chatScrollView.visibility = View.VISIBLE
                btnToggleChatVisibility.setColorFilter(Color.WHITE)
                Toast.makeText(this, "تم إظهار الدردشة", Toast.LENGTH_SHORT).show()
                chatScrollView.post { chatScrollView.fullScroll(View.FOCUS_DOWN) }
            } else {
                chatScrollView.visibility = View.GONE
                btnToggleChatVisibility.setColorFilter(Color.parseColor("#94A3B8"))
                Toast.makeText(this, "تم إخفاء الدردشة", Toast.LENGTH_SHORT).show()
            }
        }

        addMessageToChat(
            sender = "ai",
            text = "أهلاً بك يا أبو الأكبر! المساعد الصوتي جاهز لتنفيذ أوامرك فوراً بالصوت أو الكتابة 🚀"
        )

        btnMicToggle.setOnClickListener {
            if (isListening) {
                handler.removeCallbacks(commitSpeechRunnable)
                pendingSpeechText = null
                stopListening()
                isMicPaused = true
                tvStatus.text = "🛑 الميكروفون متوقف - انقر للتشغيل"
                Toast.makeText(this, "تم إيقاف الميكروفون", Toast.LENGTH_SHORT).show()
            } else {
                isMicPaused = false
                checkPermissionAndStartListening()
            }
        }

        btnGeminiPill.setOnClickListener {
            if (!isListening) {
                isMicPaused = false
                checkPermissionAndStartListening()
            }
        }

        btnKeyboardToggle.setOnClickListener {
            if (textInputContainer.visibility == View.VISIBLE) {
                textInputContainer.visibility = View.GONE
                hideKeyboard()
            } else {
                textInputContainer.visibility = View.VISIBLE
                etCommandInput.requestFocus()
                showKeyboard()
                if (isChatVisible) {
                    chatScrollView.post { chatScrollView.fullScroll(View.FOCUS_DOWN) }
                }
            }
        }

        btnVoiceToggle.setOnClickListener {
            isTtsMuted = !isTtsMuted
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_TTS_MUTED, isTtsMuted).apply()
            updateVoiceButtonUi()

            if (isTtsMuted) {
                textToSpeech?.stop()
                Toast.makeText(this, "🔇 تم كتم صوت المساعد الذكي", Toast.LENGTH_SHORT).show()
            } else {
                // بدون نطق أي جملة مزعجة
                Toast.makeText(this, "🔊 تم تفعيل صوت المساعد الذكي", Toast.LENGTH_SHORT).show()
            }
        }

        btnSendText.setOnClickListener {
            handler.removeCallbacks(commitSpeechRunnable)
            val typedText = etCommandInput.text.toString().trim()
            if (typedText.isNotEmpty()) {
                etCommandInput.setText("")
                hideKeyboard()
                addMessageToChat(sender = "user", text = typedText)
                sendToAdminVoiceApi(typedText)
            } else {
                Toast.makeText(this, "يرجى كتابة الأمر أولاً", Toast.LENGTH_SHORT).show()
            }
        }

        checkOverlayPermissionAndStartFloatingService()
        checkPermissionAndStartListening()
    }

    private fun updateVoiceButtonUi() {
        if (isTtsMuted) {
            btnVoiceToggle.setImageResource(android.R.drawable.ic_lock_silent_mode)
            btnVoiceToggle.setColorFilter(Color.parseColor("#94A3B8"))
        } else {
            btnVoiceToggle.setImageResource(android.R.drawable.ic_lock_silent_mode_off)
            btnVoiceToggle.setColorFilter(Color.parseColor("#0284C7"))
        }
    }

    private fun showKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.showSoftInput(etCommandInput, InputMethodManager.SHOW_IMPLICIT)
    }

    private fun hideKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.hideSoftInputFromWindow(etCommandInput.windowToken, 0)
    }

    private fun addMessageToChat(sender: String, text: String, buttonsArray: JSONArray? = null) {
        val messageLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(24, 16, 24, 16)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 10, 0, 10)
            }
        }

        val bubbleBackground = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 32f
            if (sender == "user") {
                setColor(Color.parseColor("#330284C7"))
                setStroke(2, Color.parseColor("#4438BDF8"))
            } else {
                setColor(Color.parseColor("#440F172A"))
                setStroke(2, Color.parseColor("#3364748B"))
            }
        }

        messageLayout.background = bubbleBackground

        val tvSender = TextView(this).apply {
            this.text = if (sender == "user") "🎙️ أنـت:" else "✨ المساعد الذكي:"
            textSize = 11f
            setTextColor(if (sender == "user") Color.parseColor("#BAE6FD") else Color.parseColor("#38BDF8"))
            setPadding(0, 0, 0, 6)
        }
        messageLayout.addView(tvSender)

        val tvText = TextView(this).apply {
            this.text = text
            textSize = 13.5f
            setTextColor(Color.parseColor("#F8FAFC"))
            setLineSpacing(4f, 1f)
        }
        messageLayout.addView(tvText)

        if (buttonsArray != null && buttonsArray.length() > 0) {
            val buttonsLayout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(0, 10, 0, 0)
            }
            for (i in 0 until buttonsArray.length()) {
                val btnObj = buttonsArray.optJSONObject(i) ?: continue
                val btnText = btnObj.optString("text", "")
                val btnAction = btnObj.optString("action", "")

                val actionButton = Button(this).apply {
                    this.text = btnText
                    textSize = 12f
                    setTextColor(Color.WHITE)
                    setBackgroundResource(R.drawable.btn_gradient)
                    setPadding(20, 8, 20, 8)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        setMargins(0, 6, 0, 6)
                    }
                    setOnClickListener {
                        handler.removeCallbacks(commitSpeechRunnable)
                        addMessageToChat(sender = "user", text = btnText)
                        sendToAdminVoiceApi(btnAction)
                    }
                }
                buttonsLayout.addView(actionButton)
            }
            messageLayout.addView(buttonsLayout)
        }

        chatMessagesContainer.addView(messageLayout)
        if (isChatVisible) {
            chatScrollView.visibility = View.VISIBLE
            chatScrollView.post {
                chatScrollView.fullScroll(View.FOCUS_DOWN)
            }
        }
    }

    private fun checkOverlayPermissionAndStartFloatingService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (Settings.canDrawOverlays(this)) {
                startFloatingService()
            }
        } else {
            startFloatingService()
        }
    }

    private fun startFloatingService() {
        try {
            val serviceIntent = Intent(this, FloatingWidgetService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent)
            } else {
                startService(serviceIntent)
            }
        } catch (e: Exception) {}
    }

    private fun clearSessionHistoryAndFinish() {
        handler.removeCallbacks(commitSpeechRunnable)
        Thread {
            try {
                val client = OkHttpClient()
                val json = JSONObject()
                json.put("action", "clear_session")
                json.put("userId", "android_power_button_admin")

                val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                val request = Request.Builder()
                    .url(SERVER_URL)
                    .post(body)
                    .build()

                client.newCall(request).execute()
            } catch (e: Exception) {}
        }.start()

        finish()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        restartListeningOnPowerButton()
    }

    override fun onResume() {
        super.onResume()
        if (!isListening && !isMicPaused) {
            checkPermissionAndStartListening()
        }
    }

    private fun restartListeningOnPowerButton() {
        handler.removeCallbacks(commitSpeechRunnable)
        textToSpeech?.stop()
        stopListening()
        isMicPaused = false
        tvStatus.text = "🎙️ أستمع لك... تحدث براحتك بالأمر يا أبو الأكبر"
        checkPermissionAndStartListening()
    }

    private fun stopListening() {
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.cancel()
        } catch (e: Exception) {}
        isListening = false
        progressBar.visibility = View.GONE
    }

    private fun checkPermissionAndStartListening() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), RECORD_AUDIO_REQUEST_CODE)
        } else {
            startListening()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == RECORD_AUDIO_REQUEST_CODE) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startListening()
            } else {
                tvStatus.text = "⚠️ يتطلب المساعد إذن الميكروفون"
                Toast.makeText(this, "يرجى منح إذن الميكروفون لاستخدام المساعد الصوتي", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            tvStatus.text = "⚠️ التعرف الصوتي غير متوفر بالهاتف"
            return
        }

        stopListening()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-IQ")
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar-IQ")
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "ar-IQ")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 4000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 2000L)
        }

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                isListening = true
                tvStatus.text = "🎙️ الميكروفون شغال... تحدث براحتك بالأمر"
                progressBar.visibility = View.VISIBLE
            }

            override fun onBeginningOfSpeech() {
                isListening = true
                handler.removeCallbacks(commitSpeechRunnable)
                tvStatus.text = "🎧 أستمع لصوتك الآن يا أبو الأكبر..."
            }

            override fun onRmsChanged(rmsdB: Float) {
                btnGeminiPill.setAudioRms(rmsdB)
            }

            override fun onBufferReceived(buffer: ByteArray?) {}
            
            override fun onEndOfSpeech() {
                tvStatus.text = "⚡ أستمع لك... تفضل"
            }

            override fun onError(error: Int) {
                progressBar.visibility = View.GONE

                if (!isMicPaused && pendingSpeechText.isNullOrBlank()) {
                    tvStatus.text = "🎙️ أستمع لك... تفضل بالتحدث بأمرك يا أبو الأكبر"
                    tvStatus.postDelayed({
                        if (!isMicPaused && !isListening) {
                            startListening()
                        }
                    }, 500)
                } else if (!pendingSpeechText.isNullOrBlank()) {
                    handler.removeCallbacks(commitSpeechRunnable)
                    handler.post(commitSpeechRunnable)
                }
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    val partialText = matches[0]
                    if (partialText.isNotBlank()) {
                        pendingSpeechText = partialText
                        tvStatus.text = "🗣️ $partialText"
                        handler.removeCallbacks(commitSpeechRunnable)
                        handler.postDelayed(commitSpeechRunnable, 1800L)
                    }
                }
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    val finalText = matches[0]
                    if (finalText.isNotBlank()) {
                        pendingSpeechText = finalText
                        tvStatus.text = "🗣️ $finalText"
                        handler.removeCallbacks(commitSpeechRunnable)
                        handler.postDelayed(commitSpeechRunnable, 1200L)
                    }
                } else if (!isMicPaused) {
                    tvStatus.text = "🎙️ أستمع لك... تفضل بالتحدث"
                    startListening()
                }
            }

            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        speechRecognizer?.startListening(intent)
    }

    private fun sendToAdminVoiceApi(text: String) {
        tvStatus.text = "🚀 جاري التنفيذ بالنظام..."
        progressBar.visibility = View.VISIBLE

        val client = OkHttpClient()
        val json = JSONObject()
        json.put("text", text)
        json.put("userId", "android_power_button_admin")
        json.put("history", sessionHistory)

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url(SERVER_URL)
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    progressBar.visibility = View.GONE
                    tvStatus.text = "❌ تعذر الاتصال بالسيرفر"
                    addMessageToChat(sender = "ai", text = "عذراً يا أبو الأكبر، تعذر الاتصال بالسيرفر: ${e.message}")

                    if (!isMicPaused) {
                        tvStatus.postDelayed({
                            if (!isMicPaused && !isListening) {
                                checkPermissionAndStartListening()
                            }
                        }, 2000)
                    }
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val resBody = response.body?.string() ?: ""
                runOnUiThread {
                    progressBar.visibility = View.GONE
                    try {
                        val obj = JSONObject(resBody)
                        val isOk = obj.optBoolean("ok", false)
                        if (isOk) {
                            val reply = obj.optString("reply", "")
                            tvStatus.text = "✅ تم تنفيذ الأمر بنجاح!"

                            val buttonsArray = obj.optJSONArray("buttons")
                            addMessageToChat(sender = "ai", text = reply, buttonsArray = buttonsArray)

                            val uObj = JSONObject()
                            uObj.put("role", "user")
                            uObj.put("content", text)
                            sessionHistory.put(uObj)

                            val mObj = JSONObject()
                            mObj.put("role", "model")
                            mObj.put("content", reply)
                            sessionHistory.put(mObj)

                            if (!isTtsMuted) {
                                speakOut(reply)
                            } else {
                                if (!isMicPaused) {
                                    tvStatus.postDelayed({
                                        if (!isMicPaused && !isListening) {
                                            checkPermissionAndStartListening()
                                        }
                                    }, 1500)
                                }
                            }
                        } else {
                            val errText = obj.optString("error", "فشل التنفيذ")
                            tvStatus.text = "⚠️ خطأ في المعالجة"
                            addMessageToChat(sender = "ai", text = errText)

                            if (!isMicPaused) {
                                tvStatus.postDelayed({
                                    if (!isMicPaused && !isListening) {
                                        checkPermissionAndStartListening()
                                    }
                                }, 2000)
                            }
                        }
                    } catch (e: Exception) {
                        tvStatus.text = "✅ الاستجابة:"
                        addMessageToChat(sender = "ai", text = resBody)

                        if (!isMicPaused) {
                            tvStatus.postDelayed({
                                if (!isMicPaused && !isListening) {
                                    checkPermissionAndStartListening()
                                }
                            }, 2000)
                        }
                    }
                }
            }
        })
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            textToSpeech?.language = Locale("ar")
            textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    stopListening()
                }

                override fun onDone(utteranceId: String?) {
                    runOnUiThread {
                        if (!isMicPaused) {
                            checkPermissionAndStartListening()
                        }
                    }
                }

                override fun onError(utteranceId: String?) {
                    runOnUiThread {
                        if (!isMicPaused) {
                            checkPermissionAndStartListening()
                        }
                    }
                }
            })
        }
    }

    private fun speakOut(text: String) {
        if (isTtsMuted) return
        
        // تنظيف نقي وفائق لجميع الإيموجيات والشرحات والشرطات والرموز الخاصة
        val cleanText = text
            .replace(Regex("https?://\\S+"), "")
            .replace(Regex("[*#_`~|/\\\\<>\\[\\](){}:;]"), " ")
            .replace(Regex("-+"), " ")
            .replace(Regex("[\\p{So}\\p{Cn}\\p{Cs}\\p{Sk}]"), " ")
            .replace(Regex("[\\uD83C-\\uDBFF\\uDC00-\\uDFFF]+"), " ")
            .replace("ألف", "الف")
            .replace(Regex("\\s+"), " ")
            .trim()

        if (cleanText.isBlank()) return

        val params = Bundle()
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "ai_reply_utterance")
        textToSpeech?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, params, "ai_reply_utterance")
    }

    override fun onDestroy() {
        handler.removeCallbacks(commitSpeechRunnable)
        stopListening()
        speechRecognizer?.destroy()
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        super.onDestroy()
    }
}
