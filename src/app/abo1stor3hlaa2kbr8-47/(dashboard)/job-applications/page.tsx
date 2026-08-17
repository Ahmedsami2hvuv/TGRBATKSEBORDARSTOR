import { prisma } from "@/lib/prisma";
import React from "react";
import { UserCheck, MapPin, Phone, Car, Clock, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function JobApplicationsPage() {
  const applications = await prisma.jobApplication.findMany({
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#22323F] flex items-center gap-3">
          <UserCheck className="w-8 h-8 text-[#5FA8D3]" />
          طلبات توظيف المندوبين
        </h1>
        <p className="text-gray-500 mt-2">هنا يمكنك مراجعة جميع الأشخاص الذين قدموا على وظيفة المندوب من الموقع.</p>
      </div>

      {applications.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-gray-100 shadow-sm">
          <UserCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-500">لا توجد طلبات توظيف حالياً</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {applications.map(app => (
            <div key={app.id} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-2 h-full bg-[#5FA8D3]" />
              
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-[#22323F]">{app.name}</h3>
                <span className="text-xs text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-md">
                  {new Date(app.createdAt).toLocaleDateString("ar-IQ", { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-gray-600 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{app.region}</span>
                </div>
                
                <div className="flex items-center gap-3 text-gray-600 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span dir="ltr">{app.phone}</span>
                </div>
                
                <div className="flex items-center gap-3 text-gray-600 text-sm">
                  <Car className="w-4 h-4 text-gray-400" />
                  <span>{app.carType}</span>
                </div>
              </div>

              <div className="space-y-2 border-t border-gray-50 pt-4">
                <div className={\`flex items-center gap-2 text-sm font-medium \${app.hasAc ? "text-green-600" : "text-gray-400"}\`}>
                  <CheckCircle2 className="w-4 h-4" />
                  {app.hasAc ? "يوجد تبريد شغال" : "لا يوجد تبريد"}
                </div>
                
                <div className={\`flex items-center gap-2 text-sm font-medium \${!app.hasCommitment ? "text-green-600" : "text-orange-500"}\`}>
                  <Clock className="w-4 h-4" />
                  {app.hasCommitment ? "لديه التزام بوقت" : "متفرغ تماماً"}
                </div>
              </div>

              <div className="mt-6">
                <a href={\`https://wa.me/\${app.phone.replace(/^0/, "964")}\`} target="_blank" rel="noreferrer" className="block w-full text-center bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white font-bold py-3 rounded-xl transition-colors">
                  مراسلة واتساب
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
