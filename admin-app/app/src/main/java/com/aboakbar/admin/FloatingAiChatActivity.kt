package com.aboakbar.admin

import android.content.Context
import android.content.Intent
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
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.Locale

class FloatingAiChatActivity : AppCompatActivity(), TextToSpeech.OnInitListener {

    private lateinit var tvFloatingStatus: TextView
    private lateinit var floatingProgressBar: ProgressBar
    private lateinit var floatingChatScrollView: ScrollView
    private lateinit var floatingChatContainer: LinearLayout
    private lateinit var etFloatingInput: EditText
    private lateinit var btnFloatingMic: ImageButton
    private lateinit var btnFloatingVoiceToggle: ImageButton
    private lateinit var btnFloatingTrashClear: ImageButton
    private lateinit var btnFloatingClose: ImageButton
    private lateinit var btnFloatingSend: Button

    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    private var isTtsMuted = false
    private var isListening = false
    private var isMicPaused = false

    private val SERVER_URL = "https://aboakbr.com/api/ai/admin-voice"
    private val PREFS_NAME = "FloatingAiChatPrefs"
    private val KEY_TTS_MUTED = "is_tts_muted"

    companion object {
        data class ChatMessage(
            val sender: String,
            val text: String,
            val buttonsJsonStr: String? = null
        )
        val persistentChatHistory = mutableListOf<ChatMessage>()
        val serverSessionHistory = JSONArray()
    }

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
        
        Thread.setDefaultUncaughtExceptionHandler { _, _ -> }

        try {
            // طلب إذن الظهور فوق التطبيقات إذا لم يكن ممنوحاً لضمان ظهور الزر العائم
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
                Toast.makeText(this, "يرجى تفعيل إذن الظهور فوق التطبيقات لظهور الزر العائم 🚀", Toast.LENGTH_LONG).show()
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                startActivity(intent)
            }

            setContentView(R.layout.activity_floating_ai_chat)

            window?.setLayout(
                (resources.displayMetrics.widthPixels * 0.94).toInt(),
                ViewGroup.LayoutParams.WRAP_CONTENT
            )

            tvFloatingStatus = findViewById(R.id.tvFloatingStatus)
            floatingProgressBar = findViewById(R.id.floatingProgressBar)
            floatingChatScrollView = findViewById(R.id.floatingChatScrollView)
            floatingChatContainer = findViewById(R.id.floatingChatContainer)
            etFloatingInput = findViewById(R.id.etFloatingInput)
            btnFloatingMic = findViewById(R.id.btnFloatingMic)
            btnFloatingVoiceToggle = findViewById(R.id.btnFloatingVoiceToggle)
            btnFloatingTrashClear = findViewById(R.id.btnFloatingTrashClear)
            btnFloatingClose = findViewById(R.id.btnFloatingClose)
            btnFloatingSend = findViewById(R.id.btnFloatingSend)

            val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            isTtsMuted = prefs.getBoolean(KEY_TTS_MUTED, false)
            updateVoiceButtonUi()

            textToSpeech = TextToSpeech(this, this)

            // زر الإغلاق: يغلق النافذة ويظهر الزر العائم مكانه فوراً
            btnFloatingClose.setOnClickListener {
                closeQuietly()
            }

