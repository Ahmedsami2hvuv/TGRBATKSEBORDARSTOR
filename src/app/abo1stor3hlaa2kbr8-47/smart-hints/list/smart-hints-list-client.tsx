"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { deleteSmartHintAction, updateSmartHintAction, addSmartHintAction } from "../actions";

interface Waypoint {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  polygonCoords?: any;
  region?: {
    name: string;
  } | null;
}

interface SmartHintsListClientProps {
  allWaypoints: Waypoint[];
}

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

function parseLatLngLocal(input: string): { latitude: number; longitude: number } | null {
  const clean = input.replace(/[()]/g, "").trim();
  const parts = clean.split(/[,\s]+/);
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { latitude: lat, longitude: lng };
    }
  }
  return null;
}

function polygonCoordsToString(coords: Array<{ latitude: number; longitude: number }>): string {
  if (!coords || !Array.isArray(coords)) return "";
  return coords.map(c => `${c.latitude.toFixed(6)}, ${c.longitude.toFixed(6)}`).join("\n");
}

function parsePolygonCoordsString(str: string): Array<{ latitude: number; longitude: number }> {
  const lines = str.split(/[\n;]+/);
  const parsed: Array<{ latitude: number; longitude: number }> = [];
  for (const line of lines) {
    const clean = line.trim();
    if (!clean) continue;
    const parts = clean.split(/[,\s]+/);
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        parsed.push({ latitude: lat, longitude: lng });
      }
    }
  }
  return parsed;
}

function getDefaultMapCenter(allWaypoints: any[]): { latitude: number; longitude: number } {
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

  if (allWaypoints && allWaypoints.length > 0) {
    return {
      latitude: allWaypoints[0].latitude,
      longitude: allWaypoints[0].longitude,
    };
  }

  return { latitude: 30.5082, longitude: 47.7835 };
}

