package com.aboakbar.admin

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class FloatingAdminActivity : AppCompatActivity() {

    private lateinit var floatingAiWebView: WebView
    private lateinit var pbFloatingAi: ProgressBar

    private val PREFS_NAME = "AboAkbarPrefs"
    private val KEY_TOKEN = "admin_token"
    private val BACKEND_URL = "https://aboakbr.com"
    private val MENU_OVERLAY_URL = "https://aboakbr.com/floating-menu-overlay"

    companion object {
        const val EXTRA_TAB = "extra_tab"
        const val TAB_ADD_ORDER = "tab_add_order"
        const val TAB_AI = "tab_ai"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // ضبط النافذة لتكون شفافة فوق كل شيء
        window.setBackgroundDrawableResource(android.R.color.transparent)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )

        setContentView(R.layout.activity_floating_admin)

        floatingAiWebView = findViewById(R.id.floatingAiWebView)
        pbFloatingAi = findViewById(R.id.pbFloatingAi)

        setupFloatingMenuWebView()
        loadMenuOverlay()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupFloatingMenuWebView() {
        floatingAiWebView.setBackgroundColor(Color.TRANSPARENT)
        floatingAiWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null)

        val settings = floatingAiWebView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(floatingAiWebView, true)
        }

        floatingAiWebView.addJavascriptInterface(AndroidFloatingMenuBridge(), "AndroidFloatingMenu")

        floatingAiWebView.webChromeClient = object : WebChromeClient() {
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

        floatingAiWebView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                pbFloatingAi.visibility = View.GONE
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleUrlNavigation(url)
            }
        }
    }

    private fun handleUrlNavigation(url: String): Boolean {
        try {
            if (url.startsWith("https://api.whatsapp.com") || url.startsWith("whatsapp://")) {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(intent)
                finish()
                return true
            } else if (url.startsWith("https://t.me") || url.startsWith("tg://")) {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(intent)
                finish()
                return true
            } else if (url.contains("/floating-menu-overlay")) {
                return false
            } else {
                val intent = Intent(this, MainActivity::class.java).apply {
                    putExtra("OPEN_URL", url)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                startActivity(intent)
                finish()
                return true
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }

    private fun loadMenuOverlay() {
        val clickX = intent?.getIntExtra("CLICK_X", 60) ?: 60
        val clickY = intent?.getIntExtra("CLICK_Y", 300) ?: 300

        val density = resources.displayMetrics.density
        val dpX = (clickX / density).toInt()
        val dpY = (clickY / density).toInt()

        val urlWithParams = "$MENU_OVERLAY_URL?x=$dpX&y=$dpY&autoOpen=true"

        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedToken = sharedPreferences.getString(KEY_TOKEN, null)
        if (!savedToken.isNullOrEmpty()) {
            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(floatingAiWebView, true)
            val cookieString = "admin_token=$savedToken; Domain=aboakbr.com; Path=/; Secure; SameSite=Lax"
            cookieManager.setCookie(BACKEND_URL, cookieString)
            cookieManager.flush()
        }
        floatingAiWebView.loadUrl(urlWithParams)
    }

    inner class AndroidFloatingMenuBridge {
        @JavascriptInterface
        fun openUrl(url: String) {
            runOnUiThread {
                handleUrlNavigation(url)
            }
        }

        @JavascriptInterface
        fun openAi() {
            runOnUiThread {
                val intent = Intent(this@FloatingAdminActivity, MainActivity::class.java).apply {
                    putExtra("OPEN_URL", "$BACKEND_URL/admin/ai")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                startActivity(intent)
                finish()
            }
        }

        @JavascriptInterface
        fun closeOverlay() {
            runOnUiThread {
                finish()
            }
        }

        @JavascriptInterface
        fun onMenuStateChanged(isOpen: Boolean) {
            // يمكن استخدامه إذا رغبنا
        }
    }

    override fun onResume() {
        super.onResume()
        try {
            val hideIntent = Intent(this, FloatingWidgetService::class.java).apply {
                action = FloatingWidgetService.ACTION_SET_INVISIBLE
            }
            startService(hideIntent)
        } catch (e: Exception) {}
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            val showIntent = Intent(this, FloatingWidgetService::class.java).apply {
                action = FloatingWidgetService.ACTION_SET_VISIBLE
            }
            startService(showIntent)
        } catch (e: Exception) {}
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        finish()
    }
}
