package com.aboakbar.admin

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity

class FloatingAiChatActivity : AppCompatActivity() {

    private lateinit var aiWebView: WebView
    private lateinit var aiProgressBar: ProgressBar
    private lateinit var dismissOverlay: View

    private val AI_URL = "https://aboakbr.com/admin/ai"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_floating_ai_chat)

        aiWebView = findViewById(R.id.aiWebView)
        aiProgressBar = findViewById(R.id.aiProgressBar)
        dismissOverlay = findViewById(R.id.dismissOverlay)

        dismissOverlay.setOnClickListener {
            finish()
        }

        setupWebView()

        val sharedPreferences = getSharedPreferences("AboAkbarPrefs", Context.MODE_PRIVATE)
        val savedToken = sharedPreferences.getString("admin_token", null)
        if (!savedToken.isNullOrEmpty()) {
            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(aiWebView, true)
            val cookieString = "admin_token=$savedToken; Domain=aboakbr.com; Path=/; Secure; SameSite=Lax"
            cookieManager.setCookie("https://aboakbr.com", cookieString)
            cookieManager.flush()
        }

        aiWebView.loadUrl(AI_URL)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = aiWebView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(aiWebView, true)
        }

        aiWebView.setBackgroundColor(Color.TRANSPARENT)

        aiWebView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread {
                    try {
                        request?.grant(request?.resources ?: arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }

        aiWebView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                aiProgressBar.visibility = View.GONE
            }
        }
    }

    override fun onBackPressed() {
        if (aiWebView.canGoBack()) {
            aiWebView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
