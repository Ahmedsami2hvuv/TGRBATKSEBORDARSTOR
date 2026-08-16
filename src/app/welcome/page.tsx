"use client";

import React, { useEffect, useState, useRef } from "react";
import { getSocialLinksAction, SocialLinksConfig } from "@/lib/social-links";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import {
  Store, MessageCircle, Send, Users, Heart, Zap, MapPin, CheckCheck, Camera, Mic, Phone, Car, Clock, RotateCcw, Megaphone, Smartphone, ExternalLink, ArrowLeftRight, Banknote, ShoppingCart, UserPlus, Save, Pill, ShoppingBag, Gift, Bike, Navigation
} from "lucide-react";
import Link from "next/link";

const regions3k = ['الاسمدة', 'جيكور حزبه', 'جيكور', 'العصفورية', 'باب سليمان', 'باب طويل', 'باب العريض', 'باب عباس', 'كوت بازل', 'باب دباغ', 'باب ميدان', 'بلد سلطان', 'ام الصخر', 'باب رمانه', 'اهل عيد', 'الباني', 'نهر خوز', 'ابو مغيرة', 'مجيبرة', 'السبيليات', 'الصنگر', 'محيلة قبل دورة ام زباله', 'طريق الوسطي', 'العاگولية', 'الصحراء', 'ابو كوصرة', 'طريزاوية', 'العوجة', 'المقيمين', 'الابطاح', 'اللكطة', 'الشجرة الطيبة', 'شيخ ابراهيم', 'نزيلة', 'عميرية', 'بلد', 'كوت البلجاني', 'الحوطة', 'السوق', 'الصنكر', 'محيله الوسطي', 'محيله قرب الجسر', 'محيله بالسوق', 'محيله قرب السيطرة', 'محيله شارع المشروع'];

const regions5k = ['محيله شارع سيد حامد', 'محيله شارع الاندلس', 'محيله الصكاروة', 'المعهد الصناعي', 'دورة ام زباله بعد الاستدارة', 'الاندلس', 'طريق سيد حامد بعد الاندلس', 'الجديدة', 'الرومية', 'الصكاروة', 'كوت الصلحي', 'كوت الفداغ', 'جامع الشهيد', 'يوسفان', 'حمدان', 'كوت ثويني', 'البهادرية', 'محولة الزهير', 'كوت الحمداني', 'عويسيان', 'مهيجران', 'السراجي'];

function TimelineNode({ children, left = false, delay = 0, icon: Icon }: any) {
  return (
    <div className={"relative flex items-center justify-center w-full mb-16 md:mb-24 flex-col gap-6 md:gap-12 " + (left ? "md:flex-row-reverse" : "md:flex-row")}>
      <motion.div 
        initial={{ opacity: 0, y: 40, filter: "blur(8px)" }}
        whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 0.7, delay, type: "spring", bounce: 0.3 }}
        className="w-full md:w-[45%] z-10"
      >
        {children}
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-15%" }}
        transition={{ duration: 0.5, delay: delay + 0.2 }}
        className="hidden md:flex shrink-0 w-16 h-16 rounded-full bg-white items-center justify-center relative z-20 shadow-[0_8px_24px_rgba(95,168,211,0.22),inset_0_0_0_1px_rgba(191,224,242,0.7)]"
      >
        <Icon className="w-7 h-7 text-[#5FA8D3]" strokeWidth={1.5} />
      </motion.div>

      <div className="hidden md:block md:w-[45%]" />
    </div>
  );
}

