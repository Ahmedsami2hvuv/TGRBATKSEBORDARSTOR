"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { addSmartHintAction } from "../actions";

let leafletPromise: Promise<any> | null = null;

function loadLeaflet(): Promise<any> {
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }

    // تحميل الـ CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    // تحميل الـ JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = (window as any).L;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });
      resolve(L);
    };
    script.onerror = () => {
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return leafletPromise;
}

function getDefaultMapCenter(): { latitude: number; longitude: number } {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("last_map_center");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.latitude === "number" && typeof parsed.longitude === "number") {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  return { latitude: 30.5082, longitude: 47.7835 };
}

interface ShapeCircle {
  id: string;
  type: "circle";
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface ShapePolygon {
  id: string;
  type: "polygon";
  coords: Array<{ latitude: number; longitude: number }>;
}

type Shape = ShapeCircle | ShapePolygon;

export default function AddSmartHintPage() {
  const [name, setName] = useState("");
  const [hintType, setHintType] = useState<"circle" | "polygon">("circle");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const nameInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const shapesRef = useRef<Shape[]>([]);

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  // التركيز التلقائي عند التحميل
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // تهيئة أول شكل تلقائياً حسب نوع التحديد المختار
  useEffect(() => {
    const center = getDefaultMapCenter();
    const firstId = "first_" + Date.now();
    if (shapes.length === 0) {
      if (hintType === "circle") {
        setShapes([
          {
            id: firstId,
            type: "circle",
            latitude: center.latitude,
            longitude: center.longitude,
            radiusMeters: 100
          }
        ]);
      } else {
        const offset = 0.0004;
        setShapes([
          {
            id: firstId,
            type: "polygon",
            coords: [
              { latitude: center.latitude + offset, longitude: center.longitude - offset },
              { latitude: center.latitude + offset, longitude: center.longitude + offset },
              { latitude: center.latitude - offset, longitude: center.longitude + offset },
              { latitude: center.latitude - offset, longitude: center.longitude - offset },
            ]
          }
        ]);
      }
    }
  }, [hintType]);

  // تهيئة الخريطة مرة واحدة عند التحميل
  useEffect(() => {
    const startCenter = getDefaultMapCenter();
    
    const setupMap = async () => {
      const L = await loadLeaflet();
      if (!L) return;

      if (mapRef.current) return;

      const map = L.map("add-full-map", {
        zoomControl: true,
        scrollWheelZoom: true,
        maxZoom: 21
      }).setView([startCenter.latitude, startCenter.longitude], 19);

      // قمر صناعي
      const tileLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS',
        maxZoom: 21,
        maxNativeZoom: 19
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      map.on("moveend", () => {
        const center = map.getCenter();
        try {
          localStorage.setItem("last_map_center", JSON.stringify({ latitude: center.lat, longitude: center.lng }));
        } catch (e) {
          console.error(e);
        }
      });

      // نقر الخريطة لإضافة شكل إضافي
      map.on("click", (e: any) => {
        const clickedLat = e.latlng.lat;
        const clickedLng = e.latlng.lng;
        const newId = "shape_" + Date.now();

        if (shapesRef.current.length >= 10) {
          alert("الحد الأقصى هو 10 أشكال للاستدلال الواحد!");
          return;
        }

        if (hintType === "circle") {
          const newCircle: ShapeCircle = {
            id: newId,
            type: "circle",
            latitude: clickedLat,
            longitude: clickedLng,
            radiusMeters: 100
          };
          setShapes((prev) => [...prev, newCircle]);
        } else {
          const offset = 0.0004;
          const newPoly: ShapePolygon = {
            id: newId,
            type: "polygon",
            coords: [
              { latitude: clickedLat + offset, longitude: clickedLng - offset },
              { latitude: clickedLat + offset, longitude: clickedLng + offset },
              { latitude: clickedLat - offset, longitude: clickedLng + offset },
              { latitude: clickedLat - offset, longitude: clickedLng - offset },
            ]
          };
          setShapes((prev) => [...prev, newPoly]);
        }
      });

      mapRef.current = map;
      
      // رسم مبدئي
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    };

    setupMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [hintType]);

  // تحديث الرسوم عند تغير الأشكال بالـ State
  useEffect(() => {
    const L = (window as any).L;
    if (L && mapRef.current && shapes.length > 0) {
      renderAllShapes(L, mapRef.current, shapes);
    }
  }, [shapes]);

  // دالة الحذف لشكل محدد
  const handleDeleteShape = (id: string) => {
    setShapes((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) {
        const center = getDefaultMapCenter();
        const firstId = "first_" + Date.now();
        if (hintType === "circle") {
          return [{
            id: firstId,
            type: "circle",
            latitude: center.latitude,
            longitude: center.longitude,
            radiusMeters: 100
          } as Shape];
        } else {
          const offset = 0.0004;
          return [{
            id: firstId,
            type: "polygon",
            coords: [
              { latitude: center.latitude + offset, longitude: center.longitude - offset },
              { latitude: center.latitude + offset, longitude: center.longitude + offset },
              { latitude: center.latitude - offset, longitude: center.longitude + offset },
              { latitude: center.latitude - offset, longitude: center.longitude - offset },
            ]
          } as Shape];
        }
      }
      return filtered;
    });
  };

  const handleUpdateCircleLatLng = (id: string, lat: number, lng: number) => {
    setShapes((prev) =>
      prev.map((s) => (s.id === id && s.type === "circle" ? { ...s, latitude: lat, longitude: lng } : s))
    );
  };

  const handleUpdateCircleRadius = (id: string, radius: number) => {
    setShapes((prev) =>
      prev.map((s) => (s.id === id && s.type === "circle" ? { ...s, radiusMeters: radius } : s))
    );
  };

  const handleUpdatePolygonCoords = (id: string, newCoords: Array<{ latitude: number; longitude: number }>) => {
    setShapes((prev) =>
      prev.map((s) => (s.id === id && s.type === "polygon" ? { ...s, coords: newCoords } : s))
    );
  };

  const handleResetToSquare = (shapeId: string) => {
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id === shapeId && s.type === "polygon") {
          const pts = s.coords;
          if (pts.length === 0) return s;

          const sumLat = pts.reduce((sum, p) => sum + p.latitude, 0);
          const sumLng = pts.reduce((sum, p) => sum + p.longitude, 0);
          const centerLat = sumLat / pts.length;
          const centerLng = sumLng / pts.length;

          const offset = 0.0004;
          return {
            ...s,
            coords: [
              { latitude: centerLat + offset, longitude: centerLng - offset },
              { latitude: centerLat + offset, longitude: centerLng + offset },
              { latitude: centerLat - offset, longitude: centerLng + offset },
              { latitude: centerLat - offset, longitude: centerLng - offset },
            ]
          };
        }
        return s;
      })
    );
  };

  const handleResetFirstPolygon = () => {
    const target = shapes.find((s) => s.type === "polygon");
    if (target) {
      handleResetToSquare(target.id);
    }
  };


  const handleAddNewShape = (type: "circle" | "polygon") => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    if (shapes.length >= 10) {
      alert("الحد الأقصى هو 10 أشكال للاستدلال الواحد!");
      return;
    }

    const center = mapRef.current.getCenter();
    const newId = "shape_" + Date.now();
    
    let newShape: Shape;
    if (type === "circle") {
      newShape = {
        id: newId,
        type: "circle",
        latitude: center.lat,
        longitude: center.lng,
        radiusMeters: 100
      };
    } else {
      const offset = 0.0004;
      newShape = {
        id: newId,
        type: "polygon",
        coords: [
          { latitude: center.lat + offset, longitude: center.lng - offset },
          { latitude: center.lat + offset, longitude: center.lng + offset },
          { latitude: center.lat - offset, longitude: center.lng + offset },
          { latitude: center.lat - offset, longitude: center.lng - offset },
        ]
      };
    }

    setShapes((prev) => [...prev, newShape]);
  };

  // رسم جميع الأشكال على الخريطة
  const renderAllShapes = (L: any, map: any, currentShapes: Shape[]) => {
    map.eachLayer((layer: any) => {
      if (layer !== tileLayerRef.current) {
        map.removeLayer(layer);
      }
    });

    currentShapes.forEach((shape, index) => {
      if (shape.type === "circle") {
        const marker = L.marker([shape.latitude, shape.longitude], { draggable: true }).addTo(map);
        
        const circle = L.circle([shape.latitude, shape.longitude], {
          color: "#2563eb",
          fillColor: "#3b82f6",
          fillOpacity: 0.15,
          radius: shape.radiusMeters
        }).addTo(map);

        const popupContent = document.createElement("div");
        popupContent.className = "p-2 text-center space-y-1.5 dark:text-slate-200";
        popupContent.dir = "rtl";
        popupContent.innerHTML = `
          <p class="text-xs font-bold text-slate-700 dark:text-slate-350">📍 الدائرة رقم ${index + 1}</p>
          <p class="text-[10px] text-slate-400">التغطية: ${shape.radiusMeters} متر</p>
          <button id="del-shape-${shape.id}" class="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm transition active:scale-95 cursor-pointer">❌ حذف هذه الدائرة</button>
        `;
        marker.bindPopup(popupContent);

        marker.on("popupopen", () => {
          const btn = document.getElementById(`del-shape-${shape.id}`);
          btn?.addEventListener("click", () => {
            map.closePopup();
            handleDeleteShape(shape.id);
          });
        });

        marker.on("drag", () => {
          const pos = marker.getLatLng();
          circle.setLatLng(pos);
        });

        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          handleUpdateCircleLatLng(shape.id, pos.lat, pos.lng);
        });
      } 
      else if (shape.type === "polygon") {
        const pts = shape.coords;
        if (pts.length < 3) return;

        const latLngs = pts.map((p) => [p.latitude, p.longitude]);

        const polygon = L.polygon(latLngs, {
          color: "#f59e0b",
          fillColor: "#fbbf24",
          fillOpacity: 0.25,
          weight: 3,
          interactive: false
        }).addTo(map);

        const sumLat = pts.reduce((sum, p) => sum + p.latitude, 0);
        const sumLng = pts.reduce((sum, p) => sum + p.longitude, 0);
        const centerLat = sumLat / pts.length;
        const centerLng = sumLng / pts.length;

        const centerIcon = L.divIcon({
          className: "bg-indigo-600 border-2 border-white rounded-full w-8 h-8 shadow-2xl cursor-grab flex items-center justify-center text-xs text-white font-black animate-pulse",
          html: "🎯",
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        let startLat = centerLat;
        let startLng = centerLng;

        const centerMarker = L.marker([centerLat, centerLng], {
          draggable: true,
          icon: centerIcon
        }).addTo(map);

        const popupContent = document.createElement("div");
        popupContent.className = "p-2 text-center space-y-1.5 dark:text-slate-200";
        popupContent.dir = "rtl";
        popupContent.innerHTML = `
          <p class="text-xs font-bold text-slate-700 dark:text-slate-355">🟩 المربع السكني رقم ${index + 1}</p>
          <button id="del-shape-${shape.id}" class="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm transition active:scale-95 cursor-pointer">❌ حذف هذا المربع</button>
        `;
        centerMarker.bindPopup(popupContent);

        centerMarker.on("popupopen", () => {
          const btn = document.getElementById(`del-shape-${shape.id}`);
          btn?.addEventListener("click", () => {
            map.closePopup();
            handleDeleteShape(shape.id);
          });
        });

        centerMarker.on("dragstart", () => {
          const pos = centerMarker.getLatLng();
          startLat = pos.lat;
          startLng = pos.lng;
        });

        centerMarker.on("drag", () => {
          const newPos = centerMarker.getLatLng();
          const latDiff = newPos.lat - startLat;
          const lngDiff = newPos.lng - startLng;

          const updated = pts.map((p) => ({
            latitude: p.latitude + latDiff,
            longitude: p.longitude + lngDiff
          }));

          polygon.setLatLngs(updated.map((p) => [p.latitude, p.longitude]));

          cornerMarkers.forEach((m, idx) => {
            if (updated[idx]) {
              m.setLatLng([updated[idx].latitude, updated[idx].longitude]);
            }
          });
        });

        centerMarker.on("dragend", () => {
          const newPos = centerMarker.getLatLng();
          const latDiff = newPos.lat - startLat;
          const lngDiff = newPos.lng - startLng;

          const updated = pts.map((p) => ({
            latitude: p.latitude + latDiff,
            longitude: p.longitude + lngDiff
          }));

          handleUpdatePolygonCoords(shape.id, updated);
        });

        const cornerMarkers: any[] = [];
        pts.forEach((pt, cornerIdx) => {
          const icon = L.divIcon({
            className: "bg-amber-500 border-2 border-white rounded-full w-5 h-5 shadow-lg cursor-pointer flex items-center justify-center text-[10px] text-white font-bold",
            html: `${cornerIdx + 1}`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          const marker = L.marker([pt.latitude, pt.longitude], {
            draggable: true,
            icon: icon
          }).addTo(map);

          marker.on("drag", () => {
            const pos = marker.getLatLng();
            const updatedCoords = [...pts];
            updatedCoords[cornerIdx] = { latitude: pos.lat, longitude: pos.lng };
            polygon.setLatLngs(updatedCoords.map((p) => [p.latitude, p.longitude]));

            const sumLat = updatedCoords.reduce((sum, p) => sum + p.latitude, 0);
            const sumLng = updatedCoords.reduce((sum, p) => sum + p.longitude, 0);
            const cLat = sumLat / updatedCoords.length;
            const cLng = sumLng / updatedCoords.length;
            centerMarker.setLatLng([cLat, cLng]);
            oldLat = cLat;
            oldLng = cLng;
          });

          marker.on("dragend", () => {
            const pos = marker.getLatLng();
            const updatedCoords = [...pts];
            updatedCoords[cornerIdx] = { latitude: pos.lat, longitude: pos.lng };
            handleUpdatePolygonCoords(shape.id, updatedCoords);
          });

          marker.on("click", (e: any) => {
            L.DomEvent.stopPropagation(e);
            if (pts.length <= 3) {
              alert("لا يمكن أن يقل المربع السكني عن 3 زوايا!");
              return;
            }

            const popupDelContent = document.createElement("div");
            popupDelContent.className = "p-2 text-center space-y-1.5 dark:text-slate-200";
            popupDelContent.dir = "rtl";
            popupDelContent.innerHTML = `
              <p class="text-xs font-bold text-slate-700 dark:text-slate-350">الزاوية رقم ${cornerIdx + 1}</p>
              <button id="del-corner-${shape.id}-${cornerIdx}" class="bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm transition active:scale-95 cursor-pointer">❌ حذف الزاوية</button>
            `;
            
            L.popup()
              .setLatLng(marker.getLatLng())
              .setContent(popupDelContent)
              .openOn(map);

            setTimeout(() => {
              const btn = document.getElementById(`del-corner-${shape.id}-${cornerIdx}`);
              btn?.addEventListener("click", () => {
                map.closePopup();
                const updatedCoords = pts.filter((_, i) => i !== cornerIdx);
                handleUpdatePolygonCoords(shape.id, updatedCoords);
              });
            }, 50);
          });

          cornerMarkers.push(marker);
        });
      }
    });
  };

  // دالة لإضافة زاوية للمربع السكني الأول أو المحدد
  const handleAddPolygonCorner = (shapeId: string) => {
    const target = shapes.find((s) => s.id === shapeId);
    if (!target || target.type !== "polygon") return;

    const current = target.coords;
    if (current.length === 0) return;

    const last = current[current.length - 1];
    const newPt = { latitude: last.latitude + 0.0002, longitude: last.longitude + 0.0002 };
    const updated = [...current, newPt];

    handleUpdatePolygonCoords(shapeId, updated);
  };

  // دالة لحذف آخر زاوية
  const handleRemovePolygonCorner = (shapeId: string) => {
    const target = shapes.find((s) => s.id === shapeId);
    if (!target || target.type !== "polygon") return;

    const current = target.coords;
    if (current.length <= 3) {
      alert("لا يمكن أن يقل المربع السكني عن 3 زوايا!");
      return;
    }

    const updated = current.slice(0, -1);
    handleUpdatePolygonCoords(shapeId, updated);
  };

  // حفظ الاستدلال
  const handleSubmit = async () => {
    if (!name.trim()) {
      setErrorMsg("يرجى إدخال اسم الاستدلال الجغرافي");
      return;
    }

    if (shapes.length === 0) {
      setErrorMsg("يرجى إضافة شكل جغرافي واحد على الأقل على الخريطة");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // استخراج إحداثيات افتراضية لأول شكل لضمان التوافق مع الحقول الأساسية
      let defaultLocationStr = "";
      let defaultRadius = 100;

      const first = shapes[0];
      if (first.type === "circle") {
        defaultLocationStr = `${first.latitude.toFixed(6)}, ${first.longitude.toFixed(6)}`;
        defaultRadius = first.radiusMeters;
      } else {
        if (first.coords.length > 0) {
          defaultLocationStr = `${first.coords[0].latitude.toFixed(6)}, ${first.coords[0].longitude.toFixed(6)}`;
        }
      }

      // بنية البيانات الجديدة للأشكال المتعددة
      const polyToSend = {
        version: 2,
        shapes: shapes
      };

      const res = await addSmartHintAction(name, defaultLocationStr, defaultRadius, polyToSend as any);
      if (res.success) {
        setSuccessMsg("تم إضافة استدلالك الجغرافي بنجاح!");
        setName("");
        
        // إعادة تهيئة الأشكال
        const center = getDefaultMapCenter();
        const firstId = "first_" + Date.now();
        if (hintType === "circle") {
          setShapes([
            {
              id: firstId,
              type: "circle",
              latitude: center.latitude,
              longitude: center.longitude,
              radiusMeters: 100
            }
          ]);
        } else {
          const offset = 0.0004;
          setShapes([
            {
              id: firstId,
              type: "polygon",
              coords: [
                { latitude: center.latitude + offset, longitude: center.longitude - offset },
                { latitude: center.latitude + offset, longitude: center.longitude + offset },
                { latitude: center.latitude - offset, longitude: center.longitude + offset },
                { latitude: center.latitude - offset, longitude: center.longitude - offset },
              ]
            }
          ]);
        }
        
        setTimeout(() => nameInputRef.current?.focus(), 150);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ غير متوقع أثناء الحفظ");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] p-3 md:p-4 flex flex-col justify-between" dir="rtl">
      <div className="space-y-3">
        
        {/* رأس الصفحة المدمج */}
        <div className="flex justify-between items-center gap-4 bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 p-3 px-4 rounded-2xl shadow-sm">
          <div>
            <h1 className="text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              ➕ إضافة استدلال ذكي جديد (أشكال متعددة)
            </h1>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
              رسم عدة مربعات سكنية أو دوائر تغطية بنفس الاسم
            </p>
          </div>
          <Link
            href="/abo1stor3hlaa2kbr8-47/smart-hints"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131418] text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition active:scale-95 text-xs shadow-sm"
          >
            🔙 لوحة الاستدلالات
          </Link>
        </div>

        {/* الواجهة المقسمة لعمودين */}
        <div className="flex flex-col lg:flex-row gap-4">
          
          {/* العمود الأيمن: إدخال البيانات والتحكم والتعليمات */}
          <div className="w-full lg:w-4/12 bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5">
            
            {/* اختيار نوع النطاق الجغرافي */}
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-2">اختر طريقة التحديد الجغرافي الافتراضية</label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setHintType("circle");
                    setShapes([]);
                  }}
                  className={`py-3 text-xs font-bold rounded-lg transition ${
                    hintType === "circle"
                      ? "bg-white dark:bg-[#18181b] text-sky-600 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  📍 نطاقات دائرية (دوائر)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHintType("polygon");
                    setShapes([]);
                  }}
                  className={`py-3 text-xs font-bold rounded-lg transition ${
                    hintType === "polygon"
                      ? "bg-white dark:bg-[#18181b] text-amber-600 shadow-sm"
                      : "text-slate-500"
                  }`}
                >
                  🟩 مربعات سكنية (مضلعات)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                اسم المدخل أو نقطة الاستدلال المشتركة (مثال: حي الحسين أو كوت الحجاج)
              </label>
              <input
                ref={nameInputRef}
                type="text"
                placeholder="اكتب اسم المدخل واضغط Enter للحفظ"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                disabled={isSubmitting}
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-sm outline-none focus:border-sky-500"
              />
            </div>

            {/* قائمة الأشكال الجغرافية المضافة وإدارتها */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-500">
                🛠️ الأشكال الجغرافية الحالية ({shapes.length})
              </label>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {shapes.map((shape, idx) => (
                  <div
                    key={shape.id}
                    className="bg-slate-50 dark:bg-[#0c0d10] border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 space-y-2 shadow-sm text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700 dark:text-slate-350">
                        {shape.type === "circle" ? `📍 دائرة رقم ${idx + 1}` : `🟩 مربع سكني رقم ${idx + 1}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteShape(shape.id)}
                        className="text-rose-500 hover:text-rose-600 font-bold px-1.5 py-0.5 rounded transition hover:bg-rose-500/10 active:scale-95"
                      >
                        ❌ حذف
                      </button>
                    </div>

                    {shape.type === "circle" ? (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>📏 مسافة التغطية: {shape.radiusMeters} متر</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="500"
                          step="5"
                          value={shape.radiusMeters}
                          onChange={(e) => handleUpdateCircleRadius(shape.id, parseInt(e.target.value))}
                          className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-600"
                        />
                      </div>
                    ) : (
                       <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>📐 زوايا المربع السكني: {shape.coords.length} زوايا</span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleAddPolygonCorner(shape.id)}
                            className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-350 font-black cursor-pointer hover:bg-slate-300"
                          >
                            ➕ زاوية
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemovePolygonCorner(shape.id)}
                            className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded text-slate-700 dark:text-slate-350 font-black cursor-pointer hover:bg-slate-300"
                          >
                            ➖ زاوية
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetToSquare(shape.id)}
                            className="bg-rose-500/10 text-rose-500 px-2 py-1 rounded font-bold cursor-pointer hover:bg-rose-500/20"
                            title="إعادة ضبط لـ 4 زوايا"
                          >
                            🔄 4 زوايا
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {errorMsg && (
              <div className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 p-3.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
                ⚠️ {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                ✅ {successMsg}
              </div>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3.5 text-sm font-bold text-white transition hover:shadow-lg active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? "جاري الحفظ..." : "حفظ جميع الأشكال بنجاح"}
              </button>
            </div>

            {/* دليل تعليمات سريع وجميل */}
            <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed space-y-1">
              <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">💡 إرشادات الاستخدام السريع:</p>
              <p>• انقر على أي مكان في الخارطة لإضافة نطاق أو مربع إضافي جديد فوراً.</p>
              <p>• استخدم الماركر المركزي وسحبه لتحريك الشكل الجغرافي بأكمله.</p>
              <p>• للدوائر: تحكم بقطر كل دائرة بشكل مستقل من قائمة الأشكال الجانبية.</p>
              <p>• للمربعات: انقر على أي زاوية لحذفها أو اضغط أزرار التحكم بالزوايا بالجانب.</p>
            </div>
          </div>

          {/* العمود الأيسر: خريطة القمر الصناعي الكاملة التفاعلية */}
          <div className="w-full lg:w-8/12 bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col space-y-3">
            <div className="flex flex-col h-full justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex justify-between items-center">
                  <span>🗺️ خريطة القمر الصناعي التفاعلية (انقر لإضافة نقاط إضافية)</span>
                  <span className="text-indigo-500 text-xs font-black">إجمالي الأشكال: {shapes.length}</span>
                </label>
                <div className="relative">
                  <div
                    id="add-full-map"
                    className="h-[520px] w-full rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner z-10"
                  ></div>

                  {/* أزرار إضافة الأشكال عائمة تحت أزرار الزووم بالخريطة */}
                  <div className="absolute top-[82px] left-[10px] z-[1000] flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAddNewShape("circle")}
                      disabled={isSubmitting}
                      title="إضافة دائرة جديدة"
                      className="w-[34px] h-[34px] bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-slate-800 text-sky-600 rounded-lg shadow-md border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      📍
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddNewShape("polygon")}
                      disabled={isSubmitting}
                      title="إضافة مربع سكني جديد"
                      className="w-[34px] h-[34px] bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-slate-800 text-amber-500 rounded-lg shadow-md border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      🟩
                    </button>
                    {hintType === "polygon" && shapes.some((s) => s.type === "polygon") && (
                      <button
                        type="button"
                        onClick={handleResetFirstPolygon}
                        disabled={isSubmitting}
                        title="إعادة ضبط المربع السكني لـ 4 زوايا"
                        className="w-[34px] h-[34px] bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-slate-800 text-rose-500 rounded-lg shadow-md border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        🔄
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
