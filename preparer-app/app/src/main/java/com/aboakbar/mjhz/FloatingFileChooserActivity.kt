package com.aboakbar.mjhz

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import androidx.appcompat.app.AppCompatActivity

class FloatingFileChooserActivity : AppCompatActivity() {

    private val REQUEST_CHOOSER = 9988

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        try {
            val pickIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "image/*"
            }

            val chooserIntent = Intent.createChooser(pickIntent, "اختر صورة الفاتورة أو الطلبية")
            startActivityForResult(chooserIntent, REQUEST_CHOOSER)
        } catch (e: Exception) {
            FloatingAssistantService.uploadMessageCallback?.onReceiveValue(null)
            FloatingAssistantService.uploadMessageCallback = null
            finish()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_CHOOSER) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                val uri: Uri? = data.data
                if (uri != null) {
                    FloatingAssistantService.uploadMessageCallback?.onReceiveValue(arrayOf(uri))
                } else {
                    val clipData = data.clipData
                    if (clipData != null && clipData.itemCount > 0) {
                        val uris = Array(clipData.itemCount) { i -> clipData.getItemAt(i).uri }
                        FloatingAssistantService.uploadMessageCallback?.onReceiveValue(uris)
                    } else {
                        FloatingAssistantService.uploadMessageCallback?.onReceiveValue(null)
                    }
                }
            } else {
                FloatingAssistantService.uploadMessageCallback?.onReceiveValue(null)
            }
            FloatingAssistantService.uploadMessageCallback = null
            finish()
        }
    }
}
