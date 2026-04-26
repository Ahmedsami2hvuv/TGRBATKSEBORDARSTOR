/**
 * مطابقة لـ main.py: calculate_extra(places_count) — بالألف
 * محلان أو أقل: 0، ثم 3→1، 4→2، …، 10+→8
 */
export function calculateExtraAlfFromPlacesCount(placesCount: number): number {
  if (placesCount <= 2) return 0;
  if (placesCount >= 10) return 8;
  return placesCount - 2;
}