export default function WelcomePage() {
  const [links, setLinks] = useState<SocialLinksConfig | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });
  const threadScale = useTransform(smoothProgress, [0, 1], [0.05, 1]);

  useEffect(() => {
    getSocialLinksAction().then(data => setLinks(data));
  }, []);

  const getYouTubeEmbedUrl = (url?: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? "https://www.youtube.com/embed/" + match[2] : null;
  };
  const videoUrl = getYouTubeEmbedUrl(links?.promoVideoUrl) || "https://www.youtube.com/embed/DA4ewcyRhBo";

  return (
    <div ref={containerRef} className="relative min-h-screen bg-[#F6FAFD] text-[#22323F] font-['IBM_Plex_Sans_Arabic'] overflow-x-hidden selection:bg-[#BFE0F2] selection:text-[#22323F] pb-32 pt-20">
      
      <div className="fixed inset-0 pointer-events-none z-0" style={{ background: "radial-gradient(ellipse 55% 40% at 25% 15%, rgba(191,224,242,0.4), transparent 65%), radial-gradient(ellipse 60% 45% at 80% 85%, rgba(191,224,242,0.3), transparent 65%)" }} />
      
      <div className="absolute left-[24px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-[3px] bg-[#BFE0F2]/30 z-0" />
      <motion.div 
        style={{ scaleY: threadScale }} 
        className="fixed left-[24px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#5FA8D3] to-[#BFE0F2] origin-top z-10 shadow-[0_0_15px_rgba(95,168,211,0.6)]" 
      />

      <div className="max-w-6xl mx-auto px-6 md:px-4 relative z-20 pl-[48px] md:pl-4">

        {/* Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-32 pt-10"
        >
          <div className="w-24 h-24 rounded-full bg-white mx-auto flex items-center justify-center shadow-[0_10px_30px_rgba(95,168,211,0.28),inset_0_0_0_1px_rgba(191,224,242,0.7)] mb-8">
            <Bike className="w-10 h-10 text-[#5FA8D3]" strokeWidth={1.3} />
          </div>
          <h1 className="font-bold tracking-tight text-[clamp(28px,7vw,64px)] leading-[1.3] text-[#22323F] mb-6">
            تجربة توصيل<br/><span className="text-[#5FA8D3]">بمستوى ثاني</span>
          </h1>
          <p className="text-[16px] md:text-[20px] text-[#22323F]/60 max-w-xl mx-auto font-medium">
            أبو الأكبر: خدمة توصيل شاملة، مدعومة بمتجر تسوق كامل.
          </p>

          <motion.div animate={{ y: [40, -10], opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeOut" }} className="w-24 h-24 flex flex-col items-center mx-auto mt-20">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-16 h-16 text-[#5FA8D3]">
              <path d="M12 5v14M12 5l-4 4M12 5l4 4"/>
              <path d="M15 16h-3c-1.1 0-2-.9-2-2V9c0-1.1.9-2 2-2s2 .9 2 2v2"/>
            </svg>
            <span className="text-[20px] font-black tracking-[3px] text-[#5FA8D3] mt-2 whitespace-nowrap">اسحب للأعلى</span>
          </motion.div>
        </motion.div>

        {/* Save Contact Section */}
        <TimelineNode left={false} icon={Save}>
          <div className="bg-[#5FA8D3] text-white p-8 md:p-12 rounded-[32px] shadow-xl text-center md:text-right overflow-hidden relative">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white blur-[80px] opacity-20 rounded-full" />
            <h2 className="text-[28px] font-bold mb-4 relative z-10 leading-relaxed">
              السلام عليكم 👋<br />
              قبل كل شي وأهم شي... اخزن رقمنا!
            </h2>
            <p className="text-white/90 text-[17px] mb-8 relative z-10 leading-relaxed">
              اخزن رقمنا باسم "أبو الأكبر للتوصيل"، ووراها كمل قراءة الرسالة. إذا خزنته، تعال اسولفلك...<br/><br/>
              ليش لازم تخزن رقمنا ونخزن رقمك؟ لأن إحنا ننشر يومياً منتجات من شتى المحلات لا على التعيين، فاخزن رقمنا ولازم نخزن رقمك حتى تشوف الحالات.
            </p>
            <a href="tel:+9647733921468" className="inline-flex flex-col md:flex-row items-center justify-center gap-3 bg-white text-[#5FA8D3] px-8 py-5 rounded-full font-bold text-[18px] hover:bg-gray-50 transition-colors shadow-md relative z-10 mx-auto md:mx-0 w-full md:w-auto">
              <Phone className="w-6 h-6" />
              اتصل بنا أو احفظ الرقم
              <span className="text-sm opacity-80" dir="ltr">0773 392 1468</span>
            </a>
          </div>
        </TimelineNode>

        {/* Everything delivery Section */}
        <TimelineNode left={true} icon={Gift}>
          <div className="bg-white/70 backdrop-blur-md p-8 rounded-[32px] shadow-sm border border-[#BFE0F2]/50 text-right md:text-left">
            <h3 className="text-[24px] font-bold mb-4 flex items-center gap-3 md:justify-start justify-end text-[#5FA8D3]">
              إحنا خدمة توصيل شاملة داخل أبي الخصيب <ShoppingCart className="w-7 h-7 md:hidden" />
            </h3>
            <p className="text-[#22323F]/80 text-[16px] leading-loose">
              يعني وأنت بالبيت، بالدوام، أو طالع... تفتح واتساب تراسلني تطلب أي شي (أي شي!) راح أشتريه ونوصله إلك للبيت.
              <br/><br/>
              <strong className="text-[#5FA8D3]">مثلاً تكدر تطلب:</strong> أدوية، مخضر (خضروات وفواكه)، خبز، صمون، كيك ومعجنات بأنواعها، كبة وميني بيتزا، لحم بعجين، أجبان وألبان، حليب، دجاج ذبح أو شوي، سمك شوي، طرشي، بهارات، لحم، مواد تجميل وكل مواد الكوزمتك، كرزات، إنشائية، كهربائيات، قرطاسية، هدايا وكل أشياء الطباعة، ألعاب، ملابس (من مجمع النور أو ضرار أو غيرهم)، أحذية، شحاطات، هيدفون، شاحنة، مفروشات، مواد من أنسب الأسعار، ذهب، مواد غذائية، مواد من الجملة، أقراص ألعاب، معسل أركيلة وفحم وكل مستلزماتها، أكل، لفات، بانزين، ودهن محركات.
              <br/><br/>
              نودي ونجيب فلوس من مكان لمكان... يعني كل شي يصير بين إيديك وين ما كنت بأبو الخصيب!
            </p>
          </div>
        </TimelineNode>

        {/* Website & Video */}
        <TimelineNode left={false} icon={Store}>
          <div className="bg-[#22323F] text-white p-8 rounded-[32px] shadow-2xl text-center md:text-right">
            <h3 className="text-[24px] font-bold mb-4">بالإضافة عدنة موقع تسوق شامل لأهالي أبي الخصيب</h3>
            <p className="text-white/80 mb-6">الموقع مسواكي... شاهد طريقة التسوق من الموقع بالفيديو:</p>
            {videoUrl && (
              <div className="rounded-2xl overflow-hidden shadow-lg border border-white/10 mb-6 bg-black">
                <iframe
                  className="w-full aspect-video"
                  src={videoUrl}
                  title="طريقة التسوق"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}
            <Link href="/store" className="inline-flex items-center justify-center gap-3 bg-[#5FA8D3] text-white px-8 py-4 rounded-full font-bold text-[18px] hover:bg-[#4a8eb9] transition-colors w-full shadow-lg">
              <ShoppingCart className="w-6 h-6" />
              ادخل لموقع التسوق الآن
            </Link>
          </div>
        </TimelineNode>

        {/* B2B Message */}
        <TimelineNode left={true} icon={Zap}>
          <div className="bg-white/70 backdrop-blur-md p-8 rounded-[32px] shadow-sm border border-orange-200 text-right md:text-left relative overflow-hidden">
             <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-orange-300 blur-[100px] rounded-full opacity-20" />
            <h2 className="text-[26px] font-bold mb-4 text-orange-600">يا هلا بأصحاب المحلات! 🚚</h2>
            <p className="text-[#22323F]/80 mb-6 font-medium">استمتعوا بمزايا التوصيل المتوفرة لدينا:</p>
            
            <ul className="space-y-4 text-[#22323F]/80 text-[15px] leading-relaxed list-none">
              <li className="flex gap-2"><span className="shrink-0">💵</span> <span><strong>الدفع نقدًا:</strong> يسلمكم المندوب الحساب قبل مغادرة المكان.</span></li>
              <li className="flex gap-2"><span className="shrink-0">🚀</span> <span><strong>توصيل فوري:</strong> الطلبات الصباحية تصل في الصباح 🌅. المسائية تصل العصر أو المغرب 🌇. (أقصى مدة للتأخير 3 ساعات في حال وجود مشكلة ⏳).</span></li>
              <li className="flex gap-2"><span className="shrink-0">🕒</span> <span><strong>احترام شديد للمواعيد:</strong> احترام موعد استلام وتسليم الطلبيات 👌📦.</span></li>
              <li className="flex gap-2"><span className="shrink-0">🤵‍♂️</span> <span><strong>مندوبي توصيل محترفين:</strong> مختارين بعناية ومدربين على أعلى مستوى من الاحترام ☝️.</span></li>
              <li className="flex gap-2"><span className="shrink-0">🔄</span> <span><strong>إعادة الطلبات مجانًا:</strong> في حال عدم استجابة الزبون للاتصال 📵.</span></li>
              <li className="flex gap-2"><span className="shrink-0">📢</span> <span><strong>الترويج لكم بحساباتنا:</strong> نشر حساباتكم عبر حساباتنا لزيادة الطلبيات 📈.</span></li>
              <li className="flex gap-2"><span className="shrink-0">💨🚗</span> <span><strong>خدمة توصيل مريحة:</strong> سيارات حديثة مكيفة ❄️ ودراجات نارية حديثة 🏍️.</span></li>
              <li className="flex gap-2"><span className="shrink-0">💻</span> <span><strong>موقع لطلباتكم:</strong> يمكنكم رفع طلباتكم من خلاله ومتابعتها بسهولة 📊 يغنيك عن تحميل التطبيقات وغيرها.</span></li>
            </ul>
          </div>
        </TimelineNode>

        {/* App Features */}
        <TimelineNode left={false} icon={CheckCheck}>
          <div className="bg-[#E7F2FA] p-8 rounded-[32px] shadow-inner text-right">
            <h2 className="text-[24px] font-bold mb-4 text-[#5FA8D3]">🔥 مميزات جديدة بتطبيق الطلبات!</h2>
            <p className="text-[#22323F]/80 mb-6">الي من خلاله المحلات والبيجات يرفعون طلبياتهم:</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center gap-2 text-[#22323F]/80"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> بدون تحميل تطبيق 📵</div>
              <div className="flex items-center gap-2 text-[#22323F]/80"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> بدون كتابة يوزر نيم 🔡</div>
              <div className="flex items-center gap-2 text-[#22323F]/80"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> بدون كتابة رقم سري 🔢</div>
              <div className="flex items-center gap-2 text-[#22323F]/80"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> تسجيل بصمة صوت 🎤</div>
              <div className="flex items-center gap-2 text-[#22323F]/80"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> التقاط صور للطلبية 📸</div>
              <div className="flex items-center gap-2 text-[#22323F]/80"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> زر الطلب العكسي 🔄</div>
              <div className="flex items-center gap-2 text-[#22323F]/80"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> زر كلشي واصل</div>
              <div className="flex items-center gap-2 text-[#22323F]/80"><CheckCheck className="w-5 h-5 text-[#5FA8D3]"/> اختيار سيارة أم دراجة 👌</div>
            </div>
            
            <p className="text-[#22323F] font-bold">الآن يمكنك رفع طلبياتك بكل سهولة وسرعة! فقط انقر على الرابط، الموقع سيتعرف عليك 🫵🏻 مباشرة 🏹.</p>
          </div>
        </TimelineNode>

        {/* Pricing List */}
        <TimelineNode left={true} icon={Banknote}>
          <div className="w-full">
            <h2 className="text-[26px] font-bold text-[#22323F] mb-6 text-center md:text-right">علماً أن الأسعار للطلبية الواحدة ⭕</h2>
            <div className="space-y-6">
              {/* 3000 IQD */}
              <div className="bg-white rounded-[24px] p-6 shadow-sm border border-emerald-100 text-right">
                <div className="flex justify-between items-center mb-4 flex-row-reverse">
                  <div>
                    <h3 className="font-bold text-[22px] text-[#22323F]">3,000 دينار</h3>
                    <span className="text-emerald-500 text-sm font-bold bg-emerald-50 px-3 py-1 rounded-full mt-1 inline-block">هذه المناطق على 3</span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 shrink-0 ml-4">
                    <MapPin className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {regions3k.map(m => (
                    <span key={m} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded text-[13px] border border-emerald-100">{m}</span>
                  ))}
                </div>
              </div>

              {/* 5000 IQD */}
              <div className="bg-white rounded-[24px] p-6 shadow-sm border border-[#BFE0F2]/50 text-right">
                <div className="flex justify-between items-center mb-4 flex-row-reverse">
                  <div>
                    <h3 className="font-bold text-[22px] text-[#22323F]">5,000 دينار</h3>
                    <span className="text-[#5FA8D3] text-sm font-bold bg-[#BFE0F2]/30 px-3 py-1 rounded-full mt-1 inline-block">هذه المناطق على 5</span>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-[#BFE0F2]/30 flex items-center justify-center text-[#5FA8D3] shrink-0 ml-4">
                    <Car className="w-6 h-6" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  {regions5k.map(m => (
                    <span key={m} className="px-2.5 py-1 bg-[#F6FAFD] text-[#5FA8D3] rounded text-[13px] border border-[#BFE0F2]">{m}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TimelineNode>

        {/* Social Links */}
        <TimelineNode left={false} icon={Users}>
          <div className="bg-[#22323F] rounded-[32px] p-8 text-center shadow-xl">
            <h2 className="text-[22px] font-bold text-white mb-6">تابعنا وتواصل ويانا</h2>
            <div className="flex flex-col gap-4">
              <a href="https://wa.me/9647733921468" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-green-500 text-white px-6 py-4 rounded-2xl font-bold hover:bg-green-600 transition-colors shadow-lg text-lg">
                <MessageCircle className="w-6 h-6" />
                واتساب (07733921468)
              </a>
              <a href="https://instagram.com/k.o_kseb" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-gradient-to-tr from-pink-500 to-purple-500 text-white px-6 py-4 rounded-2xl font-bold hover:opacity-90 transition-opacity shadow-lg text-lg">
                <Camera className="w-6 h-6" />
                حساب الانستكرام @k.o_kseb
              </a>
              <a href="https://t.me/ko_kseb" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-blue-500 text-white px-6 py-4 rounded-2xl font-bold hover:bg-blue-600 transition-colors shadow-lg text-lg">
                <Send className="w-6 h-6" />
                قناة التليكرام
              </a>
              <a href="https://chat.whatsapp.com/JSqEm7M1CgqBglStuRyItH" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-[#128C7E] text-white px-6 py-4 rounded-2xl font-bold hover:opacity-90 transition-opacity shadow-lg text-md">
                <Users className="w-6 h-6" />
                أكبر كروب واتساب مختلط
              </a>
              <a href="https://t.me/+IIH_puHB8Mg2MDIy" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-[#0088cc] text-white px-6 py-4 rounded-2xl font-bold hover:opacity-90 transition-opacity shadow-lg text-md">
                <Users className="w-6 h-6" />
                أكبر كروب تليكرام للبيع والشراء
              </a>
            </div>
          </div>
        </TimelineNode>

      </div>
    </div>
  );
}