export default function SmartHintsListClient({ allWaypoints: initialWaypoints }: SmartHintsListClientProps) {
  const [allWaypoints, setAllWaypoints] = useState<Waypoint[]>(initialWaypoints);
  const [searchTerm, setSearchTerm] = useState("");
  
  // -----------------------------------------
  // حالة ونشاط الخرائط للتعديل
  // -----------------------------------------
  const [editingWaypoint, setEditingWaypoint] = useState<Waypoint | null>(null);
  const [editName, setEditName] = useState("");
  const [editCoords, setEditCoords] = useState("");
  const [editMapRadius, setEditMapRadius] = useState(100);
  const [editHintType, setEditHintType] = useState<"circle" | "polygon">("circle");
  const [editPolygonCoords, setEditPolygonCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editNameInputRef = useRef<HTMLInputElement>(null);
  const editCoordsInputRef = useRef<HTMLInputElement>(null);

  const editMapRef = useRef<any>(null);
  const editMarkerRef = useRef<any>(null);
  const editCircleRef = useRef<any>(null);
  const editPolyRef = useRef<any>(null);
  const editPolyMarkersRef = useRef<any[]>([]);

  // -----------------------------------------
  // حالة ونشاط الخرائط للإضافة
  // -----------------------------------------
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCoords, setNewCoords] = useState("");
  const [addMapRadius, setAddMapRadius] = useState(100);
  const [addHintType, setAddHintType] = useState<"circle" | "polygon">("circle");
  const [addPolygonCoords, setAddPolygonCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [addErrorMsg, setAddErrorMsg] = useState("");
  const [isAddingSubmitting, setIsAddingSubmitting] = useState(false);

  const addNameInputRef = useRef<HTMLInputElement>(null);
  const addCoordsInputRef = useRef<HTMLInputElement>(null);

  const addMapRef = useRef<any>(null);
  const addMarkerRef = useRef<any>(null);
  const addCircleRef = useRef<any>(null);
  const addPolyRef = useRef<any>(null);
  const addPolyMarkersRef = useRef<any[]>([]);

  // مراجع لتخزين إحداثيات المضلع النشطة لتفادي مشكلة ثبات الخطوط عند السحب في الإضافة والتعديل
  const addPolyPointsRef = useRef<Array<{ latitude: number; longitude: number }>>([]);
  const editPolyPointsRef = useRef<Array<{ latitude: number; longitude: number }>>([]);

  // مزامنة النقاط المحدثة من السيرفر
  useEffect(() => {
    setAllWaypoints(initialWaypoints);
  }, [initialWaypoints]);

  // التركيز التلقائي عند فتح نافذة التعديل
  useEffect(() => {
    if (editingWaypoint) {
      setTimeout(() => editNameInputRef.current?.focus(), 150);
    }
  }, [editingWaypoint]);

  // التركيز التلقائي عند فتح نافذة الإضافة
  useEffect(() => {
    if (isAddOpen) {
      setTimeout(() => addNameInputRef.current?.focus(), 150);
    }
  }, [isAddOpen]);

  // توليد مضلع تلقائي للتعديل عند تبديل النوع إلى polygon
  useEffect(() => {
    if (editHintType === "polygon" && editPolygonCoords.length === 0) {
      const center = parseLatLngLocal(editCoords);
      if (center) {
        const offset = 0.0005; // حوالي 50 متر
        const defaultPoly = [
          { latitude: center.latitude + offset, longitude: center.longitude - offset }, // أعلى اليسار
          { latitude: center.latitude + offset, longitude: center.longitude + offset }, // أعلى اليمين
          { latitude: center.latitude - offset, longitude: center.longitude + offset }, // أسفل اليمين
          { latitude: center.latitude - offset, longitude: center.longitude - offset }, // أسفل اليسار
        ];
        setEditPolygonCoords(defaultPoly);
        editPolyPointsRef.current = defaultPoly;
        setEditCoords(polygonCoordsToString(defaultPoly));
      }
    }
  }, [editHintType]);

  // توليد مضلع تلقائي للإضافة عند تبديل النوع إلى polygon
  useEffect(() => {
    if (addHintType === "polygon" && addPolygonCoords.length === 0) {
      const center = parseLatLngLocal(newCoords) || { latitude: 30.4410, longitude: 48.0137 };
      const offset = 0.0005; // حوالي 50 متر
      const defaultPoly = [
        { latitude: center.latitude + offset, longitude: center.longitude - offset },
        { latitude: center.latitude + offset, longitude: center.longitude + offset },
        { latitude: center.latitude - offset, longitude: center.longitude + offset },
        { latitude: center.latitude - offset, longitude: center.longitude - offset },
      ];
      setAddPolygonCoords(defaultPoly);
      addPolyPointsRef.current = defaultPoly;
      setNewCoords(polygonCoordsToString(defaultPoly));
    }
  }, [addHintType]);

  // -----------------------------------------
  // دوال الخرائط التفاعلية
  // -----------------------------------------
  const initMap = async (
    elementId: string,
    lat: number,
    lng: number,
    isEdit: boolean,
    onCoordsChange: (lat: number, lng: number) => void
  ) => {
    const L = await loadLeaflet();
    if (!L) return;

    // تنظيف المرجع السابق
    const currentMapRef = isEdit ? editMapRef : addMapRef;
    if (currentMapRef.current) {
      currentMapRef.current.remove();
      currentMapRef.current = null;
      if (isEdit) {
        editMarkerRef.current = null;
        editCircleRef.current = null;
        editPolyRef.current = null;
        editPolyMarkersRef.current = [];
      } else {
        addMarkerRef.current = null;
        addCircleRef.current = null;
        addPolyRef.current = null;
        addPolyMarkersRef.current = [];
      }
    }

    const container = document.getElementById(elementId);
    if (!container) return;

    const map = L.map(elementId, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([lat, lng], 17); // زوم افتراضي عالي ومناسب لرؤية معالم البيوت

    // خريطة القمر الصناعي
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
    }).addTo(map);

    // حفظ آخر موقع خريطة تم الوصول إليه
    map.on("moveend", () => {
      const center = map.getCenter();
      try {
        localStorage.setItem("last_map_center", JSON.stringify({ latitude: center.lat, longitude: center.lng }));
      } catch (e) {
        console.error(e);
      }
    });

    if (isEdit) {
      editMapRef.current = map;
    } else {
      addMapRef.current = map;
    }

    const type = isEdit ? editHintType : addHintType;
    const radius = isEdit ? editMapRadius : addMapRadius;

    // مستمع نقر الخريطة لوضع وتحديث المواقع تلقائياً
    map.on("click", (e: any) => {
      const clickedLat = e.latlng.lat;
      const clickedLng = e.latlng.lng;

      if (type === "circle") {
        onCoordsChange(clickedLat, clickedLng);
        const marker = isEdit ? editMarkerRef.current : addMarkerRef.current;
        const circle = isEdit ? editCircleRef.current : addCircleRef.current;

        if (marker && circle) {
          marker.setLatLng([clickedLat, clickedLng]);
          circle.setLatLng([clickedLat, clickedLng]);
        } else {
          const newMarker = L.marker([clickedLat, clickedLng], { draggable: true }).addTo(map);
          const newCircle = L.circle([clickedLat, clickedLng], {
            color: "#2563eb",
            fillColor: "#3b82f6",
            fillOpacity: 0.15,
            radius: radius
          }).addTo(map);

          newMarker.on("dragend", () => {
            const position = newMarker.getLatLng();
            newCircle.setLatLng(position);
            onCoordsChange(position.lat, position.lng);
          });

          if (isEdit) {
            editMarkerRef.current = newMarker;
            editCircleRef.current = newCircle;
          } else {
            addMarkerRef.current = newMarker;
            addCircleRef.current = newCircle;
          }
        }
      } else {
        const offset = 0.0004;
        const newPoints = [
          { latitude: clickedLat + offset, longitude: clickedLng - offset },
          { latitude: clickedLat + offset, longitude: clickedLng + offset },
          { latitude: clickedLat - offset, longitude: clickedLng + offset },
          { latitude: clickedLat - offset, longitude: clickedLng - offset },
        ];
        if (isEdit) {
          setEditPolygonCoords(newPoints);
          editPolyPointsRef.current = newPoints;
          setEditCoords(polygonCoordsToString(newPoints));
        } else {
          setAddPolygonCoords(newPoints);
          addPolyPointsRef.current = newPoints;
          setNewCoords(polygonCoordsToString(newPoints));
        }
        renderPolygon(L, map, newPoints, isEdit);
      }
    });

    // وضع الدائرة الابتدائي
    if (type === "circle") {
      const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
      const circle = L.circle([lat, lng], {
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        radius: radius
      }).addTo(map);

      marker.on("dragend", () => {
        const position = marker.getLatLng();
        circle.setLatLng(position);
        onCoordsChange(position.lat, position.lng);
      });

      if (isEdit) {
        editMarkerRef.current = marker;
        editCircleRef.current = circle;
      } else {
        addMarkerRef.current = marker;
        addCircleRef.current = circle;
      }
    } 
    // وضع المضلع الابتدائي
    else {
      const polygonCoordsArr = isEdit ? editPolygonCoords : addPolygonCoords;
      const initialPoints = polygonCoordsArr.length >= 3 
        ? polygonCoordsArr
        : [
            { latitude: lat + 0.0004, longitude: lng - 0.0004 },
            { latitude: lat + 0.0004, longitude: lng + 0.0004 },
            { latitude: lat - 0.0004, longitude: lng + 0.0004 },
            { latitude: lat - 0.0004, longitude: lng - 0.0004 },
          ];

      if (isEdit) {
        setEditPolygonCoords(initialPoints);
        editPolyPointsRef.current = initialPoints;
      } else {
        setAddPolygonCoords(initialPoints);
        addPolyPointsRef.current = initialPoints;
      }

      renderPolygon(L, map, initialPoints, isEdit);
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  };

  const renderPolygon = (
    L: any,
    map: any,
    points: Array<{ latitude: number; longitude: number }>,
    isEdit: boolean
  ) => {
    const polyRefVar = isEdit ? editPolyRef : addPolyRef;
    const polyMarkersRefVar = isEdit ? editPolyMarkersRef : addPolyMarkersRef;
    const ref = isEdit ? editPolyPointsRef : addPolyPointsRef;

    if (polyRefVar.current) map.removeLayer(polyRefVar.current);
    polyMarkersRefVar.current.forEach((m) => map.removeLayer(m));
    
    ref.current = points;
    const latLngs = points.map((p) => [p.latitude, p.longitude]);

    const polygon = L.polygon(latLngs, {
      color: "#f59e0b",
      fillColor: "#fbbf24",
      fillOpacity: 0.25,
      weight: 3
    }).addTo(map);

    if (isEdit) {
      editPolyRef.current = polygon;
      editPolyMarkersRef.current = [];
    } else {
      addPolyRef.current = polygon;
      addPolyMarkersRef.current = [];
    }

    points.forEach((pt, index) => {
      const icon = L.divIcon({
        className: "bg-amber-500 border-2 border-white rounded-full w-5 h-5 shadow-lg cursor-pointer flex items-center justify-center text-[10px] text-white font-bold",
        html: `${index + 1}`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([pt.latitude, pt.longitude], {
        draggable: true,
        icon: icon
      }).addTo(map);

      // إصلاح مشكلة قفز أو تراجع الخطوط عن طريق استخدام المرجع المشترك والمحدث لحظياً أثناء السحب
      marker.on("drag", () => {
        const pos = marker.getLatLng();
        ref.current[index] = { latitude: pos.lat, longitude: pos.lng };
        polygon.setLatLngs(ref.current.map((p) => [p.latitude, p.longitude]));
      });

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        ref.current[index] = { latitude: pos.lat, longitude: pos.lng };
        if (isEdit) {
          setEditPolygonCoords([...ref.current]);
          setEditCoords(polygonCoordsToString(ref.current));
        } else {
          setAddPolygonCoords([...ref.current]);
          setNewCoords(polygonCoordsToString(ref.current));
        }
      });

      if (isEdit) {
        editPolyMarkersRef.current.push(marker);
      } else {
        addPolyMarkersRef.current.push(marker);
      }
    });
  };

  // زيادة نقاط المضلع
  const addPoint = (isEdit: boolean) => {
    const L = (window as any).L;
    const map = isEdit ? editMapRef.current : addMapRef.current;
    if (!L || !map) return;

    const ref = isEdit ? editPolyPointsRef : addPolyPointsRef;
    const current = ref.current.length > 0 ? ref.current : (isEdit ? editPolygonCoords : addPolygonCoords);
    if (current.length === 0) return;

    const last = current[current.length - 1];
    const newPt = { latitude: last.latitude + 0.0002, longitude: last.longitude + 0.0002 };
    const updated = [...current, newPt];

    if (isEdit) {
      setEditPolygonCoords(updated);
      setEditCoords(polygonCoordsToString(updated));
    } else {
      setAddPolygonCoords(updated);
      setNewCoords(polygonCoordsToString(updated));
    }
    ref.current = updated;
    renderPolygon(L, map, updated, isEdit);
  };

  // تقليل نقاط المضلع
  const removePoint = (isEdit: boolean) => {
    const L = (window as any).L;
    const map = isEdit ? editMapRef.current : addMapRef.current;
    if (!L || !map) return;

    const ref = isEdit ? editPolyPointsRef : addPolyPointsRef;
    const current = ref.current.length > 0 ? ref.current : (isEdit ? editPolygonCoords : addPolygonCoords);
    if (current.length <= 3) {
      alert("لا يمكن أن يقل المضلع السكني عن 3 زوايا!");
      return;
    }

    const updated = current.slice(0, -1);
    if (isEdit) {
      setEditPolygonCoords(updated);
      setEditCoords(polygonCoordsToString(updated));
    } else {
      setAddPolygonCoords(updated);
      setNewCoords(polygonCoordsToString(updated));
    }
    ref.current = updated;
    renderPolygon(L, map, updated, isEdit);
  };

  const updateMapRadius = (radius: number, isEdit: boolean) => {
    const circle = isEdit ? editCircleRef.current : addCircleRef.current;
    if (circle) {
      circle.setRadius(radius);
    }
  };

  const updateMapPosition = (lat: number, lng: number, isEdit: boolean) => {
    const map = isEdit ? editMapRef.current : addMapRef.current;
    const marker = isEdit ? editMarkerRef.current : addMarkerRef.current;
    const circle = isEdit ? editCircleRef.current : addCircleRef.current;

    if (map && marker && circle) {
      const pos = [lat, lng];
      map.setView(pos, map.getZoom());
      marker.setLatLng(pos);
      circle.setLatLng(pos);
    }
  };

  // -----------------------------------------
  // مراقبة حالات الإحداثيات وتحديث الخرائط
  // -----------------------------------------
  const addCoordsParsed = parseLatLngLocal(newCoords) || (addPolygonCoords.length > 0 ? addPolygonCoords[0] : null);
  const editCoordsParsed = parseLatLngLocal(editCoords) || (editPolygonCoords.length > 0 ? editPolygonCoords[0] : null);

  // خريطة الإضافة
  useEffect(() => {
    if (isAddOpen) {
      const center = addCoordsParsed || getDefaultMapCenter(allWaypoints);
      initMap("add-list-map", center.latitude, center.longitude, false, (lat, lng) => {
        if (addHintType === "circle") {
          setNewCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
      });
    }
    return () => {
      if (addMapRef.current) {
        addMapRef.current.remove();
        addMapRef.current = null;
        addMarkerRef.current = null;
        addCircleRef.current = null;
        addPolyRef.current = null;
        addPolyMarkersRef.current = [];
      }
    };
  }, [isAddOpen, addHintType]);

  useEffect(() => {
    if (isAddOpen && addCoordsParsed && addMapRef.current && addHintType === "circle") {
      updateMapPosition(addCoordsParsed.latitude, addCoordsParsed.longitude, false);
    }
  }, [newCoords]);

  useEffect(() => {
    if (isAddOpen && addMapRef.current && addHintType === "circle") {
      updateMapRadius(addMapRadius, false);
    }
  }, [addMapRadius]);

  // خريطة التعديل
  useEffect(() => {
    if (editingWaypoint) {
      const center = editCoordsParsed || getDefaultMapCenter(allWaypoints);
      initMap("edit-list-map", center.latitude, center.longitude, true, (lat, lng) => {
        if (editHintType === "circle") {
          setEditCoords(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
      });
    }
    return () => {
      if (editMapRef.current) {
        editMapRef.current.remove();
        editMapRef.current = null;
        editMarkerRef.current = null;
        editCircleRef.current = null;
        editPolyRef.current = null;
        editPolyMarkersRef.current = [];
      }
    };
  }, [!!editingWaypoint, editHintType]);

  useEffect(() => {
    if (editingWaypoint && editCoordsParsed && editMapRef.current && editHintType === "circle") {
      updateMapPosition(editCoordsParsed.latitude, editCoordsParsed.longitude, true);
    }
  }, [editCoords]);

  useEffect(() => {
    if (editingWaypoint && editMapRef.current && editHintType === "circle") {
      updateMapRadius(editMapRadius, true);
    }
  }, [editMapRadius]);

  // حذف الاستدلال
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف النقطة الدالة (${name})؟`)) {
      return;
    }

    try {
      const res = await deleteSmartHintAction(id);
      if (res.success) {
        setAllWaypoints((prev) => prev.filter((wp) => wp.id !== id));
      }
    } catch (err: any) {
      alert(err.message || "فشل حذف النقطة");
    }
  };

  // فتح التعديل
  const startEdit = (wp: Waypoint) => {
    setEditingWaypoint(wp);
    setEditName(wp.name);
    setEditMapRadius(wp.radiusMeters || 100);
    setErrorMsg("");

    // التحقق من نوع الاستدلال المخزن
    if (wp.polygonCoords && Array.isArray(wp.polygonCoords) && wp.polygonCoords.length >= 3) {
      setEditHintType("polygon");
      setEditPolygonCoords(wp.polygonCoords);
      editPolyPointsRef.current = wp.polygonCoords;
      setEditCoords(polygonCoordsToString(wp.polygonCoords));
    } else {
      setEditHintType("circle");
      setEditPolygonCoords([]);
      editPolyPointsRef.current = [];
      setEditCoords(`${wp.latitude.toFixed(6)}, ${wp.longitude.toFixed(6)}`);
    }
  };

  // حفظ التعديل
  const handleEditSubmit = async () => {
    if (!editingWaypoint) return;
    if (!editName.trim() || !editCoords.trim()) {
      setErrorMsg("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const polyToSend = editHintType === "polygon" ? editPolygonCoords : null;
      const res = await updateSmartHintAction(editingWaypoint.id, editName, editCoords, editMapRadius, polyToSend);
      if (res.success) {
        let lat = 0;
        let lng = 0;
        if (editHintType === "polygon" && editPolygonCoords.length > 0) {
          lat = editPolygonCoords[0].latitude;
          lng = editPolygonCoords[0].longitude;
        } else {
          const cleanCoords = editCoords.replace(/[()]/g, "").trim();
          const parts = cleanCoords.split(/[,\s]+/);
          lat = parseFloat(parts[0]);
          lng = parseFloat(parts[1]);
        }

        setAllWaypoints((prev) =>
          prev.map((wp) =>
            wp.id === editingWaypoint.id
              ? {
                  ...wp,
                  name: editName.trim(),
                  latitude: lat,
                  longitude: lng,
                  radiusMeters: editMapRadius,
                  polygonCoords: polyToSend,
                }
              : wp
          )
        );
        setEditingWaypoint(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ غير متوقع أثناء الحفظ");
    } finally {
      setIsSubmitting(false);
    }
  };

  // حفظ الاستدلال الجديد
  const handleAddSubmit = async () => {
    if (!newName.trim() || !newCoords.trim()) {
      setAddErrorMsg("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    setIsAddingSubmitting(true);
    setAddErrorMsg("");

    try {
      const polyToSend = addHintType === "polygon" ? addPolygonCoords : null;
      const res = await addSmartHintAction(newName, newCoords, addMapRadius, polyToSend);
      if (res.success && res.waypoint) {
        setAllWaypoints((prev) => [res.waypoint as Waypoint, ...prev]);
        setNewName("");
        setNewCoords("");
        setAddErrorMsg("");
        setAddMapRadius(100);
        setAddPolygonCoords([]);
        setTimeout(() => addNameInputRef.current?.focus(), 50);
      }
    } catch (err: any) {
      setAddErrorMsg(err.message || "حدث خطأ غير متوقع أثناء الحفظ");
    } finally {
      setIsAddingSubmitting(false);
    }
  };

  // تصفية الاستدلالات بالبحث
  const filteredWaypoints = allWaypoints.filter((wp) => {
    const term = searchTerm.toLowerCase();
    return (
      wp.name.toLowerCase().includes(term) ||
      (wp.region?.name || "").toLowerCase().includes(term) ||
      wp.latitude.toString().includes(term) ||
      wp.longitude.toString().includes(term)
    );
  });

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* رأس الصفحة */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            🧭 كل الاستدلالات المخزنة في النظام
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            إدارة وتعديل وحذف النقاط الدالة (الاستدلالات الذكية) للطلب المباشر
          </p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={() => setIsAddOpen(true)}
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white font-bold hover:shadow-lg hover:shadow-sky-500/20 transition active:scale-95 text-sm"
          >
            ➕ إضافة استدلال جديد
          </button>
          <Link
            href="/abo1stor3hlaa2kbr8-47/smart-hints"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131418] text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-slate-900 transition active:scale-95 text-sm shadow-sm"
          >
            🔙 العودة للوحة الاستدلالات
          </Link>
        </div>
      </div>

      {/* شريط البحث */}
      <div className="relative w-full">
        <input
          type="text"
          placeholder="ابحث باسم الاستدلال، اسم المنطقة، أو خطوط الطول والعرض..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 shadow-inner"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
          >
            ✕ مسح
          </button>
        )}
      </div>

      {/* جدول الاستدلالات */}
      <div className="bg-white dark:bg-[#09090b] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/30">
          <span className="text-sm font-black text-slate-700 dark:text-slate-300">
            قائمة الاستدلالات ({filteredWaypoints.length} استدلال معروض)
          </span>
        </div>
        <div className="overflow-x-auto">
          {filteredWaypoints.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-500 font-bold">
              لا توجد استدلالات تطابق معايير البحث الحالية.
            </div>
          ) : (
            <table className="w-full text-start border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold bg-slate-50/50 dark:bg-slate-900/10">
                  <th className="p-3 text-start">الاسم</th>
                  <th className="p-3 text-start">المنطقة الأصلية</th>
                  <th className="p-3 text-start">نوع الاستدلال</th>
                  <th className="p-3 text-start">نطاق التغطية</th>
                  <th className="p-3 text-start">خط العرض (Lat)</th>
                  <th className="p-3 text-start">خط الطول (Lng)</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredWaypoints.map((wp) => {
                  const isPolygon = wp.polygonCoords && Array.isArray(wp.polygonCoords) && wp.polygonCoords.length >= 3;
                  return (
                    <tr
                      key={wp.id}
                      className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-900/20"
                    >
                      <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{wp.name}</td>
                      <td className="p-3 text-slate-500">{wp.region?.name || "عامة (غير محددة)"}</td>
                      <td className="p-3">
                        {isPolygon ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-1 rounded-lg">
                            🟩 مربع سكني
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/20 px-2.5 py-1 rounded-lg">
                            📍 دائري (نطاق)
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                        {isPolygon ? "محدّد جغرافياً" : `${wp.radiusMeters} متر`}
                      </td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{wp.latitude.toFixed(6)}</td>
                      <td className="p-3 font-mono text-slate-600 dark:text-slate-400">{wp.longitude.toFixed(6)}</td>
                      <td className="p-3 text-center">
                        <div className="inline-flex gap-2">
                          <button
                            onClick={() => startEdit(wp)}
                            className="inline-flex items-center gap-1 rounded-xl bg-sky-50 dark:bg-sky-950/40 px-3 py-1.5 text-xs font-bold text-sky-600 hover:bg-sky-100 dark:hover:bg-sky-900 transition"
                          >
                            ✏️ تعديل
                          </button>
                          <button
                            onClick={() => handleDelete(wp.id, wp.name)}
                            className="inline-flex items-center gap-1 rounded-xl bg-rose-50 dark:bg-rose-950/20 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900 transition"
                          >
                            🗑️ حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* نافذة التعديل المنبثقة - نافذة ضخمة ثنائية الأعمدة */}
      {editingWaypoint && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-6xl rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-100 dark:border-slate-850">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                ✏️ تعديل الاستدلال الذكي
              </h3>
              <button
                onClick={() => setEditingWaypoint(null)}
                className="rounded-full bg-slate-100 dark:bg-slate-850 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* عمودين */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* الأيمن */}
              <div className="w-full lg:w-5/12 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* اختيار نوع النطاق الجغرافي بالتعديل */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">اختر طريقة التحديد الجغرافي</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setEditHintType("circle")}
                        className={`py-2.5 text-xs font-bold rounded-lg transition ${
                          editHintType === "circle"
                            ? "bg-white dark:bg-[#18181b] text-sky-600 shadow-sm"
                            : "text-slate-500"
                        }`}
                      >
                        📍 نطاق دائري (دبوس)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditHintType("polygon")}
                        className={`py-2.5 text-xs font-bold rounded-lg transition ${
                          editHintType === "polygon"
                            ? "bg-white dark:bg-[#18181b] text-amber-600 shadow-sm"
                            : "text-slate-500"
                        }`}
                      >
                        🟩 مربع سكني (مضلع)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      اسم المدخل (مثال: جسر ابو فلوس)
                    </label>
                    <input
                      ref={editNameInputRef}
                      type="text"
                      placeholder="اكتب اسم المدخل"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-sm outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      {editHintType === "polygon" 
                        ? "📍 إحداثيات زوايا المربع السكني الحالي (كل سطر: خط العرض, خط الطول)" 
                        : "📍 الصق الإحداثية لتحديد المركز (مثال: 30.4410, 48.0137)"}
                    </label>
                    {editHintType === "polygon" ? (
                      <textarea
                        rows={5}
                        placeholder={"30.4410, 48.0137\n30.4420, 48.0138\n..."}
                        value={editCoords}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEditCoords(val);
                          const parsed = parsePolygonCoordsString(val);
                          if (parsed.length >= 3) {
                            setEditPolygonCoords(parsed);
                            editPolyPointsRef.current = parsed;
                            const map = editMapRef.current;
                            const L = (window as any).L;
                            if (map && L) {
                              renderPolygon(L, map, parsed, true);
                            }
                          }
                        }}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-xs outline-none focus:border-sky-500 font-mono"
                      />
                    ) : (
                      <input
                        ref={editCoordsInputRef}
                        type="text"
                        placeholder="الصق الإحداثية لتظهر الخريطة"
                        value={editCoords}
                        onChange={(e) => setEditCoords(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-sm outline-none focus:border-sky-500"
                      />
                    )}
                  </div>

                  {editCoordsParsed && editHintType === "circle" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 flex justify-between">
                        <span>📏 مسافة التغطية: {editMapRadius} متر</span>
                        <span className="text-slate-400"> اسحب لتغيير الحجم</span>
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="500"
                        step="5"
                        value={editMapRadius}
                        onChange={(e) => setEditMapRadius(parseInt(e.target.value))}
                        disabled={isSubmitting}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-600"
                      />
                    </div>
                  )}

                  {editCoordsParsed && editHintType === "polygon" && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/30 space-y-2">
                      <div>💡 يمكنك سحب الدبابيس المرقمة على خريطة القمر الصناعي لتعديل ورسم حدود المنطقة السكنية بدقة فائقة.</div>
                      <div>استخدم أزرار التحكم بالأسفل لزيادة الزوايا أو إنقاصها.</div>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg">
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleEditSubmit}
                    disabled={isSubmitting}
                    className="flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3.5 text-sm font-bold text-white transition hover:shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? "جاري الحفظ..." : "حفظ التعديلات"}
                  </button>
                  <button
                    onClick={() => setEditingWaypoint(null)}
                    disabled={isSubmitting}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131418] py-3.5 text-sm font-bold text-slate-700 dark:text-slate-200 transition active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </div>

              {/* الأيسر: الخريطة */}
              <div className="w-full lg:w-7/12 flex flex-col space-y-3">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 flex justify-between items-center">
                      <span>🗺️ تموضع الاستدلال على الخريطة (قمر صناعي)</span>
                      {editHintType === "polygon" && (
                        <span className="text-amber-500 text-xs font-black">عدد الزوايا الحالية: {editPolygonCoords.length}</span>
                      )}
                    </label>
                    <div
                      id="edit-list-map"
                      className="h-[460px] w-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner z-10"
                    ></div>
                  </div>

                  {/* أزرار زيادة وتقليل النقاط للتعديل */}
                  {editHintType === "polygon" && (
                    <div className="flex gap-3 justify-center mt-3">
                      <button
                        type="button"
                        onClick={() => addPoint(true)}
                        disabled={isSubmitting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition active:scale-95 disabled:opacity-50"
                      >
                        ➕ إضافة زاوية جديدة
                      </button>
                      <button
                        type="button"
                        onClick={() => removePoint(true)}
                        disabled={isSubmitting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-md transition active:scale-95 disabled:opacity-50"
                      >
                        ➖ حذف آخر زاوية
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة استدلال جديد - نافذة ضخمة ثنائية الأعمدة */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-6xl rounded-3xl bg-white dark:bg-[#0f1115] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-100 dark:border-slate-850">
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">
                ➕ إضافة استدلال جديد
              </h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="rounded-full bg-slate-100 dark:bg-slate-850 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {/* عمودين */}
            <div className="flex flex-col lg:flex-row gap-6">
              {/* الأيمن */}
              <div className="w-full lg:w-5/12 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  {/* اختيار نوع النطاق الجغرافي */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2">اختر طريقة التحديد الجغرافي</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setAddHintType("circle")}
                        className={`py-2.5 text-xs font-bold rounded-lg transition ${
                          addHintType === "circle"
                            ? "bg-white dark:bg-[#18181b] text-sky-600 shadow-sm"
                            : "text-slate-500"
                        }`}
                      >
                        📍 نطاق دائري (دبوس)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddHintType("polygon")}
                        className={`py-2.5 text-xs font-bold rounded-lg transition ${
                          addHintType === "polygon"
                            ? "bg-white dark:bg-[#18181b] text-amber-600 shadow-sm"
                            : "text-slate-500"
                        }`}
                      >
                        🟩 مربع سكني (مضلع)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      اسم المدخل الجديد (مثال: جسر ابو فلوس أو بلوك 4)
                    </label>
                    <input
                      ref={addNameInputRef}
                      type="text"
                      placeholder="اكتب اسم المدخل واضغط Enter"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCoordsInputRef.current?.focus()}
                      disabled={isAddingSubmitting}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-sm outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      {addHintType === "polygon" 
                        ? "📍 إحداثيات زوايا المربع السكني الجديد (كل سطر: خط العرض, خط الطول)" 
                        : "📍 الصق الإحداثية لتحديد المركز (مثال: 30.4410, 48.0137)"}
                    </label>
                    {addHintType === "polygon" ? (
                      <textarea
                        rows={5}
                        placeholder={"30.4410, 48.0137\n30.4420, 48.0138\n..."}
                        value={newCoords}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewCoords(val);
                          const parsed = parsePolygonCoordsString(val);
                          if (parsed.length >= 3) {
                            setAddPolygonCoords(parsed);
                            addPolyPointsRef.current = parsed;
                            const map = addMapRef.current;
                            const L = (window as any).L;
                            if (map && L) {
                              renderPolygon(L, map, parsed, false);
                            }
                          }
                        }}
                        disabled={isAddingSubmitting}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-xs outline-none focus:border-sky-500 font-mono"
                      />
                    ) : (
                      <input
                        ref={addCoordsInputRef}
                        type="text"
                        placeholder="الصق الإحداثية لتظهر الخريطة فوراً"
                        value={newCoords}
                        onChange={(e) => setNewCoords(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddSubmit()}
                        disabled={isAddingSubmitting}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#09090b] px-4 py-3 text-sm outline-none focus:border-sky-500"
                      />
                    )}
                  </div>

                  {addCoordsParsed && addHintType === "circle" && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 flex justify-between">
                        <span>📏 مسافة التغطية: {addMapRadius} متر</span>
                        <span className="text-slate-400"> اسحب لتغيير الحجم</span>
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="500"
                        step="5"
                        value={addMapRadius}
                        onChange={(e) => setAddMapRadius(parseInt(e.target.value))}
                        disabled={isAddingSubmitting}
                        className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-600"
                      />
                    </div>
                  )}

                  {addCoordsParsed && addHintType === "polygon" && (
                    <div className="text-xs text-amber-600 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/20 p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/30 space-y-2">
                      <div>💡 يمكنك سحب الدبابيس المرقمة على خريطة القمر الصناعي لتعديل ورسم حدود المنطقة السكنية بدقة فائقة.</div>
                      <div>استخدم أزرار التحكم بالأسفل لزيادة الزوايا أو إنقاصها.</div>
                    </div>
                  )}
                </div>

                {addErrorMsg && (
                  <div className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg">
                    ⚠️ {addErrorMsg}
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleAddSubmit}
                    disabled={isAddingSubmitting}
                    className="flex-1 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3.5 text-sm font-bold text-white transition hover:shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {isAddingSubmitting ? "جاري الحفظ..." : "حفظ النقطة"}
                  </button>
                  <button
                    onClick={() => setIsAddOpen(false)}
                    disabled={isAddingSubmitting}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131418] py-3.5 text-sm font-bold text-slate-700 dark:text-slate-200 transition active:scale-95"
                  >
                    إلغاء
                  </button>
                </div>
              </div>

              {/* الأيسر */}
              <div className="w-full lg:w-7/12 flex flex-col space-y-3">
                <div className="flex flex-col h-full justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 flex justify-between items-center">
                      <span>🗺️ تموضع الاستدلال على الخريطة (قمر صناعي)</span>
                      {addHintType === "polygon" && (
                        <span className="text-amber-500 text-xs font-black">عدد الزوايا الحالية: {addPolygonCoords.length}</span>
                      )}
                    </label>
                    <div
                      id="add-list-map"
                      className="h-[460px] w-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-inner z-10"
                    ></div>
                  </div>

                  {/* أزرار زيادة وتقليل النقاط للإضافة */}
                  {addHintType === "polygon" && (
                    <div className="flex gap-3 justify-center mt-3">
                      <button
                        type="button"
                        onClick={() => addPoint(false)}
                        disabled={isAddingSubmitting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm shadow-md transition active:scale-95 disabled:opacity-50"
                      >
                        ➕ إضافة زاوية جديدة
                      </button>
                      <button
                        type="button"
                        onClick={() => removePoint(false)}
                        disabled={isAddingSubmitting}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-sm shadow-md transition active:scale-95 disabled:opacity-50"
                      >
                        ➖ حذف آخر زاوية
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
