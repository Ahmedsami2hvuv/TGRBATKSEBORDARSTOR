package com.aboakbar.admin

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.view.View
import android.widget.Button
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.Locale

class VoiceAssistantActivity : AppCompatActivity(), TextToSpeech.OnInitListener {

    private lateinit var tvStatus: TextView
    private lateinit var tvTranscript: TextView
    private lateinit var tvResponse: TextView
    private lateinit var progressBar: ProgressBar
    private lateinit var btnClose: Button
    private lateinit var btnRetryMic: Button

    private var speechRecognizer: SpeechRecognizer? = null
    private var textToSpeech: TextToSpeech? = null
    private val RECORD_AUDIO_REQUEST_CODE = 101
    private val SERVER_URL = "https://aboakbr.com/api/ai/admin-voice"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_voice_assistant)

        tvStatus = findViewById(R.id.tvStatus)
        tvTranscript = findViewById(R.id.tvTranscript)
        tvResponse = findViewById(R.id.tvResponse)
        progressBar = findViewById(R.id.progressBar)
        btnClose = findViewById(R.id.btnClose)
        btnRetryMic = findViewById(R.id.btnRetryMic)

        textToSpeech = TextToSpeech(this, this)

        btnClose.setOnClickListener { finish() }
        btnRetryMic.setOnClickListener { checkPermissionAndStartListening() }

        checkPermissionAndStartListening()
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
                tvStatus.text = "⚠️ يتطلب المساعد التلقائي الإذن باستخدام الميكروفون"
                Toast.makeText(this, "يرجى منح إذن الميكروفون لاستخدام المساعد الصوتي", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            tvStatus.text = "⚠️ خدمة التعرف الصوتي غير متوفرة بالهاتف"
            return
        }

        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "ar-IQ")
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "ar-IQ")
            putExtra(RecognizerIntent.EXTRA_ONLY_RETURN_LANGUAGE_PREFERENCE, "ar-IQ")
        }

        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                tvStatus.text = "🎙️ الميكروفون شغال... تفضل أتكلم بالأمر"
                progressBar.visibility = View.VISIBLE
            }

            override fun onBeginningOfSpeech() {
                tvStatus.text = "🎧 أستمع لصوتك الآن..."
            }

            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {
                tvStatus.text = "⏳ جاري تحليل وإرسال الأمر للسيرفر..."
                progressBar.visibility = View.VISIBLE
            }

            override fun onError(error: Int) {
                tvStatus.text = "⚠️ لم أتمكن من التقاط الصوت بوضوح، انقر الميكروفون وأعد المحاولة"
                progressBar.visibility = View.GONE
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    val text = matches[0]
                    tvTranscript.text = "💬 \"$text\""
                    sendToAdminVoiceApi(text)
                } else {
                    tvStatus.text = "⚠️ لم يتم التعرف على الكلمات"
                    progressBar.visibility = View.GONE
                }
            }

            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        speechRecognizer?.startListening(intent)
    }

    private fun sendToAdminVoiceApi(text: String) {
        tvStatus.text = "🚀 جاري التنفيذ والتثبيت بالنظام..."
        progressBar.visibility = View.VISIBLE

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
                            speakOut(reply)
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

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            textToSpeech?.language = Locale("ar")
        }
    }

    private fun speakOut(text: String) {
        val cleanText = text.replace(Regex("[*#\\-]|https?://\\S+"), "")
        textToSpeech?.speak(cleanText, TextToSpeech.QUEUE_FLUSH, null, null)
    }

    override fun onDestroy() {
        speechRecognizer?.destroy()
        textToSpeech?.stop()
        textToSpeech?.shutdown()
        super.onDestroy()
    }
}
