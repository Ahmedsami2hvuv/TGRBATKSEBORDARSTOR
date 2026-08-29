package com.aboakbar.admin

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.View
import android.view.animation.LinearInterpolator
import kotlin.math.cos
import kotlin.math.sin

/**
 * كبسولة Gemini Live المطابقة 100% للصورة المرفقة (Apple VisionOS Translucent Frosted Glass Style)
 */
class GeminiLivePillView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val pillPath = Path()
    private val pillBounds = RectF()

    private val glassBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 3f // 1.5dp إطار زجاجي نحيف ناعم
        color = Color.parseColor("#80FFFFFF") // أبيض شبه شفاف ناصع
    }

    private val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val pastelBlobPaint1 = Paint(Paint.ANTI_ALIAS_FLAG)
    private val pastelBlobPaint2 = Paint(Paint.ANTI_ALIAS_FLAG)
    private val pastelBlobPaint3 = Paint(Paint.ANTI_ALIAS_FLAG)

    private var animPhase = 0f
    private var audioAmplitude = 0f
    private var animator: ValueAnimator? = null

    init {
        setLayerType(LAYER_TYPE_SOFTWARE, null)

        animator = ValueAnimator.ofFloat(0f, (2 * Math.PI).toFloat()).apply {
            duration = 5000
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener { animation ->
                animPhase = animation.animatedValue as Float
                invalidate()
            }
        }
        animator?.start()
    }

    /**
     * تحديث نسبة تفاعل صوت الميكروفون
     */
    fun setAudioRms(rmsdB: Float) {
        val targetAmp = (rmsdB.coerceIn(0f, 10f) / 10f)
        audioAmplitude = audioAmplitude * 0.6f + targetAmp * 0.4f
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        pillBounds.set(0f, 0f, w.toFloat(), h.toFloat())
        pillPath.reset()
        pillPath.addRoundRect(pillBounds, h / 2f, h / 2f, Path.Direction.CW)
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)

        val w = width.toFloat()
        val h = height.toFloat()
        if (w <= 0 || h <= 0) return

        val saveCount = canvas.save()
        canvas.clipPath(pillPath)

        // 1. التدرج الرأسي الأساسي (النصف العلوي أبيض شبه شفاف ناصع، والنصف السفلي أزرق كهربائي زاهي)
        val baseGradient = LinearGradient(
            0f, 0f, 0f, h,
            intArrayOf(
                Color.parseColor("#FAFAFA"), // النصف العلوي شفافية ناصعة
                Color.parseColor("#E0F2FE"),
                Color.parseColor("#38BDF8"),
                Color.parseColor("#2563EB")  // النصف السفلي أزرق زاهي
            ),
            floatArrayOf(0.0f, 0.45f, 0.75f, 1.0f),
            Shader.TileMode.CLAMP
        )
        bgPaint.shader = baseGradient
        canvas.drawRect(pillBounds, bgPaint)

        // 2. الدمج الباستيل الضبابي الناعم جداً في المنتصف (Pastel Diffused Mesh Gradient)
        val centerX = w / 2f
        val centerY = h * 0.58f

        val baseRadius = (h * 0.48f) + (audioAmplitude * h * 0.35f)

        // بقعة الباستيل الأولى: أصفر باهت وأخضر نعناعي بمنتصف اليسار
        val offset1X = sin(animPhase.toDouble()).toFloat() * (w * 0.16f) - (w * 0.15f)
        val offset1Y = cos(animPhase.toDouble()).toFloat() * (h * 0.08f)
        val shader1 = RadialGradient(
            centerX + offset1X,
            centerY + offset1Y,
            baseRadius * 1.3f,
            intArrayOf(Color.parseColor("#FEF08A"), Color.parseColor("#A7F3D0"), Color.TRANSPARENT),
            floatArrayOf(0f, 0.55f, 1f),
            Shader.TileMode.CLAMP
        )
        pastelBlobPaint1.shader = shader1
        pastelBlobPaint1.maskFilter = BlurMaskFilter(baseRadius * 0.6f, BlurMaskFilter.Blur.NORMAL)
        canvas.drawCircle(centerX + offset1X, centerY + offset1Y, baseRadius * 1.3f, pastelBlobPaint1)

        // بقعة الباستيل الثانية: وردي ناعم وبنفسجي فاتح بمنتصف الكبسولة
        val offset2X = cos(animPhase * 1.2).toFloat() * (w * 0.18f)
        val offset2Y = sin(animPhase * 1.2).toFloat() * (h * 0.1f)
        val shader2 = RadialGradient(
            centerX + offset2X,
            centerY + offset2Y,
            baseRadius * 1.4f,
            intArrayOf(Color.parseColor("#F472B6"), Color.parseColor("#C084FC"), Color.TRANSPARENT),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        pastelBlobPaint2.shader = shader2
        pastelBlobPaint2.maskFilter = BlurMaskFilter(baseRadius * 0.65f, BlurMaskFilter.Blur.NORMAL)
        canvas.drawCircle(centerX + offset2X, centerY + offset2Y, baseRadius * 1.4f, pastelBlobPaint2)

        // بقعة الباستيل الثالثة: زبرجدي وسماوي دافئ بمنتصف اليمين
        val offset3X = sin(animPhase * 0.9 + 1.8).toFloat() * (w * 0.15f) + (w * 0.12f)
        val offset3Y = cos(animPhase * 0.9 + 1.8).toFloat() * (h * 0.09f)
        val shader3 = RadialGradient(
            centerX + offset3X,
            centerY + offset3Y,
            baseRadius * 1.25f,
            intArrayOf(Color.parseColor("#38BDF8"), Color.parseColor("#06B6D4"), Color.TRANSPARENT),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        pastelBlobPaint3.shader = shader3
        pastelBlobPaint3.maskFilter = BlurMaskFilter(baseRadius * 0.6f, BlurMaskFilter.Blur.NORMAL)
        canvas.drawCircle(centerX + offset3X, centerY + offset3Y, baseRadius * 1.25f, pastelBlobPaint3)

        // 3. رسم إطار الزجاج الأبيض النحيف الناعم (Glass Border Silhouette)
        canvas.drawRoundRect(pillBounds, h / 2f, h / 2f, glassBorderPaint)

        canvas.restoreToCount(saveCount)
    }

    override fun onDetachedFromWindow() {
        animator?.cancel()
        super.onDetachedFromWindow()
    }
}
