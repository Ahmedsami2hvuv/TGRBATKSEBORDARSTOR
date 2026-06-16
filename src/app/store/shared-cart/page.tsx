"use client";

import { useEffect, useState, useTransition, Suspense } from "react";

import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSharedCart, updateSharedCartQty, removeFromSharedCart } from "@/app/store/shared-actions";

function SharedCartContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code");

  const [cartId, setCartId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [isNameSaved, setIsNameSaved] = useState<boolean>(false);
  const [cartData, setCartData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // 1. قراءة البيانات من localStorage والتأكد من وجود الكود
  useEffect(() => {
    if (code) {
      setCartId(code);
      localStorage.setItem("kse_active_shared_cart_id", code);

      const savedName = localStorage.getItem("kse_shared_user_name");
      if (savedName) {
        setUserName(savedName);
        setIsNameSaved(true);
      }
    } else {
      // إذا لم يكن هناك كود في الرابط، نحاول استرجاع آخر سلة مشتركة نشطة
      const activeId = localStorage.getItem("kse_active_shared_cart_id");
      if (activeId) {
        setCartId(activeId);
        const savedName = localStorage.getItem("kse_shared_user_name");
        if (savedName) {
          setUserName(savedName);
          setIsNameSaved(true);
        }
      } else {
        setLoading(false);
        setError("لا يوجد رمز سلة مشتركة فعال. يرجى استخدام الرابط الذي تم مشاركته معك.");
      }
    }
  }, [code]);

  // 2. جلب بيانات السلة المشتركة من السيرفر بشكل دوري (Live Refresh)
  useEffect(() => {
    if (!cartId || !isNameSaved) return;

    let isSubscribed = true;

    async function fetchCart() {
      const res = await getSharedCart(cartId!);
      if (!isSubscribed) return;

      setLoading(false);
      if (res.error) {
        setError(res.error);
      } else {
        setCartData(res.cart);
        setError(null);
      }
    }

    fetchCart();

    // تحديث البيانات كل 15 ثانية لتخفيف الضغط
    const interval = setInterval(fetchCart, 15000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [cartId, isNameSaved]);

  // حفظ الاسم الجديد
  function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    if (!nameInput.trim()) return;

    localStorage.setItem("kse_shared_user_name", nameInput.trim());
    setUserName(nameInput.trim());
    setIsNameSaved(true);
    setLoading(true);
  }

  // نسخ رابط المشاركة
  function handleCopyLink() {
    if (typeof window === "undefined") return;
    const link = `${window.location.origin}/store/shared-cart?code=${cartId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // تعديل الكميات
  async function handleQtyChange(productId: string, delta: number) {
    if (!cartId) return;
    startTransition(async () => {
      const res = await updateSharedCartQty(cartId, productId, delta);
      if (res.error) {
        alert(res.error);
      } else {
        // تحديث محلي سريع
        setCartData((prev: any) => {
          if (!prev) return prev;
          const updatedItems = prev.items.map((item: any) => {
            if (item.id === productId) {
              return { ...item, quantity: Math.max(1, item.quantity + delta) };
            }
            return item;
          });
          return { ...prev, items: updatedItems };
        });
      }
    });
  }

  // إزالة منتج
  async function handleRemove(productId: string) {
    if (!cartId) return;
    if (!confirm("هل أنت متأكد من حذف هذا المنتج؟")) return;

    startTransition(async () => {
      const res = await removeFromSharedCart(cartId, productId);
      if (res.error) {
        alert(res.error);
      } else {
        setCartData((prev: any) => {
          if (!prev) return prev;
          const updatedItems = prev.items.filter((item: any) => item.id !== productId);
          return { ...prev, items: updatedItems };
        });
      }
    });
  }

  // مغادرة السلة المشتركة والعودة للفردية
  function handleLeaveCart() {
    if (confirm("هل أنت متأكد من مغادرة السلة المشتركة والعودة للتسوق الفردي؟")) {
      localStorage.removeItem("kse_active_shared_cart_id");
      localStorage.removeItem("kse_shared_user_name");
      window.dispatchEvent(new Event("cart-updated"));
      router.push("/store");
    }
  }

  // التوجه لصفحة Checkout بالمنتجات المشتركة
  function handleCheckout() {
    if (!cartData || !cartData.items || cartData.items.length === 0) return;
    // لتمرير السلة إلى صفحة الـ checkout، سنحفظها مؤقتاً في localStorage كـ kse_cart لكي تقرأها الصفحة وتنفذها كطلب عادي، مع الاحتفاظ بمعرف السلة المشتركة
    localStorage.setItem("kse_cart", JSON.stringify(cartData.items));
    router.push(`/store/checkout?sharedCartId=${cartId}`);
  }

  // عرض صفحة التحميل أو الخطأ
  if (error) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-4">حدث خطأ ما</h2>
        <p className="text-slate-500 font-bold mb-8">{error}</p>
        <Link href="/store" className="inline-flex px-8 py-3 bg-violet-600 text-white font-black rounded-2xl hover:bg-violet-700 transition">
          الذهاب للمتجر الرئيسي
        </Link>
      </div>
    );
  }

  // 3. شاشة إدخال الاسم المنبثقة إذا لم يكن مخزناً
  if (cartId && !isNameSaved) {
    return (
      <div className="max-w-md mx-auto py-20 px-4">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto text-3xl text-white shadow-lg shadow-violet-200 dark:shadow-none animate-bounce">
            👥
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">سلة العائلة المشتركة</h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">
              مرحباً بك! لقد تمت دعوتك للانضمام إلى سلة تسوق مشتركة. يرجى كتابة اسمك لتتمكن العائلة من معرفة من أضاف المنتجات.
            </p>
          </div>
          <form onSubmit={handleSaveName} className="space-y-4 pt-4">
            <input
              type="text"
              required
              placeholder="اكتب اسمك هنا..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-violet-600 outline-none font-bold text-slate-900 dark:text-white transition"
            />
            <button
              type="submit"
              className="w-full py-4 bg-violet-600 text-white rounded-2xl font-black hover:bg-violet-700 transition active:scale-95 shadow-lg shadow-violet-200 dark:shadow-none"
            >
              الانضمام والمشاركة
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-40 text-center">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-slate-500 dark:text-slate-400 font-bold">جاري تحميل السلة المشتركة...</p>
      </div>
    );
  }

  const items = Array.isArray(cartData?.items) ? cartData.items : [];
  const subtotal = items.reduce((acc: number, item: any) => acc + Number(item.price || 0) * (item.quantity || 1), 0);
  const isOwner = cartData?.ownerName === userName;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* رأس الصفحة مع معلومات السلة */}
      <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-300 font-black rounded-lg text-xs">
              سلة مشتركة نشطة 🟢
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white">
            سلة {cartData?.ownerName} المشتركة
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold">
            مرحباً <span className="text-violet-600">{userName}</span>! يمكنك إضافة منتجات وسيقوم الجميع بمشاهدتها في نفس الوقت.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={handleCopyLink}
            className={`px-5 py-3 rounded-2xl font-black text-sm transition flex items-center gap-2 ${
              copied
                ? "bg-emerald-500 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            {copied ? "📋 تم النسخ!" : "🔗 مشاركة الرابط"}
          </button>
          <button
            onClick={handleLeaveCart}
            className="px-5 py-3 bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:bg-rose-100 rounded-2xl font-black text-sm transition"
          >
            🚪 مغادرة
          </button>
        </div>
      </div>

      {/* المنتجات في السلة */}
      {items.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
          <div className="text-6xl mb-4">🛒</div>
          <p className="text-slate-500 dark:text-slate-400 font-bold mb-6">لا توجد منتجات في السلة المشتركة حتى الآن</p>
          <Link href="/store" className="inline-flex px-8 py-3 bg-violet-600 text-white font-black rounded-2xl hover:bg-violet-700 transition">
            اذهب للمتجر لإضافة منتجات
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item: any) => (
            <div
              key={item.id}
              className="bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 animate-in fade-in"
            >
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800 shrink-0">
                {item.photo ? (
                  <img src={item.photo} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">📦</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-black text-slate-900 dark:text-white truncate">{item.name}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-violet-600 dark:text-violet-400 font-bold text-sm">
                    {Number(item.price).toLocaleString()} د.ع
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 text-[10px] md:text-xs font-bold">
                    بواسطة: <span className="text-indigo-500 dark:text-indigo-400 font-black">{item.addedBy}</span>
                  </span>
                </div>
              </div>

              {/* أزرار التحكم بالكمية */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-1 rounded-xl shrink-0">
                <button
                  disabled={isPending}
                  onClick={() => handleQtyChange(item.id, -1)}
                  className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg shadow-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50"
                >
                  -
                </button>
                <span className="font-black w-4 text-center text-slate-950 dark:text-white">{item.quantity}</span>
                <button
                  disabled={isPending}
                  onClick={() => handleQtyChange(item.id, 1)}
                  className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-700 rounded-lg shadow-sm font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50"
                >
                  +
                </button>
              </div>

              <button
                disabled={isPending}
                onClick={() => handleRemove(item.id)}
                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition shrink-0"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}

      {/* لوحة التحكم بالإتمام والطلب */}
      {items.length > 0 && (
        <div className="bg-slate-950 dark:bg-slate-900 text-white p-8 rounded-[3rem] shadow-xl space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-slate-400 font-bold text-sm block">المجموع الإجمالي المشترك</span>
              <span className="text-slate-500 text-[10px] md:text-xs">
                (يشمل إضافات جميع أفراد العائلة)
              </span>
            </div>
            <span className="text-2xl md:text-3xl font-black text-violet-400">
              {subtotal.toLocaleString()} د.ع
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/store"
              className="py-4 bg-slate-800 text-white rounded-2xl font-black text-center block hover:bg-slate-700 transition"
            >
              🛒 إضافة منتجات أخرى
            </Link>

            <button
              onClick={handleCheckout}
              className="py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-black text-center transition shadow-lg shadow-violet-800/50"
            >
              إتمام طلب السلة المشتركة
            </button>
          </div>

          {!isOwner && (
            <p className="text-center text-slate-400 text-xs font-bold mt-2">
              ⚠️ تنبيه: يفضل أن يقوم منشئ السلة ({cartData?.ownerName}) بإرسال الطلب النهائي.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function SharedCartPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto py-40 text-center">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
        <p className="text-slate-500 font-bold">جاري تحميل السلة المشتركة...</p>
      </div>
    }>
      <SharedCartContent />
    </Suspense>
  );
}
