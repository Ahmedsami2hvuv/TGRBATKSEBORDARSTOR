const fs = require('fs');

let content = fs.readFileSync('src/app/mandob-job/page.tsx', 'utf8');

content = content.replace(
  'import React from "react";',
  'import React, { useState } from "react";\nimport { submitJobApplication } from "@/app/actions/job-applications";'
);

content = content.replace(
  'import { motion } from "framer-motion";',
  'import { motion, AnimatePresence } from "framer-motion";\nimport { X } from "lucide-react";'
);

const stateLogic = `
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    region: "",
    phone: "",
    carType: "",
    hasAc: false,
    hasCommitment: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await submitJobApplication(formData);
      if (res.success) {
        const waText = \`مرحبا
اني \${formData.name}
من منطقة \${formData.region}
رقمي \${formData.phone}
سيارتي نوع \${formData.carType}
\${formData.hasAc ? "بيها تبريد" : "ما بيها تبريد"}
\${formData.hasCommitment ? "عندي التزام بوقت" : "ما عندي التزام"}

إجيتك من إعلان طلب مندوب التوصيل 🚗

أني قريت كل التفاصيل والشروط 📋

وتنطبق عليّ كل الشروط ✅

وأني متفرغ وما عندي أي التزام ثاني، 

وأكدر أشتغل وياكم صبح وعصر ⏰

خلي رقمي يمك في حال احتاجيت مندوب\`;
        const encodedUrl = \`https://wa.me/9647733921468?text=\${encodeURIComponent(waText)}\`;
        window.open(encodedUrl, "_blank");
        setIsModalOpen(false);
      } else {
        alert("حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الإرسال.");
    } finally {
      setIsSubmitting(false);
    }
  };
`;

content = content.replace(
  'export default function MandobJobPage() {\n  return (',
  'export default function MandobJobPage() {\n' + stateLogic + '\n  return ('
);

const oldBtn = `<a href="https://wa.me/9647733921468?text=مرحباً 👋%0Aإجيتك من إعلان طلب مندوب التوصيل 🚗%0A%0Aأني قريت كل التفاصيل والشروط 📋%0A%0Aوتنطبق عليّ كل الشروط ✅%0A%0Aوأني متفرغ وما عندي أي التزام ثاني، %0A%0Aوأكدر أشتغل وياكم صبح وعصر ⏰" target="_blank" rel="noreferrer" className="flex items-center justify-center gap-3 bg-[#25D366] text-white px-8 py-5 rounded-full font-bold text-[18px] hover:bg-[#20bd5a] transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300">
                <MessageCircle className="w-6 h-6" />
                تواصل معنا على واتساب
              </a>`;

const newBtn = `<button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-3 bg-[#25D366] text-white px-8 py-5 rounded-full font-bold text-[18px] hover:bg-[#20bd5a] transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 duration-300">
                <MessageCircle className="w-6 h-6" />
                تواصل معنا لتقديم طلب
              </button>`;

content = content.replace(oldBtn, newBtn);

const modalJsx = `
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="bg-[#5FA8D3] p-6 text-white flex justify-between items-center relative overflow-hidden shrink-0">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white/20 rounded-full blur-2xl" />
                <h3 className="text-xl font-bold relative z-10 flex items-center gap-2">
                  <UserCheck className="w-6 h-6" />
                  تقديم طلب مندوب توصيل
                </h3>
                <button type="button" onClick={() => setIsModalOpen(false)} className="relative z-10 p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-5 overflow-y-auto">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">الاسم الثلاثي</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent outline-none transition-all" placeholder="اكتب اسمك الكامل" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">العنوان / المنطقة</label>
                  <input required type="text" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent outline-none transition-all" placeholder="مثال: أبي الخصيب - محيلة" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">رقم الهاتف (الواتساب)</label>
                  <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent outline-none transition-all text-right" placeholder="077..." dir="ltr" />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">نوع السيارة</label>
                  <input required type="text" value={formData.carType} onChange={e => setFormData({...formData, carType: e.target.value})} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-[#5FA8D3] focus:border-transparent outline-none transition-all" placeholder="مثال: سايبا، إلنترا..." />
                </div>
                
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <input type="checkbox" id="hasAc" checked={formData.hasAc} onChange={e => setFormData({...formData, hasAc: e.target.checked})} className="w-5 h-5 rounded text-[#5FA8D3] focus:ring-[#5FA8D3]" />
                  <label htmlFor="hasAc" className="font-bold text-gray-700 cursor-pointer select-none">السيارة تحتوي على تبريد شغال</label>
                </div>
                
                <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <input type="checkbox" id="hasCommitment" checked={formData.hasCommitment} onChange={e => setFormData({...formData, hasCommitment: e.target.checked})} className="w-5 h-5 rounded text-[#5FA8D3] focus:ring-[#5FA8D3]" />
                  <label htmlFor="hasCommitment" className="font-bold text-gray-700 cursor-pointer select-none">عندي التزام بوقت معين (وظيفة أخرى أو دراسة)</label>
                </div>
                
                <button disabled={isSubmitting} type="submit" className="w-full bg-[#5FA8D3] hover:bg-[#4a8eb9] text-white font-bold py-4 rounded-xl transition-colors shadow-lg flex justify-center items-center gap-2 mt-4">
                  {isSubmitting ? "جاري الإرسال..." : (
                    <>
                      <MessageCircle className="w-5 h-5" />
                      إرسال الطلب عبر الواتساب
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
`;

content = content.replace('    </div>\n  );\n}\n', modalJsx + '    </div>\n  );\n}\n');

fs.writeFileSync('src/app/mandob-job/page.tsx', content);
