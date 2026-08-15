"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Link as LinkIcon, Send, MessageCircle, Users, Globe } from "lucide-react";
import { getSocialLinksAction, saveSocialLinksAction, SocialLinksConfig } from "@/lib/social-links";
import { ad } from "@/lib/admin-ui";

export function SocialLinksSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [links, setLinks] = useState<SocialLinksConfig>({
    whatsapp: "",
    telegram: "",
    instagram: "",
    facebook: "",
    tiktok: "",
    website: "",
    whatsappGroup: "",
    telegramGroup: "",
  });

  useEffect(() => {
    getSocialLinksAction().then((data) => {
      setLinks(data);
      setLoading(false);
    });
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await saveSocialLinksAction(links);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("تم حفظ الروابط بنجاح");
    }
  }

  if (loading) {
    return <div className="p-8 text-center animate-pulse text-slate-500">جاري تحميل الروابط...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="space-y-2">
          <label className="text-sm font-bold flex items-center gap-2 text-green-700">
            <MessageCircle className="w-4 h-4" /> واتساب (المراسلة)
          </label>
          <input 
            type="text" 
            className={ad.input} 
            value={links.whatsapp} 
            onChange={e => setLinks({...links, whatsapp: e.target.value})} 
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold flex items-center gap-2 text-teal-700">
            <Users className="w-4 h-4" /> كروب الواتساب
          </label>
          <input 
            type="text" 
            className={ad.input} 
            value={links.whatsappGroup} 
            onChange={e => setLinks({...links, whatsappGroup: e.target.value})} 
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold flex items-center gap-2 text-blue-500">
            <Send className="w-4 h-4" /> تليجرام (القناة/المراسلة)
          </label>
          <input 
            type="text" 
            className={ad.input} 
            value={links.telegram} 
            onChange={e => setLinks({...links, telegram: e.target.value})} 
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold flex items-center gap-2 text-sky-500">
            <Users className="w-4 h-4" /> كروب التليجرام
          </label>
          <input 
            type="text" 
            className={ad.input} 
            value={links.telegramGroup} 
            onChange={e => setLinks({...links, telegramGroup: e.target.value})} 
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold flex items-center gap-2 text-pink-600">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg> انستغرام
          </label>
          <input 
            type="text" 
            className={ad.input} 
            value={links.instagram} 
            onChange={e => setLinks({...links, instagram: e.target.value})} 
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold flex items-center gap-2 text-blue-700">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg> فيسبوك
          </label>
          <input 
            type="text" 
            className={ad.input} 
            value={links.facebook} 
            onChange={e => setLinks({...links, facebook: e.target.value})} 
            dir="ltr"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-bold flex items-center gap-2 text-slate-800">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.8-5.46-.4-2.52.41-5.18 2.21-6.94 1.56-1.52 3.8-2.26 5.95-2.1v4.21c-.81-.07-1.63.15-2.28.64-.81.6-1.32 1.57-1.35 2.59-.03 1.01.41 1.99 1.14 2.63.78.68 1.91.89 2.87.58.94-.3 1.69-1.12 1.94-2.09.17-.67.2-1.38.19-2.07-.02-3.95-.01-7.91-.01-11.86Z"/></svg> تيك توك
          </label>
          <input 
            type="text" 
            className={ad.input} 
            value={links.tiktok} 
            onChange={e => setLinks({...links, tiktok: e.target.value})} 
            dir="ltr"
          />
        </div>

          <div className="space-y-2">
            <label className="text-sm font-bold flex items-center gap-2 text-slate-600">
              <Globe className="w-4 h-4" /> الموقع الإلكتروني (الرئيسي)
            </label>
            <input 
              type="text" 
              className={ad.input} 
              value={links.website} 
              onChange={e => setLinks({...links, website: e.target.value})} 
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold flex items-center gap-2 text-red-600">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg> 
              رابط فيديو الشرح (يوتيوب)
            </label>
            <input 
              type="text" 
              className={ad.input} 
              value={links.youtubeTutorial || ""} 
              onChange={e => setLinks({...links, youtubeTutorial: e.target.value})} 
              placeholder="مثال: https://youtube.com/..."
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold flex items-center gap-2 text-indigo-600">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
              رابط الأنيميشن (Lottie JSON)
            </label>
            <input 
              type="text" 
              className={ad.input} 
              value={links.animationUrl || ""} 
              onChange={e => setLinks({...links, animationUrl: e.target.value})} 
              placeholder="رابط لملف json للأنيميشن"
              dir="ltr"
            />
          </div>

        </div>

      <div className="flex justify-end pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`${ad.buttonPrimary} flex items-center gap-2`}
        >
          {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
          <Save className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
