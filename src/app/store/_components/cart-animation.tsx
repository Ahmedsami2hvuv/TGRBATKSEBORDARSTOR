"use client";

import { useEffect, useState } from "react";

interface FlyingItem {
  id: string;
  startX: number;
  startY: number;
  imageUrl: string;
}

export function CartAnimation() {
  const [items, setItems] = useState<FlyingItem[]>([]);

  useEffect(() => {
    const handleFlyToCart = (e: any) => {
      const { startX, startY, imageUrl } = e.detail;
      if (!imageUrl) return;

      const newItem = {
        id: Math.random().toString(36).substr(2, 9),
        startX,
        startY,
        imageUrl,
      };

      setItems((prev) => [...prev, newItem]);

      // إزالة العنصر بعد انتهاء الحركة
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== newItem.id));
      }, 700);
    };

    window.addEventListener("kse:fly-to-cart", handleFlyToCart);
    return () => {
      window.removeEventListener("kse:fly-to-cart", handleFlyToCart);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999]">
      {items.map((item) => {
        let endX = window.innerWidth / 2;
        let endY = window.innerHeight - 30;

        const cartBtn = document.getElementById("cart-nav-button");
        if (cartBtn) {
          const rect = cartBtn.getBoundingClientRect();
          endX = rect.left + rect.width / 2;
          endY = rect.top + rect.height / 2;
        }

        // حساب القيم في متغيرات CSS للأنيميشن
        const style = {
          "--startX": `${item.startX - 30}px`,
          "--startY": `${item.startY - 30}px`,
          "--endX": `${endX - 30}px`,
          "--endY": `${endY - 30}px`,
          width: "60px",
          height: "60px",
          left: "0",
          top: "0",
          animation: "flyToCart 0.6s cubic-bezier(0.25, 1, 0.5, 1) forwards",
        } as React.CSSProperties;

        return (
          <img
            key={item.id}
            src={item.imageUrl}
            className="absolute rounded-full object-cover shadow-2xl border-2 border-green-500"
            style={style}
          />
        );
      })}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes flyToCart {
          0% {
             transform: translate(var(--startX), var(--startY)) scale(1.5) rotate(0deg);
             opacity: 1;
          }
          30% {
             transform: translate(var(--startX), calc(var(--startY) - 30px)) scale(1.2) rotate(15deg);
             opacity: 1;
          }
          100% {
             transform: translate(var(--endX), var(--endY)) scale(0.1) rotate(180deg);
             opacity: 0.3;
          }
        }
      `}} />
    </div>
  );
}
