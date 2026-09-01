package com.aboakbar.admin

import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.Locale

class FloatingWidgetService : Service(), TextToSpeech.OnInitListener {

    private var windowManager: WindowManager? = null
    private var bubbleView: View? = null
    private var bubbleParams: WindowManager.LayoutParams? = null

    private var chatOverlayView: View? = null
    private var chatOverlayParams: WindowManager.LayoutParams? = null

    private var isChatExpanded = false

    // عناصر نافذة الدردشة العائمة
    private var tvFloatingStatus: TextView? = null
    private var floatingProgressBar: ProgressBar? = null
    private var floatingChatContainer: LinearLayout? = null
    private var floatingChatScrollView: ScrollView? = null
    private var etFloatingInput: EditText? = null
    private var btnFloatingMic: ImageButton? = null
    private var btnFloatingVoiceToggle: ImageButton? = null

    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    private var isTtsMuted = false
    private var isListening = false
    private var isMicPaused = false

    private val SERVER_URL = "https://aboakbr.com/api/ai/admin-voice"
    private val PREFS_NAME = "AdminVoiceAssistantPrefs"
    private val KEY_TTS_MUTED = "is_tts_muted"

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

    private var initialX: Int = 0
    private var initialY: Int = 0
    private var initialTouchX: Float = 0f
    private var initialTouchY: Float = 0f
    private var isClick: Boolean = false
    private var longClickRunnable: Runnable? = null
    private var isLongClickHandled = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()

        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        isTtsMuted = prefs.getBoolean(KEY_TTS_MUTED, false)
        textToSpeech = TextToSpeech(this, this)

