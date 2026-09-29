package com.aboakbar.admin

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.service.voice.VoiceInteractionSession
import android.service.voice.VoiceInteractionSessionService
import android.view.LayoutInflater
import android.view.View
import android.webkit.*
import android.widget.ProgressBar

class AdminVoiceInteractionSessionService : VoiceInteractionSessionService() {

    override fun onNewSession(args: Bundle?): VoiceInteractionSession {
        return AdminSession(this)
    }

    private class AdminSession(val ctx: Context) : VoiceInteractionSession(ctx) {

        private var aiWebView: WebView? = null
        private var aiProgressBar: ProgressBar? = null
        private var dismissOverlay: View? = null
        private val AI_URL = "https://aboakbr.com/admin/ai"

        override fun onCreateContentView(): View {
            val inflater = LayoutInflater.from(ctx)
            val root = inflater.inflate(R.layout.activity_floating_ai_chat, null)

            aiWebView = root.findViewById(R.id.aiWebView)
            aiProgressBar = root.findViewById(R.id.aiProgressBar)
            dismissOverlay = root.findViewById(R.id.dismissOverlay)

            dismissOverlay?.setOnClickListener {
                hide()
            }

            setupWebView()
            return root
        }

        @SuppressLint("SetJavaScriptEnabled")
        private fun setupWebView() {
            val web = aiWebView ?: return
            val settings = web.settings
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.cacheMode = WebSettings.LOAD_DEFAULT

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                CookieManager.getInstance().setAcceptThirdPartyCookies(web, true)
            }

            web.setBackgroundColor(Color.TRANSPARENT)

            web.webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest?) {
                    try {
                        request?.grant(request?.resources ?: arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            web.webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    aiProgressBar?.visibility = View.GONE
                }
            }

            // حقن التوكن
            val sharedPreferences = ctx.getSharedPreferences("AboAkbarPrefs", Context.MODE_PRIVATE)
            val savedToken = sharedPreferences.getString("admin_token", null)
            if (!savedToken.isNullOrEmpty()) {
                val cookieManager = CookieManager.getInstance()
                cookieManager.setAcceptCookie(true)
                cookieManager.setAcceptThirdPartyCookies(web, true)
                val cookieString = "admin_token=$savedToken; Domain=aboakbr.com; Path=/; Secure; SameSite=Lax"
                cookieManager.setCookie("https://aboakbr.com", cookieString)
                cookieManager.flush()
            }

            web.loadUrl(AI_URL)
        }

        override fun onShow(args: Bundle?, showFlags: Int) {
            super.onShow(args, showFlags)
            try {
                if (aiWebView == null) {
                    setContentView(onCreateContentView())
                } else {
                    aiWebView?.reload()
                }
            } catch (e: Exception) {
                try {
                    val intent = Intent(ctx, FloatingAiChatActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                    }
                    ctx.startActivity(intent)
                } catch (ex: Exception) {
                    ex.printStackTrace()
                }
            }
        }

        override fun onBackPressed() {
            if (aiWebView?.canGoBack() == true) {
                aiWebView?.goBack()
            } else {
                hide()
            }
        }
    }
}