            // زر كتم/تشغيل الصوت
            btnFloatingVoiceToggle.setOnClickListener {
                isTtsMuted = !isTtsMuted
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_TTS_MUTED, isTtsMuted).apply()
                updateVoiceButtonUi()
                if (isTtsMuted) {
                    textToSpeech?.stop()
                    Toast.makeText(this, "🔇 تم كتم صوت المساعد", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, "🔊 تم تشغيل صوت المساعد", Toast.LENGTH_SHORT).show()
                }
            }

            // زر مسح وتصفير الدردشة
            btnFloatingTrashClear.setOnClickListener {
                handler.removeCallbacks(commitSpeechRunnable)
                pendingSpeechText = null
                textToSpeech?.stop()
                floatingChatContainer.removeAllViews()
                persistentChatHistory.clear()

                while (serverSessionHistory.length() > 0) {
                    serverSessionHistory.remove(0)
                }

                Thread {
                    try {
                        val client = OkHttpClient()
                        val json = JSONObject()
                        json.put("action", "clear_session")
                        json.put("userId", "android_floating_window_admin")

                        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                        val request = Request.Builder()
                            .url(SERVER_URL)
                            .post(body)
                            .build()

                        client.newCall(request).execute()
                    } catch (e: Exception) {}
                }.start()

                addMessageToChat(
                    sender = "ai",
                    text = "تم تصفير سجل الدردشة والبدء بجلسة جديدة يا أبو الأكبر! تفضل بأمرك الجديد 🚀",
                    saveToPersistent = true
                )
                Toast.makeText(this, "🗑️ تم مسح سجل المحادثة", Toast.LENGTH_SHORT).show()
            }

            // زر المايكروفون
            btnFloatingMic.setOnClickListener {
                if (isListening) {
                    handler.removeCallbacks(commitSpeechRunnable)
                    pendingSpeechText = null
                    stopListening()
                    isMicPaused = true
                    tvFloatingStatus.text = "🛑 الميكروفون متوقف - انقر للتشغيل"
                } else {
                    isMicPaused = false
                    safelyRestartSpeechRecognizer()
                }
            }

            // زر الإرسال النصي
            btnFloatingSend.setOnClickListener {
                handler.removeCallbacks(commitSpeechRunnable)
                val typedText = etFloatingInput.text.toString().trim()
                if (typedText.isNotEmpty()) {
                    etFloatingInput.setText("")
                    hideKeyboard()
                    addMessageToChat(sender = "user", text = typedText)
                    sendToAdminVoiceApi(typedText)
                } else {
                    Toast.makeText(this, "يرجى كتابة الأمر أو لصق الرقم أولاً", Toast.LENGTH_SHORT).show()
                }
            }

            // استرجاع الدردشة السابقة
            if (persistentChatHistory.isNotEmpty()) {
                for (msg in persistentChatHistory) {
                    val btns = if (!msg.buttonsJsonStr.isNullOrBlank()) {
                        try { JSONArray(msg.buttonsJsonStr) } catch (e: Exception) { null }
                    } else null
                    addMessageToChat(
                        sender = msg.sender,
                        text = msg.text,
                        buttonsArray = btns,
                        saveToPersistent = false
                    )
                }
            } else {
                addMessageToChat(
                    sender = "ai",
                    text = "أهلاً بك يا أبو الأكبر! المساعد العائم جاهز لتنفيذ أوامرك فوراً بالصوت أو الكتابة 🚀",
                    saveToPersistent = true
                )
            }

            safelyRestartSpeechRecognizer()

        } catch (e: Exception) {}
    }

    private fun updateVoiceButtonUi() {
        if (isTtsMuted) {
            btnFloatingVoiceToggle.setImageResource(android.R.drawable.ic_lock_silent_mode)
            btnFloatingVoiceToggle.setColorFilter(Color.parseColor("#94A3B8"))
        } else {
            btnFloatingVoiceToggle.setImageResource(android.R.drawable.ic_lock_silent_mode_off)
            btnFloatingVoiceToggle.setColorFilter(Color.parseColor("#38BDF8"))
        }
    }

    private fun hideKeyboard() {
        val imm = getSystemService(Context.INPUT_METHOD_SERVICE) as? InputMethodManager
        imm?.hideSoftInputFromWindow(etFloatingInput.windowToken, 0)
    }

    private fun showFloatingBubble() {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)) {
                val bubbleIntent = Intent(this, FloatingBubbleService::class.java)
                startService(bubbleIntent)
            }
        } catch (e: Exception) {}
    }

    private fun closeQuietly() {
        try {
            handler.removeCallbacks(commitSpeechRunnable)
            pendingSpeechText = null
            stopListening()
            textToSpeech?.stop()
        } catch (e: Exception) {}
        showFloatingBubble()
        finish()
    }

    override fun onBackPressed() {
        closeQuietly()
    }

    override fun onResume() {
        super.onResume()
        // إخفاء الزر العائم أثناء فتح نافذة الدردشة حتى لا يغطي الشاشة
        try {
            stopService(Intent(this, FloatingBubbleService::class.java))
        } catch (e: Exception) {}

        tvFloatingStatus.text = "🎙️ تفضل بالتحدث أو كتابة أمرك..."
        if (!isMicPaused && !isFinishing) {
            safelyRestartSpeechRecognizer()
        }
    }

    override fun onPause() {
        super.onPause()
        try {
            handler.removeCallbacks(commitSpeechRunnable)
            pendingSpeechText = null
            stopListening()
            textToSpeech?.stop()
        } catch (e: Exception) {}
    }

    override fun onStop() {
        super.onStop()
        // إذا خرج المستخدم من النافذة (مثلاً زر الهوم للذهاب للواتساب) نظهر الزر العائم فوق التطبيقات
        if (!isFinishing) {
            showFloatingBubble()
        }
    }

    private fun addMessageToChat(
        sender: String,
        text: String,
        buttonsArray: JSONArray? = null,
        saveToPersistent: Boolean = true
    ) {
        if (saveToPersistent) {
            persistentChatHistory.add(
                ChatMessage(sender, text, buttonsArray?.toString())
            )
        }

        val messageLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(18, 12, 18, 12)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 6, 0, 6)
            }
        }

        val bubbleBackground = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 24f
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
            textSize = 10.5f
            setTextColor(if (sender == "user") Color.parseColor("#BAE6FD") else Color.parseColor("#38BDF8"))
            setPadding(0, 0, 0, 4)
        }
        messageLayout.addView(tvSender)

        val tvText = TextView(this).apply {
            this.text = text
            textSize = 12.5f
            setTextColor(Color.parseColor("#F8FAFC"))
            setLineSpacing(3f, 1f)
        }
        messageLayout.addView(tvText)

        if (buttonsArray != null && buttonsArray.length() > 0) {
            val buttonsLayout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(0, 8, 0, 0)
            }
            for (i in 0 until buttonsArray.length()) {
                val btnObj = buttonsArray.optJSONObject(i) ?: continue
                val btnText = btnObj.optString("text", "")
                val btnAction = btnObj.optString("action", "")

                val actionButton = Button(this).apply {
                    this.text = btnText
                    textSize = 11.5f
                    setTextColor(Color.WHITE)
                    setBackgroundResource(R.drawable.btn_gradient)
                    setPadding(16, 6, 16, 6)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        setMargins(0, 4, 0, 4)
                    }
                    setOnClickListener {
                        handler.removeCallbacks(commitSpeechRunnable)
                        if (btnAction.startsWith("tel:")) {
                            try {
                                val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse(btnAction)).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                startActivity(dialIntent)
                            } catch (e: Exception) {}
                        } else if (btnAction.startsWith("https://wa.me/") || btnAction.startsWith("https://")) {
                            try {
                                val webIntent = Intent(Intent.ACTION_VIEW, Uri.parse(btnAction)).apply {
                                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                }
                                startActivity(webIntent)
                            } catch (e: Exception) {}
                        } else {
                            addMessageToChat(sender = "user", text = btnText)
                            sendToAdminVoiceApi(btnAction)
                        }
                    }
                }
                buttonsLayout.addView(actionButton)
            }
            messageLayout.addView(buttonsLayout)
        }

        floatingChatContainer.addView(messageLayout)
        floatingChatScrollView.post {
            floatingChatScrollView.fullScroll(View.FOCUS_DOWN)
        }
    }

    private fun sendToAdminVoiceApi(text: String) {
        tvFloatingStatus.text = "⏳ جاري التنفيذ..."
        floatingProgressBar.visibility = View.VISIBLE

        val client = OkHttpClient()
        val json = JSONObject()
        json.put("text", text)
        json.put("userId", "android_floating_window_admin")
        json.put("history", serverSessionHistory)

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url(SERVER_URL)
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                handler.post {
                    floatingProgressBar.visibility = View.GONE
                    tvFloatingStatus.text = "🎙️ تفضل بالتحدث أو كتابة أمرك..."
                    addMessageToChat(sender = "ai", text = "عذراً يا أبو الأكبر، تعذر الاتصال بالسيرفر: ${e.message}")
                    if (!isMicPaused && !isFinishing) {
                        handler.postDelayed({
                            if (!isMicPaused && !isFinishing && !isListening) {
                                safelyRestartSpeechRecognizer()
                            }
                        }, 2000L)
                    }
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val resStr = response.body?.string() ?: ""
                handler.post {
                    floatingProgressBar.visibility = View.GONE
                    tvFloatingStatus.text = "🎙️ تفضل بالتحدث أو كتابة أمرك..."

                    try {
                        val obj = JSONObject(resStr)
                        val ok = obj.optBoolean("ok", false)
                        val reply = obj.optString("reply", "")
                        val buttons = obj.optJSONArray("buttons")

                        if (ok && reply.isNotEmpty()) {
                            addMessageToChat(sender = "ai", text = reply, buttonsArray = buttons)

                            val histUser = JSONObject().apply {
                                put("sender", "user")
                                put("text", text)
                            }
                            val histAi = JSONObject().apply {
                                put("sender", "ai")
                                put("text", reply)
                            }
                            serverSessionHistory.put(histUser)
                            serverSessionHistory.put(histAi)

                            speakOut(reply)
                        } else {
                            val err = obj.optString("message", obj.optString("error", "حدث خطأ غير متوقع"))
                            addMessageToChat(sender = "ai", text = err)
                            if (!isMicPaused && !isFinishing) {
                                safelyRestartSpeechRecognizer()
                            }
                        }
                    } catch (e: Exception) {
                        addMessageToChat(sender = "ai", text = "استجابة غير مفهومة من السيرفر")
                        if (!isMicPaused && !isFinishing) {
                            safelyRestartSpeechRecognizer()
                        }
                    }
                }
            }
        })
    }

    private fun safelyRestartSpeechRecognizer() {
        if (isMicPaused || isFinishing) return
        try {
            stopListening()
            initSpeechRecognizerIfNeeded()
            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-IQ")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar-IQ")
                putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "ar-IQ")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3500L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
                putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1500L)
            }
            speechRecognizer?.startListening(intent)
        } catch (e: Exception) {}
    }

    private fun stopListening() {
        isListening = false
        try {
            speechRecognizer?.stopListening()
            speechRecognizer?.cancel()
        } catch (e: Exception) {}
        floatingProgressBar.visibility = View.GONE
    }

    private fun initSpeechRecognizerIfNeeded() {
        if (speechRecognizer != null) return
        if (!SpeechRecognizer.isRecognitionAvailable(this)) return

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    isListening = true
                    tvFloatingStatus.text = "🎙️ تفضل بالتحدث..."
                }

                override fun onBeginningOfSpeech() {
                    isListening = true
                    handler.removeCallbacks(commitSpeechRunnable)
                }

                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {
                    isListening = false
                }

                override fun onError(error: Int) {
                    isListening = false
                    if (!isMicPaused && !isFinishing) {
                        handler.postDelayed({
                            if (!isMicPaused && !isFinishing && !isListening) {
                                safelyRestartSpeechRecognizer()
                            }
                        }, 1500L)
                    }
                }

                override fun onResults(results: Bundle?) {
                    isListening = false
                    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (!matches.isNullOrEmpty()) {
                        val text = matches[0].trim()
                        if (text.isNotEmpty()) {
                            pendingSpeechText = text
                            handler.post(commitSpeechRunnable)
                        }
                    } else if (!isMicPaused && !isFinishing) {
                        safelyRestartSpeechRecognizer()
                    }
                }

                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (!matches.isNullOrEmpty()) {
                        val partial = matches[0].trim()
                        if (partial.isNotEmpty()) {
                            tvFloatingStatus.text = "🗣️ $partial"
                            pendingSpeechText = partial
                            handler.removeCallbacks(commitSpeechRunnable)
                            handler.postDelayed(commitSpeechRunnable, 1800L)
                        }
                    }
                }

                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            textToSpeech?.language = Locale("ar")
            textToSpeech?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {
                    handler.post { stopListening() }
                }

                override fun onDone(utteranceId: String?) {
                    handler.post {
                        if (!isMicPaused && !isFinishing) {
                            safelyRestartSpeechRecognizer()
                        }
                    }
                }

                override fun onError(utteranceId: String?) {
                    handler.post {
                        if (!isMicPaused && !isFinishing) {
                            safelyRestartSpeechRecognizer()
                        }
                    }
                }
            })
        }
    }

    private fun speakOut(text: String) {
        if (isTtsMuted) return
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
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "floating_chat_reply")
        textToSpeech?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, params, "floating_chat_reply")
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(commitSpeechRunnable)
        stopListening()
        try {
            speechRecognizer?.destroy()
            speechRecognizer = null
        } catch (e: Exception) {}

        try {
            textToSpeech?.stop()
            textToSpeech?.shutdown()
            textToSpeech = null
        } catch (e: Exception) {}
    }
}
