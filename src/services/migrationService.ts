import { supabase } from './supabaseClient';

/**
 * Servicio de Base de Datos Simplificado (V3)
 * Sin automatismos, sin clonado, sin sincronización maestra.
 * Diseñado para carga manual de JSON y gestión directa.
 */

// Función para limpiar absolutamente todo el inventario del usuario actual
export const wipeUserInventory = async (userId: string) => {
  const tables = [
    'aluminum_inventory',
    'glass_inventory',
    'accessory_inventory',
    'dvh_inventory',
    'treatment_inventory',
    'panel_inventory',
    'recipes',
    'quotes'
  ];

  const results = await Promise.all(
    tables.map(table => supabase.from(table).delete().eq('user_id', userId))
  );

  const errors = results.filter(r => r.error).map(r => r.error?.message);
  return { success: errors.length === 0, errors };
};

// Función para guardar datos masivos desde JSON o pantalla
export const saveBulkData = async (userId: string, data: any) => {
  const { aluminum, glasses, blindPanels, accessories, dvhInputs, treatments, recipes, quotes } = data;
  
  const prepare = (list: any[], mapper: (x: any) => any) => {
    if (!list || !Array.isArray(list)) return [];
    return list.map(item => ({
      ...mapper(item),
      user_id: userId,
      // Aseguramos que el ID tenga el sufijo del usuario para unicidad en tablas compartidas
      id: String(item.id).split('_')[0] + '_' + userId
    }));
  };

  const ops = [];

  if (aluminum) ops.push(supabase.from('aluminum_inventory').upsert(prepare(aluminum, x => ({
    id: x.id, code: x.code, detail: x.detail, weight_per_meter: x.weightPerMeter, bar_length: x.barLength,
    thickness: x.thickness, treatment_cost: x.treatmentCost, is_glazing_bead: x.isGlazingBead,
    glazing_bead_style: x.glazingBeadStyle, min_glass_thickness: x.minGlassThickness, max_glass_thickness: x.maxGlassThickness
  })), { onConflict: 'id' }));

  if (glasses) ops.push(supabase.from('glass_inventory').upsert(prepare(glasses, x => ({
    id: x.id, code: x.code, detail: x.detail, width: x.width, height: x.height, thickness: x.thickness,
    price_per_m2: x.pricePerM2, is_mirror: x.is_mirror
  })), { onConflict: 'id' }));

  if (accessories) ops.push(supabase.from('accessory_inventory').upsert(prepare(accessories, x => ({
    id: x.id, code: x.code, detail: x.detail, unit_price: x.unitPrice
  })), { onConflict: 'id' }));

  if (dvhInputs) ops.push(supabase.from('dvh_inventory').upsert(prepare(dvhInputs, x => ({
    id: x.id, type: x.type, detail: x.detail, thickness: x.thickness, cost: x.cost
  })), { onConflict: 'id' }));

  if (treatments) ops.push(supabase.from('treatment_inventory').upsert(prepare(treatments, x => ({
    id: x.id, name: x.name, price_per_kg: x.pricePerKg, hex_color: x.hexColor
  })), { onConflict: 'id' }));

  if (blindPanels) ops.push(supabase.from('panel_inventory').upsert(prepare(blindPanels, x => ({
    id: x.id, code: x.code, detail: x.detail, price: x.price, unit: x.unit
  })), { onConflict: 'id' }));

  const results = await Promise.all(ops);
  const errors = results.filter(r => r.error).map(r => r.error?.message);
  
  return { success: errors.length === 0, errors };
};
