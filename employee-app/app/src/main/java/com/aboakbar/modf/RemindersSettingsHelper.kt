package com.aboakbar.modf

import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.view.ViewGroup
import android.view.Window
import android.widget.*
import androidx.appcompat.widget.SwitchCompat

object RemindersSettingsHelper {

    fun showCombinedSettingsDialog(context: Context) {
        val dialog = Dialog(context)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        dialog.setContentView(R.layout.dialog_evaluation_settings)
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)

        val displayMetrics = context.resources.displayMetrics
        val width = (displayMetrics.widthPixels * 0.92).toInt()
        dialog.window?.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT)

        // 1. مكونات التقييم
        val switchEval = dialog.findViewById<SwitchCompat>(R.id.switchEnableEvaluation)
        val etEval = dialog.findViewById<EditText>(R.id.etIntervalMinutes)
        val btnMinusEval = dialog.findViewById<Button>(R.id.btnMinusMinutes)
        val btnPlusEval = dialog.findViewById<Button>(R.id.btnPlusMinutes)

        val chipEval15 = dialog.findViewById<Button>(R.id.chip15Min)
        val chipEval30 = dialog.findViewById<Button>(R.id.chip30Min)
        val chipEval60 = dialog.findViewById<Button>(R.id.chip60Min)
        val chipEval120 = dialog.findViewById<Button>(R.id.chip120Min)

        // 2. مكونات المراسلة
        val switchOutreach = dialog.findViewById<SwitchCompat>(R.id.switchEnableOutreach)
        val etOutreach = dialog.findViewById<EditText>(R.id.etOutreachIntervalMinutes)
        val btnMinusOutreach = dialog.findViewById<Button>(R.id.btnMinusOutreachMinutes)
        val btnPlusOutreach = dialog.findViewById<Button>(R.id.btnPlusOutreachMinutes)

        val chipOutreach15 = dialog.findViewById<Button>(R.id.chipOutreach15Min)
        val chipOutreach30 = dialog.findViewById<Button>(R.id.chipOutreach30Min)
        val chipOutreach60 = dialog.findViewById<Button>(R.id.chipOutreach60Min)
        val chipOutreach120 = dialog.findViewById<Button>(R.id.chipOutreach120Min)

        val btnSave = dialog.findViewById<Button>(R.id.btnSaveInterval)

        // تحميل القيم الحالية
        switchEval.isChecked = EvaluationSchedulerService.isEnabled(context)
        etEval.setText(EvaluationSchedulerService.getIntervalMinutes(context).toString())

        switchOutreach.isChecked = OutreachSchedulerService.isEnabled(context)
        etOutreach.setText(OutreachSchedulerService.getIntervalMinutes(context).toString())

        // تحكم التقييم
        btnMinusEval.setOnClickListener {
            val c = etEval.text.toString().toIntOrNull() ?: 60
            etEval.setText((c - 5).coerceAtLeast(1).toString())
        }
        btnPlusEval.setOnClickListener {
            val c = etEval.text.toString().toIntOrNull() ?: 60
            etEval.setText((c + 5).toString())
        }
        chipEval15?.setOnClickListener { etEval.setText("15") }
        chipEval30?.setOnClickListener { etEval.setText("30") }
        chipEval60?.setOnClickListener { etEval.setText("60") }
        chipEval120?.setOnClickListener { etEval.setText("120") }

        // تحكم المراسلة
        btnMinusOutreach.setOnClickListener {
            val c = etOutreach.text.toString().toIntOrNull() ?: 60
            etOutreach.setText((c - 5).coerceAtLeast(1).toString())
        }
        btnPlusOutreach.setOnClickListener {
            val c = etOutreach.text.toString().toIntOrNull() ?: 60
            etOutreach.setText((c + 5).toString())
        }
        chipOutreach15?.setOnClickListener { etOutreach.setText("15") }
        chipOutreach30?.setOnClickListener { etOutreach.setText("30") }
        chipOutreach60?.setOnClickListener { etOutreach.setText("60") }
        chipOutreach120?.setOnClickListener { etOutreach.setText("120") }

        // حفظ
        btnSave.setOnClickListener {
            val evalEnabled = switchEval.isChecked
            val evalMin = (etEval.text.toString().toIntOrNull() ?: 60).coerceAtLeast(1)

            val outreachEnabled = switchOutreach.isChecked
            val outreachMin = (etOutreach.text.toString().toIntOrNull() ?: 60).coerceAtLeast(1)

            EvaluationSchedulerService.setEnabled(context, evalEnabled)
            EvaluationSchedulerService.setIntervalMinutes(context, evalMin)

            OutreachSchedulerService.setEnabled(context, outreachEnabled)
            OutreachSchedulerService.setIntervalMinutes(context, outreachMin)

            Toast.makeText(context, "تم حفظ وتطبيق إعدادات المؤقتات بنجاح ✨", Toast.LENGTH_SHORT).show()
            dialog.dismiss()
        }

        dialog.show()
    }
}
