export const extractsDVHThickness = (str: string): number | null => {
  const s = str.toUpperCase();
  let m = s.match(/C[MR]RA\s*0?(\d+)/);
  if (m) return parseInt(m[1], 10);
  m = s.match(/\b0?(\d+)\s*MM\b/);
  if (m) return parseInt(m[1], 10);
  return null;
};

export const filterDVHProfiles = <T extends { profileId?: string; accessoryId?: string }>(
  items: T[],
  isDVH: boolean,
  dvhCameraId: string | undefined,
  dvhInputs: any[],
  lookupArray: any[] // aluminum for profiles, accessories for accessories
): T[] => {
  if (!isDVH || !dvhCameraId) return items.filter(i => {
     // If not DVH, remove any profile/accessory that looks like a DVH item
     const def = lookupArray.find(a => a.id === (i.profileId || i.accessoryId));
     if (!def) return true;
     const isDvhItem = extractsDVHThickness(def.code || "") !== null || extractsDVHThickness(def.detail || "") !== null;
     return !isDvhItem;
  });

  const camInput = dvhInputs.find((i) => i.id === dvhCameraId);
  if (!camInput) return items;

  let camThick = camInput.thickness || 12;
  if (!camInput.thickness && typeof camInput.detail === 'string') {
    const m = camInput.detail.match(/(\d+)\s*mm/i);
    if (m) camThick = parseInt(m[1], 10);
  }

  return items.filter((item) => {
    const defId = item.profileId || item.accessoryId;
    const def = lookupArray.find((a) => String(a.id) === String(defId) || String(a.code) === String(defId));
    if (!def) return true; // Keep if not found

    const str = `${def.code || ""} ${def.detail || ""}`.toUpperCase();
    const t = extractsDVHThickness(str);
    if (t !== null) {
      return t === camThick;
    }
    return true; // Keep generic items like "BUTILO", "SALES"
  });
};

export const getDVHExtras = (recipes: any[], isDVH: boolean) => {
  if (!isDVH || !recipes) return { profiles: [], accessories: [] };
  const dvhRecipe = recipes.find((r) => r.name.toUpperCase().includes('DVH'));
  if (!dvhRecipe) return { profiles: [], accessories: [] };
  return {
    profiles: dvhRecipe.profiles || [],
    accessories: dvhRecipe.accessories || [],
  };
};

export const calculateSalesGrams = (perimeterMeters: number, camThick: number): number => {
  let gramsPerMeter = 37.5;
  if (camThick <= 6) gramsPerMeter = 22.5;
  else if (camThick <= 9) gramsPerMeter = 37.5;
  else if (camThick <= 12) gramsPerMeter = 52.5;
  else if (camThick <= 15) gramsPerMeter = 67.5;
  else gramsPerMeter = 87.5;
  return perimeterMeters * gramsPerMeter;
};
