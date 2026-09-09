package com.aboakbar.modf

import android.app.Activity
import android.app.Dialog
import android.content.Context
import android.graphics.Color
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
        val cbEval = dialog.findViewById<CheckBox>(R.id.cbEnableEvaluation)
        val tvEvalBadge = dialog.findViewById<TextView>(R.id.tvEvalStatusBadge)
        val layoutEvalCard = dialog.findViewById<LinearLayout>(R.id.layoutEvalToggleCard)

        val etEval = dialog.findViewById<EditText>(R.id.etIntervalMinutes)
        val btnMinusEval = dialog.findViewById<Button>(R.id.btnMinusMinutes)
        val btnPlusEval = dialog.findViewById<Button>(R.id.btnPlusMinutes)

        val chipEval15 = dialog.findViewById<Button>(R.id.chip15Min)
        val chipEval30 = dialog.findViewById<Button>(R.id.chip30Min)
        val chipEval60 = dialog.findViewById<Button>(R.id.chip60Min)
        val chipEval120 = dialog.findViewById<Button>(R.id.chip120Min)

        // 2. مكونات المراسلة
        val switchOutreach = dialog.findViewById<SwitchCompat>(R.id.switchEnableOutreach)
        val cbOutreach = dialog.findViewById<CheckBox>(R.id.cbEnableOutreach)
        val tvOutreachBadge = dialog.findViewById<TextView>(R.id.tvOutreachStatusBadge)
        val layoutOutreachCard = dialog.findViewById<LinearLayout>(R.id.layoutOutreachToggleCard)

        val etOutreach = dialog.findViewById<EditText>(R.id.etOutreachIntervalMinutes)
        val btnMinusOutreach = dialog.findViewById<Button>(R.id.btnMinusOutreachMinutes)
        val btnPlusOutreach = dialog.findViewById<Button>(R.id.btnPlusOutreachMinutes)

        val chipOutreach15 = dialog.findViewById<Button>(R.id.chipOutreach15Min)
        val chipOutreach30 = dialog.findViewById<Button>(R.id.chipOutreach30Min)
        val chipOutreach60 = dialog.findViewById<Button>(R.id.chipOutreach60Min)
        val chipOutreach120 = dialog.findViewById<Button>(R.id.chipOutreach120Min)

        val btnSave = dialog.findViewById<Button>(R.id.btnSaveInterval)

        // دالة تحديث واجهة التقييم
        fun updateEvalUI(enabled: Boolean) {
            switchEval.isChecked = enabled
            cbEval.isChecked = enabled
            if (enabled) {
                tvEvalBadge.text = "✔ تنبيه التقييم مشتغل ومفعل"
                tvEvalBadge.setTextColor(Color.parseColor("#065f46"))
                layoutEvalCard.setBackgroundColor(Color.parseColor("#d1fae5"))
            } else {
                tvEvalBadge.text = "✖ تنبيه التقييم طافي ومتوقف"
                tvEvalBadge.setTextColor(Color.parseColor("#dc2626"))
                layoutEvalCard.setBackgroundColor(Color.parseColor("#fee2e2"))
            }
        }

        // دالة تحديث واجهة المراسلة
        fun updateOutreachUI(enabled: Boolean) {
            switchOutreach.isChecked = enabled
            cbOutreach.isChecked = enabled
            if (enabled) {
                tvOutreachBadge.text = "✔ تنبيه المراسلة والتخزين مشتغل ومفعل"
                tvOutreachBadge.setTextColor(Color.parseColor("#0369a1"))
                layoutOutreachCard.setBackgroundColor(Color.parseColor("#e0f2fe"))
            } else {
                tvOutreachBadge.text = "✖ تنبيه المراسلة والتخزين طافي ومتوقف"
                tvOutreachBadge.setTextColor(Color.parseColor("#dc2626"))
                layoutOutreachCard.setBackgroundColor(Color.parseColor("#fee2e2"))
            }
        }

        // تحميل القيم الحالية
        updateEvalUI(EvaluationSchedulerService.isEnabled(context))
        etEval.setText(EvaluationSchedulerService.getIntervalMinutes(context).toString())

        updateOutreachUI(OutreachSchedulerService.isEnabled(context))
        etOutreach.setText(OutreachSchedulerService.getIntervalMinutes(context).toString())

        // تفاعل التقييم
        switchEval.setOnCheckedChangeListener { _, isChecked ->
            updateEvalUI(isChecked)
        }
        layoutEvalCard.setOnClickListener {
            val newState = !switchEval.isChecked
            updateEvalUI(newState)
        }

        // تفاعل المراسلة
        switchOutreach.setOnCheckedChangeListener { _, isChecked ->
            updateOutreachUI(isChecked)
        }
        layoutOutreachCard.setOnClickListener {
            val newState = !switchOutreach.isChecked
            updateOutreachUI(newState)
        }

        // تحكم دقائق التقييم
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

        // تحكم دقائق المراسلة
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

        // حفظ وتطبيق
        btnSave.setOnClickListener {
            val evalEnabled = switchEval.isChecked
            val evalMin = (etEval.text.toString().toIntOrNull() ?: 60).coerceAtLeast(1)

            val outreachEnabled = switchOutreach.isChecked
            val outreachMin = (etOutreach.text.toString().toIntOrNull() ?: 60).coerceAtLeast(1)

            EvaluationSchedulerService.setEnabled(context, evalEnabled)
            EvaluationSchedulerService.setIntervalMinutes(context, evalMin)

            OutreachSchedulerService.setEnabled(context, outreachEnabled)
            OutreachSchedulerService.setIntervalMinutes(context, outreachMin)

            val statusMsg = buildString {
                append("تم تطبيق الإعدادات بنجاح:\n")
                append(if (evalEnabled) "⭐ التقييم: مفعل ($evalMin د)" else "⭐ التقييم: متوقف")
                append("\n")
                append(if (outreachEnabled) "💬 المراسلة: مفعل ($outreachMin د)" else "💬 المراسلة: متوقف")
            }

            Toast.makeText(context, statusMsg, Toast.LENGTH_LONG).show()
            dialog.dismiss()
        }

        dialog.show()
    }
}