        initBubbleView()
        initChatOverlayView()
    }

    private fun initBubbleView() {
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

        bubbleView = bubbleText

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        bubbleParams = WindowManager.LayoutParams(
            145, // width
            145, // height
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
                if (event == null || bubbleParams == null) return false

                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = bubbleParams!!.x
                        initialY = bubbleParams!!.y
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

                        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
                            isClick = false
                            longClickRunnable?.let { handler.removeCallbacks(it) }
                        }

                        bubbleParams!!.x = initialX + diffX
                        bubbleParams!!.y = initialY + diffY
                        windowManager?.updateViewLayout(bubbleView, bubbleParams)
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        longClickRunnable?.let { handler.removeCallbacks(it) }
                        if (isClick && !isLongClickHandled) {
                            expandChatOverlay()
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
            windowManager?.addView(bubbleView, bubbleParams)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun initChatOverlayView() {
        val inflater = getSystemService(Context.LAYOUT_INFLATER_SERVICE) as LayoutInflater
        chatOverlayView = inflater.inflate(R.layout.floating_chat_overlay, null)

        tvFloatingStatus = chatOverlayView?.findViewById(R.id.tvFloatingStatus)
        floatingProgressBar = chatOverlayView?.findViewById(R.id.floatingProgressBar)
        floatingChatContainer = chatOverlayView?.findViewById(R.id.floatingChatContainer)
        floatingChatScrollView = chatOverlayView?.findViewById(R.id.floatingChatScrollView)
        etFloatingInput = chatOverlayView?.findViewById(R.id.etFloatingInput)
        btnFloatingMic = chatOverlayView?.findViewById(R.id.btnFloatingMic)
        btnFloatingVoiceToggle = chatOverlayView?.findViewById(R.id.btnFloatingVoiceToggle)

        val btnFloatingMinimize = chatOverlayView?.findViewById<ImageButton>(R.id.btnFloatingMinimize)
        val btnFloatingTrashClear = chatOverlayView?.findViewById<ImageButton>(R.id.btnFloatingTrashClear)
        val btnFloatingSend = chatOverlayView?.findViewById<Button>(R.id.btnFloatingSend)

        updateVoiceButtonUi()

        // زر تصغير النافذة للفقاعة
        btnFloatingMinimize?.setOnClickListener {
            collapseChatOverlay()
        }

        // زر كتم/تشغيل الصوت
        btnFloatingVoiceToggle?.setOnClickListener {
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
        btnFloatingTrashClear?.setOnClickListener {
            handler.removeCallbacks(commitSpeechRunnable)
            pendingSpeechText = null
            textToSpeech?.stop()
            floatingChatContainer?.removeAllViews()
            VoiceAssistantActivity.persistentChatMessages.clear()

            while (VoiceAssistantActivity.sessionHistory.length() > 0) {
                VoiceAssistantActivity.sessionHistory.remove(0)
            }

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

            addMessageToChat(
                sender = "ai",
                text = "تم تصفير سجل الدردشة والبدء بجلسة جديدة يا أبو الأكبر! تفضل بأمرك الجديد 🚀",
                saveToPersistent = true
            )
            Toast.makeText(this, "🗑️ تم مسح سجل المحادثة", Toast.LENGTH_SHORT).show()
        }

        // زر المايكروفون
        btnFloatingMic?.setOnClickListener {
            if (isListening) {
                handler.removeCallbacks(commitSpeechRunnable)
                pendingSpeechText = null
                stopListening()
                isMicPaused = true
                tvFloatingStatus?.text = "🛑 الميكروفون متوقف - انقر للتشغيل"
            } else {
                isMicPaused = false
                safelyRestartSpeechRecognizer()
            }
        }

        // زر الإرسال النصي
        btnFloatingSend?.setOnClickListener {
            handler.removeCallbacks(commitSpeechRunnable)
            val typedText = etFloatingInput?.text.toString().trim()
            if (typedText.isNotEmpty()) {
                etFloatingInput?.setText("")
                addMessageToChat(sender = "user", text = typedText)
                sendToAdminVoiceApi(typedText)
            } else {
                Toast.makeText(this, "يرجى كتابة النص أو الرقم أولاً", Toast.LENGTH_SHORT).show()
            }
        }

        val displayMetrics = resources.displayMetrics
        val overlayWidth = (displayMetrics.widthPixels * 0.92).toInt()

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        chatOverlayParams = WindowManager.LayoutParams(
            overlayWidth,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER_HORIZONTAL or Gravity.BOTTOM
            y = 120
        }

        // استرجاع الدردشة السابقة
        renderPersistedMessages()
    }

    private fun updateVoiceButtonUi() {
        if (isTtsMuted) {
            btnFloatingVoiceToggle?.setImageResource(android.R.drawable.ic_lock_silent_mode)
            btnFloatingVoiceToggle?.setColorFilter(Color.parseColor("#94A3B8"))
        } else {
            btnFloatingVoiceToggle?.setImageResource(android.R.drawable.ic_lock_silent_mode_off)
            btnFloatingVoiceToggle?.setColorFilter(Color.parseColor("#38BDF8"))
        }
    }

    private fun renderPersistedMessages() {
        floatingChatContainer?.removeAllViews()
        if (VoiceAssistantActivity.persistentChatMessages.isNotEmpty()) {
            for (msg in VoiceAssistantActivity.persistentChatMessages) {
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
    }

    private fun expandChatOverlay() {
        if (isChatExpanded) return
        isChatExpanded = true

        try {
            bubbleView?.visibility = View.GONE
            if (chatOverlayView?.parent == null) {
                renderPersistedMessages()
                windowManager?.addView(chatOverlayView, chatOverlayParams)
            } else {
                renderPersistedMessages()
                chatOverlayView?.visibility = View.VISIBLE
            }

            tvFloatingStatus?.text = "🎙️ تفضل بالتحدث..."
            if (!isMicPaused) {
                safelyRestartSpeechRecognizer()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun collapseChatOverlay() {
        if (!isChatExpanded) return
        isChatExpanded = false

        handler.removeCallbacks(commitSpeechRunnable)
        pendingSpeechText = null
        stopListening()
        textToSpeech?.stop()

        try {
            if (chatOverlayView?.parent != null) {
                windowManager?.removeView(chatOverlayView)
            }
            bubbleView?.visibility = View.VISIBLE
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun addMessageToChat(
        sender: String,
        text: String,
        buttonsArray: JSONArray? = null,
        saveToPersistent: Boolean = true
    ) {
        if (saveToPersistent) {
            VoiceAssistantActivity.persistentChatMessages.add(
                VoiceAssistantActivity.Companion.SavedChatMessage(sender, text, buttonsArray?.toString())
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

        floatingChatContainer?.addView(messageLayout)
        floatingChatScrollView?.post {
            floatingChatScrollView?.fullScroll(View.FOCUS_DOWN)
        }
    }

    private fun sendToAdminVoiceApi(text: String) {
        tvFloatingStatus?.text = "⏳ جاري التنفيذ..."
        floatingProgressBar?.visibility = View.VISIBLE

        val client = OkHttpClient()
        val json = JSONObject()
        json.put("text", text)
        json.put("userId", "android_power_button_admin")
        json.put("history", VoiceAssistantActivity.sessionHistory)

        val body = json.toString().toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder()
            .url(SERVER_URL)
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                handler.post {
                    floatingProgressBar?.visibility = View.GONE
                    tvFloatingStatus?.text = "🎙️ تفضل بالتحدث..."
                    addMessageToChat(sender = "ai", text = "عذراً يا أبو الأكبر، تعذر الاتصال بالسيرفر: ${e.message}")

                    if (isChatExpanded && !isMicPaused) {
                        handler.postDelayed({
                            if (isChatExpanded && !isMicPaused && !isListening) {
                                safelyRestartSpeechRecognizer()
                            }
                        }, 2000L)
                    }
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val resStr = response.body?.string() ?: ""
                handler.post {
                    floatingProgressBar?.visibility = View.GONE
                    tvFloatingStatus?.text = "🎙️ تفضل بالتحدث..."

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
                            VoiceAssistantActivity.sessionHistory.put(histUser)
                            VoiceAssistantActivity.sessionHistory.put(histAi)

                            speakOut(reply)
                        } else {
                            val err = obj.optString("message", obj.optString("error", "حدث خطأ غير متوقع"))
                            addMessageToChat(sender = "ai", text = err)
                            if (isChatExpanded && !isMicPaused) {
                                safelyRestartSpeechRecognizer()
                            }
                        }
                    } catch (e: Exception) {
                        addMessageToChat(sender = "ai", text = "استجابة غير مفهومة من السيرفر")
                        if (isChatExpanded && !isMicPaused) {
                            safelyRestartSpeechRecognizer()
                        }
                    }
                }
            }
        })
    }

    private fun safelyRestartSpeechRecognizer() {
        if (!isChatExpanded || isMicPaused) return
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
        floatingProgressBar?.visibility = View.GONE
    }

    private fun initSpeechRecognizerIfNeeded() {
        if (speechRecognizer != null) return
        if (!SpeechRecognizer.isRecognitionAvailable(this)) return

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
            setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    isListening = true
                    tvFloatingStatus?.text = "🎙️ تفضل بالتحدث..."
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
                    if (isChatExpanded && !isMicPaused) {
                        handler.postDelayed({
                            if (isChatExpanded && !isMicPaused && !isListening) {
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
                    } else if (isChatExpanded && !isMicPaused) {
                        safelyRestartSpeechRecognizer()
                    }
                }

                override fun onPartialResults(partialResults: Bundle?) {
                    val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (!matches.isNullOrEmpty()) {
                        val partial = matches[0].trim()
                        if (partial.isNotEmpty()) {
                            tvFloatingStatus?.text = "🗣️ $partial"
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
                        if (isChatExpanded && !isMicPaused) {
                            safelyRestartSpeechRecognizer()
                        }
                    }
                }

                override fun onError(utteranceId: String?) {
                    handler.post {
                        if (isChatExpanded && !isMicPaused) {
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
        params.putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, "floating_ai_reply")
        textToSpeech?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, params, "floating_ai_reply")
    }

    override fun onDestroy() {
        super.onDestroy()
        longClickRunnable?.let { handler.removeCallbacks(it) }
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

        if (bubbleView != null && windowManager != null) {
            try {
                windowManager?.removeView(bubbleView)
            } catch (e: Exception) {}
        }
        if (chatOverlayView != null && windowManager != null) {
            try {
                windowManager?.removeView(chatOverlayView)
            } catch (e: Exception) {}
        }
    }
}
