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
 * كبسولة Gemini Live المضيئة ذات الألوان المطموشة بالدمج الناعم في المنتصف والمتفاعلة مع الصوت 100%
 */
class GeminiLivePillView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private val pillPath = Path()
    private val pillBounds = RectF()

    private val paintBlob1 = Paint(Paint.ANTI_ALIAS_FLAG)
    private val paintBlob2 = Paint(Paint.ANTI_ALIAS_FLAG)
    private val paintBlob3 = Paint(Paint.ANTI_ALIAS_FLAG)

    private var animPhase = 0f
    private var audioAmplitude = 0f // التفاعل الصوتي من الميكروفون
    private var animator: ValueAnimator? = null

    init {
        setLayerType(LAYER_TYPE_SOFTWARE, null)

        animator = ValueAnimator.ofFloat(0f, (2 * Math.PI).toFloat()).apply {
            duration = 4000
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
     * تحديث نسبة تفاعل الصوت من الميكروفون
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

        // خلفية الكبسولة المتدرجة الناعمة الحالمة
        val bgGradient = LinearGradient(
            0f, 0f, w, h,
            intArrayOf(Color.parseColor("#38BDF8"), Color.parseColor("#F472B6")),
            null,
            Shader.TileMode.CLAMP
        )
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { shader = bgGradient }
        canvas.drawRect(pillBounds, bgPaint)

        // مركز الألوان المطموشة في المنتصف
        val centerX = w / 2f
        val centerY = h / 2f

        // مدى وحجم الألوان المطموشة بالمنتصف (تتسع مع صوت الميكروفون)
        val baseRadius = (h * 0.45f) + (audioAmplitude * h * 0.35f)

        // حركة بقعة اللون الأولى (الوردي المطموش بالمنتصف)
        val offset1X = sin(animPhase.toDouble()).toFloat() * (w * 0.15f)
        val offset1Y = cos(animPhase.toDouble()).toFloat() * (h * 0.1f)
        val shader1 = RadialGradient(
            centerX + offset1X,
            centerY + offset1Y,
            baseRadius * 1.2f,
            intArrayOf(Color.parseColor("#F472B6"), Color.parseColor("#FB7185"), Color.TRANSPARENT),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        paintBlob1.shader = shader1
        paintBlob1.maskFilter = BlurMaskFilter(baseRadius * 0.5f, BlurMaskFilter.Blur.NORMAL)
        canvas.drawCircle(centerX + offset1X, centerY + offset1Y, baseRadius * 1.2f, paintBlob1)

        // حركة بقعة اللون الثانية (الأصفر والبرتقالي المطموش بالمنتصف)
        val offset2X = cos(animPhase * 1.3).toFloat() * (w * 0.18f)
        val offset2Y = sin(animPhase * 1.3).toFloat() * (h * 0.12f)
        val shader2 = RadialGradient(
            centerX + offset2X,
            centerY + offset2Y,
            baseRadius * 1.1f,
            intArrayOf(Color.parseColor("#FBBF24"), Color.parseColor("#F97316"), Color.TRANSPARENT),
            floatArrayOf(0f, 0.45f, 1f),
            Shader.TileMode.CLAMP
        )
        paintBlob2.shader = shader2
        paintBlob2.maskFilter = BlurMaskFilter(baseRadius * 0.5f, BlurMaskFilter.Blur.NORMAL)
        canvas.drawCircle(centerX + offset2X, centerY + offset2Y, baseRadius * 1.1f, paintBlob2)

        // حركة بقعة اللون الثالثة (البنفسجي والأزرق الساحر بالمنتصف)
        val offset3X = sin(animPhase * 0.8 + 1.5).toFloat() * (w * 0.14f)
        val offset3Y = cos(animPhase * 0.8 + 1.5).toFloat() * (h * 0.1f)
        val shader3 = RadialGradient(
            centerX + offset3X,
            centerY + offset3Y,
            baseRadius * 1.3f,
            intArrayOf(Color.parseColor("#A855F7"), Color.parseColor("#38BDF8"), Color.TRANSPARENT),
            floatArrayOf(0f, 0.5f, 1f),
            Shader.TileMode.CLAMP
        )
        paintBlob3.shader = shader3
        paintBlob3.maskFilter = BlurMaskFilter(baseRadius * 0.6f, BlurMaskFilter.Blur.NORMAL)
        canvas.drawCircle(centerX + offset3X, centerY + offset3Y, baseRadius * 1.3f, paintBlob3)

        canvas.restoreToCount(saveCount)
    }

    override fun onDetachedFromWindow() {
        animator?.cancel()
        super.onDetachedFromWindow()
    }
}
