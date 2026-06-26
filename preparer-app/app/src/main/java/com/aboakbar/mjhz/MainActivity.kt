package com.aboakbar.mjhz

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.onesignal.OneSignal
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var swipeRefreshLayout: androidx.swiperefreshlayout.widget.SwipeRefreshLayout
    private lateinit var loginLayout: View
    private lateinit var mainLayout: View
    private lateinit var etPassword: EditText
    private lateinit var tvError: TextView
    private lateinit var btnSubmit: Button
    private lateinit var progressBar: ProgressBar

    private val PREFS_NAME = "AboAkbarpreparerPrefs"
    private val KEY_preparer_URL = "preparer_url"
    private val KEY_preparer_ID = "preparer_id"
    private val FILECHOOSER_RESULTCODE = 1
    private var uploadMessage: ValueCallback<Array<Uri>>? = null
    private var cameraPhotoUri: Uri? = null

    // التطبيق الخاص بالمجهزين (يجب تغيير هذا المعرف بعد إنشاء التطبيق في OneSignal)
    private val ONESIGNAL_APP_ID = "55661893-9b93-4b63-b0e9-03b250fc3667"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // تهيئة OneSignal للإشعارات الفورية
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                OneSignal.Notifications.requestPermission(true)
            } catch (e: Exception) {
                // تجاهل
            }
        }

        // Initialize Views
        webView = findViewById(R.id.webView)
        swipeRefreshLayout = findViewById<androidx.swiperefreshlayout.widget.SwipeRefreshLayout>(R.id.swipeRefreshLayout)
        loginLayout = findViewById(R.id.loginLayout)
        mainLayout = findViewById(R.id.mainLayout)
        etPassword = findViewById(R.id.etPassword)
        tvError = findViewById(R.id.tvError)
        btnSubmit = findViewById(R.id.btnSubmit)
        progressBar = findViewById(R.id.progressBar)

        setupWebView()
        setupLongPressMenu()

        // Submit Button Click
        btnSubmit.setOnClickListener {
            val url = etPassword.text.toString().trim()
            if (url.isNotEmpty()) {
                performLogin(url)
            } else {
                showError("الرجاء إدخال الرابط")
            }
        }

        // Check if url already exists
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedUrl = sharedPreferences.getString(KEY_preparer_URL, null)
        val savedId = sharedPreferences.getString(KEY_preparer_ID, null)

        if (!savedUrl.isNullOrEmpty() && !savedId.isNullOrEmpty()) {
            OneSignal.login(savedId)
            OneSignal.User.addTag("role", "preparer")
            if (savedInstanceState != null) {
                showWebViewLayout()
                webView.restoreState(savedInstanceState)
                checkAutoStartPermission()
            } else {
                launchDashboard(savedUrl, savedId)
            }
        } else {
            showLoginLayout()
        }

        requestAppPermissions()
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

    private fun requestAppPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val toRequest = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (toRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, toRequest.toTypedArray(), 101)
        } else {
            checkOverlayPermission()
        }
    }

    private fun checkOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!android.provider.Settings.canDrawOverlays(this)) {
                try {
                    val intent = Intent(
                        android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + packageName)
                    )
                    startActivity(intent)
                    Toast.makeText(this, "يرجى تفعيل خيار (الظهور فوق التطبيقات الأخرى) لكي تعمل الإشعارات المنبثقة الإجبارية بنجاح", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    // تجاهل
                }
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 101) {
            checkOverlayPermission()
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

        // تعطيل الزوم برمجياً لمنع تأخير اللمس بمقدار 300ms (Double-tap to zoom delay)
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false

        // تحسين أداء اللمس والتمرير الفوري
        webView.overScrollMode = View.OVER_SCROLL_IF_CONTENT_SCROLLS
        webView.isVerticalFadingEdgeEnabled = false
        webView.isHorizontalFadingEdgeEnabled = false

        // إعداد السحب للتحديث
        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
        }

        // تفعيل SwipeRefreshLayout فقط عندما يكون WebView في الأعلى تماماً لمنع التداخل أثناء التمرير
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            webView.setOnScrollChangeListener { _, _, scrollY, _, _ ->
                swipeRefreshLayout.isEnabled = (scrollY == 0)
            }
        } else {
            webView.viewTreeObserver.addOnScrollChangedListener {
                swipeRefreshLayout.isEnabled = (webView.scrollY == 0)
            }
        }

        // Enable cookie manager
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleUrlLoading(view, url)
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                url: String?
            ): Boolean {
                if (url == null) return false
                return handleUrlLoading(view, url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                CookieManager.getInstance().flush()
                injectPerformanceCss(view)
                swipeRefreshLayout.isRefreshing = false // إيقاف مؤشر التحميل
            }

            override fun onPageCommitVisible(view: WebView?, url: String?) {
                super.onPageCommitVisible(view, url)
                injectPerformanceCss(view)
                swipeRefreshLayout.isRefreshing = false // إيقاف مؤشر التحميل للاحتياط
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
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

    private fun handleUrlLoading(view: WebView?, url: String): Boolean {
        if (url.startsWith("file:///android_asset")) {
            return false
        }

        val uri = Uri.parse(url)
        val host = uri.host

        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val savedUrl = sharedPreferences.getString(KEY_preparer_URL, null)
        val savedHost = if (!savedUrl.isNullOrEmpty()) Uri.parse(savedUrl).host else null

        val isDefaultDomain = host != null && (
            host.contains("aboakbar.vercel.app") || 
            host.contains("aboakbr.com") || 
            host.contains("tgrbatksebordarstor.vercel.app")
        )
        val isSavedDomain = host != null && savedHost != null && host.equals(savedHost, ignoreCase = true)

        if (isDefaultDomain || isSavedDomain || url.contains("/preparer")) {
            return false
        }

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

        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
            return true
        } catch (e: Exception) {
            return false
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (uploadMessage == null) return
            
            var result: Array<Uri>? = null
            if (resultCode == android.app.Activity.RESULT_OK) {
                if (data == null || data.data == null) {
                    // من المحتمل أنه استخدم الكاميرا
                    if (cameraPhotoUri != null) {
                        result = arrayOf(cameraPhotoUri!!)
                    }
                } else {
                    // استخدم المعرض
                    result = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
                }
            }
            uploadMessage?.onReceiveValue(result)
            uploadMessage = null
        }
    }

    private fun performLogin(url: String) {
        showLoading(true)
        hideError()

        if (!url.startsWith("http")) {
            showLoading(false)
            showError("الرابط غير صحيح، يجب أن يبدأ بـ http أو https")
            return
        }

        if (!url.contains("preparer")) {
            showLoading(false)
            showError("هذا ليس رابط مجهز صحيح.")
            return
        }

        try {
            // استخراج معرف المجهز من الرابط
            val uri = Uri.parse(url)
            var preparerId: String? = null

            // المحاولة الأولى: استخراج المعرف من المتغير p في الرابط (مثل ?p=ID)
            preparerId = uri.getQueryParameter("p")

            // المحاولة الثانية: استخراج المعرف من المتغير c في الرابط (للاحتياط) (مثل ?c=ID)
            if (preparerId.isNullOrEmpty()) {
                preparerId = uri.getQueryParameter("c")
            }

            // المحاولة الثالثة: استخراج المعرف من مسار الرابط (مثل /preparer/ID)
            if (preparerId.isNullOrEmpty()) {
                val segments = uri.pathSegments
                val preparerIndex = segments.indexOf("preparer")
                if (preparerIndex != -1 && preparerIndex + 1 < segments.size) {
                    preparerId = segments[preparerIndex + 1]
                }
            }

            if (!preparerId.isNullOrEmpty()) {
                // حفظ الرابط والـ ID
                val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                sharedPreferences.edit()
                    .putString(KEY_preparer_URL, url)
                    .putString(KEY_preparer_ID, preparerId)
                    .apply()

                launchDashboard(url, preparerId)
            } else {
                showLoading(false)
                showError("تعذر استخراج معرف المجهز من الرابط.")
            }
        } catch (e: Exception) {
            showLoading(false)
            showError("الرابط غير صحيح.")
        }
    }

    private fun launchDashboard(url: String, preparerId: String) {
        OneSignal.login(preparerId)
        OneSignal.User.addTag("role", "preparer")

        showWebViewLayout()

        val targetUrl = intent.getStringExtra("target_url") ?: url
        webView.loadUrl(targetUrl)

        checkAutoStartPermission()
    }

    private fun showWebViewLayout() {
        loginLayout.visibility = View.GONE
        swipeRefreshLayout.visibility = View.VISIBLE
        mainLayout.background = null
    }

    private fun showLoginLayout() {
        swipeRefreshLayout.visibility = View.GONE
        loginLayout.visibility = View.VISIBLE
        mainLayout.setBackgroundResource(R.drawable.gradient_bg)
    }

    private fun showLoading(show: Boolean) {
        progressBar.visibility = if (show) View.VISIBLE else View.GONE
        btnSubmit.isEnabled = !show
    }

    private fun showError(msg: String) {
        tvError.text = msg
        tvError.visibility = View.VISIBLE
    }

    private fun hideError() {
        tvError.visibility = View.GONE
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (swipeRefreshLayout.visibility == View.VISIBLE && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        val targetUrl = intent?.getStringExtra("target_url")
        if (!targetUrl.isNullOrEmpty() && swipeRefreshLayout.visibility == View.VISIBLE) {
            webView.loadUrl(targetUrl)
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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (android.provider.Settings.canDrawOverlays(this)) {
                checkBatteryOptimizations()
            }
        }
    }

    override fun onPause() {
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
            
            request.setDestinationInExternalPublicDir(android.os.Environment.DIRECTORY_DOWNLOADS, "AboAkbar/$fileName")
            
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

    private fun checkBatteryOptimizations() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isBatteryPrompted = sharedPreferences.getBoolean("battery_prompted", false)
            
            if (!isBatteryPrompted) {
                val packageName = packageName
                val pm = getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
                if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                    sharedPreferences.edit().putBoolean("battery_prompted", true).apply()
                    try {
                        val intent = Intent().apply {
                            action = android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
                            data = Uri.parse("package:" + packageName)
                        }
                        startActivity(intent)
                        Toast.makeText(this, "يرجى اختيار (السماح / Allow) لتعطيل تحسين البطارية لضمان وصول الإشعارات بالخلفية دائماً", Toast.LENGTH_LONG).show()
                    } catch (e: Exception) {
                        try {
                            val intent = Intent().apply {
                                action = android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
                            }
                            startActivity(intent)
                        } catch (ex: Exception) {
                            // تجاهل
                        }
                    }
                }
            }
        }
    }

    private fun checkAutoStartPermission() {
        val sharedPreferences = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isAutoStartPrompted = sharedPreferences.getBoolean("autostart_prompted", false)
        
        if (!isAutoStartPrompted) {
            val manufacturer = Build.MANUFACTURER.lowercase()
            if (manufacturer.contains("xiaomi") || manufacturer.contains("oppo") || 
                manufacturer.contains("vivo") || manufacturer.contains("huawei")) {
                
                sharedPreferences.edit().putBoolean("autostart_prompted", true).apply()
                
                try {
                    val intent = Intent()
                    when {
                        manufacturer.contains("xiaomi") -> {
                            intent.component = android.content.ComponentName(
                                "com.miui.securitycenter",
                                "com.miui.permcenter.autostart.AutoStartManagementActivity"
                            )
                        }
                        manufacturer.contains("oppo") -> {
                            intent.component = android.content.ComponentName(
                                "com.coloros.safecenter",
                                "com.coloros.safecenter.permission.startup.StartupAppListActivity"
                            )
                        }
                        manufacturer.contains("vivo") -> {
                            intent.component = android.content.ComponentName(
                                "com.vivo.permissionmanager",
                                "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"
                            )
                        }
                        manufacturer.contains("huawei") -> {
                            intent.component = android.content.ComponentName(
                                "com.huawei.systemmanager",
                                "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"
                            )
                        }
                    }
                    startActivity(intent)
                    Toast.makeText(this, "يرجى تفعيل (التشغيل التلقائي / Auto-start) لتطبيق المجهز لضمان وصول الإشعارات فوراً في الخلفية", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    // تجاهل
                }
            }
        }
    }

    private fun injectPerformanceCss(view: WebView?) {
        val css = """
            * {
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
                box-shadow: none !important;
                text-shadow: none !important;
                transition: none !important;
                animation: none !important;
            }
            .kse-glass-card, [class*="glass"], [class*="card"] {
                background-color: #ffffff !important;
                border-color: #e2e8f0 !important;
            }
            .dark .kse-glass-card, .dark [class*="glass"], .dark [class*="card"] {
                background-color: #09090b !important;
                border-color: #27272a !important;
            }
            .kse-app-bg::before, .kse-app-bg::after {
                display: none !important;
            }
            body {
                background-color: #ffffff !important;
            }
            .dark body {
                background-color: #09090b !important;
            }
        """.trimIndent().replace("\n", " ")

        val js = "javascript:(function() {" +
                "var parent = document.getElementsByTagName('head').item(0);" +
                "var style = document.createElement('style');" +
                "style.type = 'text/css';" +
                "style.innerHTML = '$css';" +
                "parent.appendChild(style);" +
                "})()"
        view?.post {
            view.loadUrl(js)
        }
    }
}
