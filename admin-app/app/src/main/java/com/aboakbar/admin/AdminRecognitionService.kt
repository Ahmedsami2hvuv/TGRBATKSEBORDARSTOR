package com.aboakbar.admin

import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionService

class AdminRecognitionService : RecognitionService() {

    override fun onStartListening(recognizerIntent: Intent?, listener: Callback?) {
        // خدمة تفريغ صوتي قياسية لدعم تكامل النظام
    }

    override fun onCancel(listener: Callback?) {
    }

    override fun onStopListening(listener: Callback?) {
    }
}
