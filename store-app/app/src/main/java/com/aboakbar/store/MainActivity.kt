package com.aboakbar.store

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout
    private lateinit var screenshotOverlay: ImageView
    private lateinit var progressBar: ProgressBar

    private val FILECHOOSER_RESULTCODE = 1
    private var uploadMessage: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null
    private var fadeOutRunnable: Runnable? = null

    private val TARGET_URL = "https://aboakbr.com/store"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Initialize Views
        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById(R.id.swipeRefreshLayout)
        screenshotOverlay = findViewById(R.id.screenshotOverlay)
        progressBar = findViewById(R.id.progressBar)

        // إعداد السحب للتحديث
        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
        }

        // تفعيل SwipeRefreshLayout فقط عندما يكون WebView في الأعلى تماماً وبدء اللمس من الثلث العلوي للشاشة (35% من الارتفاع)
        // لمنع التحديث العشوائي عند سحب القوائم في منتصف وأسفل الشاشة
        webView.setOnTouchListener { v, event ->
            if (event.action == android.view.MotionEvent.ACTION_DOWN) {
                val isAtTop = !webView.canScrollVertically(-1)
                val touchY = event.y
                val viewHeight = v.height
                val threshold = viewHeight * 0.35f // 35% من الارتفاع (الثلث العلوي تقريباً)
                
                swipeRefreshLayout.isEnabled = (isAtTop && touchY <= threshold)
            }
            false // إرجاع false للسماح للـ WebView بمعالجة اللمس بشكل طبيعي
        }

        setupWebView()
        setupLongPressMenu()

        // استعادة الحالة إن وجدت أو تحميل الصفحة لأول مرة
        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState)
        } else {
            showLoading(true)
            webView.loadUrl(TARGET_URL)
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
        cameraPhotoUri?.let { outState.putString("cameraPhotoUri", it.toString()) }
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
        val uriStr = savedInstanceState.getString("cameraPhotoUri")
        if (uriStr != null) {
            cameraPhotoUri = Uri.parse(uriStr)
        }
    }

    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.textZoom = 100
        settings.mediaPlaybackRequiresUserGesture = false

        // تعطيل الزوم برمجياً لمنع تأخير اللمس بمقدار 300ms
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            webView.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_BOUND, true)
        }

        // تحسين أداء اللمس والتمرير الفوري
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.isVerticalFadingEdgeEnabled = false
        webView.isHorizontalFadingEdgeEnabled = false
        webView.setBackgroundColor(android.graphics.Color.TRANSPARENT)

        // تفعيل إدارة الكوكيز
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                
                // فتح الروابط الداخلية للموقع داخل التطبيق نفسه
                if (url.contains("aboakbr.com") || url.contains("aboakbar.vercel.app") || url.startsWith("file:///android_asset")) {
                    return false
                }
                
                // معالجة روابط الاتصال المباشر والواتساب لفتحها في التطبيق المخصص بالهاتف
                if (url.startsWith("tel:")) {
                    try {
                        val intent = Intent(Intent.ACTION_DIAL, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        return false
                    }
                }
                
                if (url.startsWith("whatsapp:") || url.contains("wa.me")) {
                    try {
                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                        startActivity(intent)
                        return true
                    } catch (e: Exception) {
                        val webUrl = if (url.startsWith("whatsapp://send?")) {
                            url.replace("whatsapp://send?", "https://api.whatsapp.com/send?")
                        } else url
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(webUrl))
                            startActivity(intent)
                            return true
                        } catch (ex: Exception) {
                            return false
                        }
                    }
                }

                // فتح الروابط الخارجية الأخرى في متصفح خارجي
                try {
                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    startActivity(intent)
                    return true
                } catch (e: Exception) {
                    return false
                }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                CookieManager.getInstance().flush()
                swipeRefreshLayout.isRefreshing = false
                showLoading(false)
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            // معالجة رفع الملفات والصور من المتصفح
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                uploadMessage?.onReceiveValue(null)
                uploadMessage = filePathCallback
                
                val isCapture = fileChooserParams?.isCaptureEnabled ?: false

                if (isCapture) {
                    val cameraIntent = Intent(android.provider.MediaStore.ACTION_IMAGE_CAPTURE)
                    if (cameraIntent.resolveActivity(packageManager) != null) {
                        var photoFile: java.io.File? = null
                        try {
                            photoFile = java.io.File.createTempFile("IMG_", ".jpg", getExternalFilesDir(android.os.Environment.DIRECTORY_PICTURES))
                            cameraPhotoUri = androidx.core.content.FileProvider.getUriForFile(
                                this@MainActivity,
                                "$packageName.fileprovider",
                                photoFile
                            )
                        } catch (e: Exception) {
                            photoFile = null
                        }
                        if (photoFile != null) {
                            cameraIntent.putExtra(android.provider.MediaStore.EXTRA_OUTPUT, cameraPhotoUri)
                            cameraIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                            try {
                                startActivityForResult(cameraIntent, FILECHOOSER_RESULTCODE)
                                return true
                            } catch (e: Exception) {
                                // fallback
                            }
                        }
                    }
                }

                val contentSelectionIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }

                try {
                    startActivityForResult(contentSelectionIntent, FILECHOOSER_RESULTCODE)
                } catch (e: Exception) {
                    uploadMessage?.onReceiveValue(null)
                    uploadMessage = null
                    return false
                }
                return true
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                request?.grant(request.resources)
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String?,
                callback: GeolocationPermissions.Callback?
            ) {
                callback?.invoke(origin, true, false)
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (uploadMessage == null) return
            
            var result: Array<Uri>? = null
            if (resultCode == android.app.Activity.RESULT_OK) {
                if (data == null || data.data == null) {
                    if (cameraPhotoUri != null) {
                        result = arrayOf(cameraPhotoUri!!)
                    }
                } else {
                    result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                }
            }
            uploadMessage?.onReceiveValue(result)
            uploadMessage = null
        }
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
    }

    // القاعدة الأساسية والمهمة: معالجة زر الرجوع لمنع إغلاق التطبيق وإعادة تحميله
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            // بدلاً من إغلاق النشاط (Activity.finish)، نقوم بنقله للخلفية ليبقى محملاً في الذاكرة
            moveTaskToBack(true)
        }
    }

    override fun onResume() {
        super.onResume()
        try {
            webView.onResume()
            webView.resumeTimers()
            webView.requestFocus(View.FOCUS_DOWN)
            webView.requestFocusFromTouch()
            webView.post { webView.invalidate() }
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // إخفاء الصورة التراكبية تدريجياً لضمان عودة فائقة السلاسة دون وميض
        if (screenshotOverlay.visibility == View.VISIBLE) {
            fadeOutRunnable?.let { screenshotOverlay.removeCallbacks(it) }
            fadeOutRunnable = Runnable {
                screenshotOverlay.animate()
                    .alpha(0f)
                    .setDuration(350)
                    .withEndAction {
                        screenshotOverlay.visibility = View.GONE
                        screenshotOverlay.alpha = 1f
                        screenshotOverlay.setImageBitmap(null)
                    }
                    .start()
            }
            screenshotOverlay.postDelayed(fadeOutRunnable, 300)
        }
    }

    override fun onPause() {
        // إلغاء التأخير وجدولة التلاشي
        fadeOutRunnable?.let { screenshotOverlay.removeCallbacks(it) }
        screenshotOverlay.animate().cancel()
        
        try {
            // التقاط حالة الويب فيو البصرية الحالية لعرضها ريثما يستأنف التطبيق نشاطه
            if (webView.width > 0 && webView.height > 0) {
                val bitmap = Bitmap.createBitmap(webView.width, webView.height, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bitmap)
                webView.draw(canvas)
                screenshotOverlay.setImageBitmap(bitmap)
                screenshotOverlay.visibility = View.VISIBLE
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        
        super.onPause()
        try {
            webView.onPause()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupLongPressMenu() {
        webView.setOnLongClickListener {
            val hitTestResult = webView.hitTestResult
            val url = hitTestResult.extra

            if (url == null) return@setOnLongClickListener false

            val options = mutableListOf<String>()
            val actions = mutableListOf<() -> Unit>()

            when (hitTestResult.type) {
                WebView.HitTestResult.IMAGE_TYPE,
                WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE -> {
                    options.add("حفظ الصورة")
                    actions.add { downloadImage(url) }

                    options.add("مشاركة رابط الصورة")
                    actions.add { shareImage(url) }

                    if (hitTestResult.type == WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE) {
                        options.add("فتح الرابط في متصفح خارجي")
                        actions.add {
                            try {
                                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            } catch (e: Exception) {}
                        }

                        options.add("نسخ الرابط")
                        actions.add {
                            val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("URL", url))
                            Toast.makeText(this@MainActivity, "تم نسخ الرابط", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
                WebView.HitTestResult.SRC_ANCHOR_TYPE -> {
                    options.add("فتح في متصفح خارجي")
                    actions.add {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (e: Exception) {}
                    }

                    options.add("نسخ الرابط")
                    actions.add {
                        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("URL", url))
                        Toast.makeText(this@MainActivity, "تم نسخ الرابط", Toast.LENGTH_SHORT).show()
                    }
                }
                else -> return@setOnLongClickListener false
            }

            if (options.isNotEmpty()) {
                android.app.AlertDialog.Builder(this)
                    .setItems(options.toTypedArray()) { _, which ->
                        actions[which].invoke()
                    }
                    .show()
                return@setOnLongClickListener true
            }

            false
        }
    }

    private fun downloadImage(url: String) {
        try {
            if (url.startsWith("data:image")) {
                Toast.makeText(this, "لا يمكن تنزيل هذه الصورة لأنها مدمجة بالصفحة", Toast.LENGTH_SHORT).show()
                return
            }
            val request = android.app.DownloadManager.Request(Uri.parse(url))
            request.allowScanningByMediaScanner()
            request.setNotificationVisibility(android.app.DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            
            var fileName = android.webkit.URLUtil.guessFileName(url, null, null)
            if (!fileName.contains(".")) {
                fileName += ".jpg"
            }
            
            request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, "AboAkbarStore/$fileName")
            
            val dm = getSystemService(Context.DOWNLOAD_SERVICE) as android.app.DownloadManager
            dm.enqueue(request)
            Toast.makeText(this, "جاري تنزيل الصورة إلى مجلد التنزيلات...", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "حدث خطأ أثناء التنزيل: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun shareImage(url: String) {
        val intent = Intent(Intent.ACTION_SEND)
        intent.type = "text/plain"
        intent.putExtra(Intent.EXTRA_TEXT, url)
        startActivity(Intent.createChooser(intent, "مشاركة الرابط"))
    }
}
