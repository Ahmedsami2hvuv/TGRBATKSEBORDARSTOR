package com.aboakbar.admin

import android.Manifest
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
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
    private lateinit var tvTranscript: TextView
    private lateinit var tvResponse: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var btnClose: Button
    private lateinit var btnMicToggle: Button
    private lateinit var btnGeminiPill: Button
    private lateinit var btnSendTextAction: Button
    private lateinit var btnKeyboardToggle: Button
    private lateinit var textInputContainer: LinearLayout
    private lateinit var etCommandInput: EditText
    private lateinit var btnSendText: Button
    private lateinit var buttonsContainer: LinearLayout
    private lateinit var btnToggleTts: Button
    private lateinit var transparentClickDismiss: View

    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    private var isTtsMuted = false
    private var isListening = false
    private var isMicPaused = false
    private val RECORD_AUDIO_REQUEST_CODE = 101
    private val SERVER_URL = "https://aboakbr.com/api/ai/admin-voice"
    private val PREFS_NAME = "AdminVoiceAssistantPrefs"
    private val KEY_TTS_MUTED = "is_tts_muted"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_voice_assistant)

        tvStatus = findViewById(R.id.tvStatus)
        tvTranscript = findViewById(R.id.tvTranscript)
        tvResponse = findViewById(R.id.tvResponse)
        progressBar = findViewById(R.id.progressBar)
        btnClose = findViewById(R.id.btnClose)
        btnMicToggle = findViewById(R.id.btnMicToggle)
        btnGeminiPill = findViewById(R.id.btnGeminiPill)
        btnSendTextAction = findViewById(R.id.btnSendTextAction)
        btnKeyboardToggle = findViewById(R.id.btnKeyboardToggle)
        textInputContainer = findViewById(R.id.textInputContainer)
        etCommandInput = findViewById(R.id.etCommandInput)
        btnSendText = findViewById(R.id.btnSendText)
        buttonsContainer = findViewById(R.id.buttonsContainer)
        btnToggleTts = findViewById(R.id.btnToggleTts)
        transparentClickDismiss = findViewById(R.id.transparentClickDismiss)

        // جلب تفضيل كتم الصوت المحفوظ دائماً
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        isTtsMuted = prefs.getBoolean(KEY_TTS_MUTED, false)
        updateTtsButtonUi()

        textToSpeech = TextToSpeech(this, this)

        btnClose.setOnClickListener { finish() }
        transparentClickDismiss.setOnClickListener { finish() }

        btnMicToggle.setOnClickListener {
            if (isListening) {
                stopListening()
                isMicPaused = true
                tvStatus.text = "🛑 الميكروفون متوقف - اكتب بالنص"
                btnMicToggle.text = "🔇"
                Toast.makeText(this, "تم إيقاف الميكروفون", Toast.LENGTH_SHORT).show()
            } else {
                isMicPaused = false
                btnMicToggle.text = "🎙️"
                checkPermissionAndStartListening()
            }
        }

        btnGeminiPill.setOnClickListener {
            if (!isListening) {
                isMicPaused = false
                btnMicToggle.text = "🎙️"
                checkPermissionAndStartListening()
            }
        }

        btnSendTextAction.setOnClickListener {
            val typedText = etCommandInput.text.toString().trim()
            if (typedText.isNotEmpty()) {
                tvTranscript.text = "💬 \"$typedText\""
                etCommandInput.setText("")
                sendToAdminVoiceApi(typedText)
            } else {
                if (textInputContainer.visibility != View.VISIBLE) {
                    textInputContainer.visibility = View.VISIBLE
                } else {
                    Toast.makeText(this, "يرجى كتابة الأمر النصي أولاً", Toast.LENGTH_SHORT).show()
                }
            }
        }

        btnKeyboardToggle.setOnClickListener {
            if (textInputContainer.visibility == View.VISIBLE) {
                textInputContainer.visibility = View.GONE
            } else {
                textInputContainer.visibility = View.VISIBLE
            }
        }

        // قفل وتشغيل القراءة الصوتية وحفظها بشكل دائم في SharedPreferences
        btnToggleTts.setOnClickListener {
            isTtsMuted = !isTtsMuted
            getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().putBoolean(KEY_TTS_MUTED, isTtsMuted).apply()
            updateTtsButtonUi()

            if (isTtsMuted) {
                textToSpeech?.stop()
                Toast.makeText(this, "تم قفل وكتم القراءة الصوتية دائماً", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, "تم تشغيل وتفعيل القراءة الصوتية", Toast.LENGTH_SHORT).show()
            }
        }

        btnSendText.setOnClickListener {
            val typedText = etCommandInput.text.toString().trim()
            if (typedText.isNotEmpty()) {
                tvTranscript.text = "💬 \"$typedText\""
                etCommandInput.setText("")
                sendToAdminVoiceApi(typedText)
            } else {
                Toast.makeText(this, "يرجى كتابة الأمر أولاً", Toast.LENGTH_SHORT).show()
            }
        }

        checkOverlayPermissionAndStartFloatingService()
        checkPermissionAndStartListening()
    }

    private fun checkOverlayPermissionAndStartFloatingService() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:$packageName")
                )
                startActivity(intent)
            } else {
                startService(Intent(this, FloatingWidgetService::class.java))
            }
        } else {
            startService(Intent(this, FloatingWidgetService::class.java))
        }
    }

    private fun updateTtsButtonUi() {
        if (isTtsMuted) {
            btnToggleTts.text = "🔇 مكتوم"
            btnToggleTts.setBackgroundColor(Color.parseColor("#64748B"))
        } else {
            btnToggleTts.text = "🔊 مفعل"
            btnToggleTts.setBackgroundColor(Color.parseColor("#0284C7"))
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        restartListeningOnPowerButton()
    }

    override fun onResume() {
        super.onResume()
        if (!isListening && !isMicPaused && speechRecognizer != null) {
            checkPermissionAndStartListening()
        }
    }

    private fun restartListeningOnPowerButton() {
        textToSpeech?.stop()
        stopListening()
        isMicPaused = false
        btnMicToggle.text = "🎙️"
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
        btnGeminiPill.animate().scaleX(1.0f).scaleY(1.0f).setDuration(100).start()
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
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 15000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 15000L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 15000L)
        }

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                isListening = true
                tvStatus.text = "🎙️ الميكروفون شغال... تحدث براحتك بالأمر"
                progressBar.visibility = View.VISIBLE
            }

            override fun onBeginningOfSpeech() {
                isListening = true
                tvStatus.text = "🎧 أستمع لصوتك الآن يا أبو الأكبر..."
            }

            override fun onRmsChanged(rmsdB: Float) {
                // الحركة التفاعلية الرائعة بالألوان والحجم مع درجة نبرة صوت الميكروفون
                val scale = 1.0f + (rmsdB.coerceIn(0f, 10f) / 20.0f)
                btnGeminiPill.animate()
                    .scaleX(scale)
                    .scaleY(scale)
                    .setDuration(70)
                    .start()
            }

            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {
                isListening = false
                tvStatus.text = "⚡ جاري معالجة وإرسال الأمر..."
                progressBar.visibility = View.VISIBLE
                btnGeminiPill.animate().scaleX(1.0f).scaleY(1.0f).setDuration(100).start()
            }

            override fun onError(error: Int) {
                isListening = false
                progressBar.visibility = View.GONE
                btnGeminiPill.animate().scaleX(1.0f).scaleY(1.0f).setDuration(100).start()

                if (!isMicPaused) {
                    tvStatus.text = "🎙️ أستمع لك... تفضل بالتحدث بأمرك يا أبو الأكبر"
                    tvStatus.postDelayed({
                        if (!isMicPaused && !isListening) {
                            startListening()
                        }
                    }, 500)
                } else {
                    tvStatus.text = "🛑 الميكروفون متوقف - انقر للتحدث"
                }
            }

            override fun onResults(results: Bundle?) {
                isListening = false
                btnGeminiPill.animate().scaleX(1.0f).scaleY(1.0f).setDuration(100).start()
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    val text = matches[0]
                    tvTranscript.text = "💬 \"$text\""
                    sendToAdminVoiceApi(text)
                } else {
                    if (!isMicPaused) {
                        tvStatus.text = "🎙️ أستمع لك... تفضل بالتحدث"
                        startListening()
                    }
                }
            }

            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        speechRecognizer?.startListening(intent)
    }

    private fun sendToAdminVoiceApi(text: String) {
        tvStatus.text = "🚀 جاري التنفيذ بالتطبيق..."
        progressBar.visibility = View.VISIBLE
        buttonsContainer.removeAllViews()

        val client = OkHttpClient()
        val json = JSONObject()
        json.put("text", text)
        json.put("userId", "android_power_button_admin")

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
                    tvResponse.text = e.message ?: "خطأ بالاتصال"
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
                            tvResponse.text = reply

                            if (!isTtsMuted) {
                                speakOut(reply)
                            }

                            val buttonsArray = obj.optJSONArray("buttons")
                            renderDynamicButtons(buttonsArray)
                        } else {
                            val errText = obj.optString("error", "فشل التنفيذ")
                            tvStatus.text = "⚠️ خطأ في المعالجة"
                            tvResponse.text = errText
                        }
                    } catch (e: Exception) {
                        tvStatus.text = "✅ الاستجابة:"
                        tvResponse.text = resBody
                    }
                }
            }
        })
    }

    private fun renderDynamicButtons(buttonsArray: JSONArray?) {
        buttonsContainer.removeAllViews()
        if (buttonsArray == null || buttonsArray.length() == 0) return

        for (i in 0 until buttonsArray.length()) {
            val btnObj = buttonsArray.optJSONObject(i) ?: continue
            val btnText = btnObj.optString("text", "")
            val btnAction = btnObj.optString("action", "")

            val actionBtn = Button(this).apply {
                text = btnText
                textSize = 14f
                setTextColor(Color.WHITE)
                setBackgroundColor(Color.parseColor("#0284C7"))
                setPadding(14, 10, 14, 10)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    setMargins(0, 6, 0, 6)
                }

                setOnClickListener {
                    tvTranscript.text = "💬 \"$btnText\""
                    sendToAdminVoiceApi(btnText)
                }
            }
            buttonsContainer.addView(actionBtn)
        }
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            textToSpeech?.language = Locale("ar")
        }
    }

    private fun speakOut(text: String) {
        if (isTtsMuted) return
        val cleanText = text.replace(Regex("[*#\\-]|https?://\\S+"), "")
        textToSpeech?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, null, null)
    }

    override fun onDestroy() {
        stopListening()
        speechRecognizer?.destroy()
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        super.onDestroy()
    }
}
