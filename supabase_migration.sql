-- ESQUEMA DE MIGRACIÓN PROFESIONAL PARA ARISTA STUDIO (SUPABASE) - VERSIÓN 2
-- Ejecuta este script completo en el SQL Editor de tu Dashboard de Supabase

-- 0. Limpieza (Opcional pero recomendada para evitar conflictos de tipo)
DROP TABLE IF EXISTS quotes;
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS panel_inventory;
DROP TABLE IF EXISTS treatment_inventory;
DROP TABLE IF EXISTS dvh_inventory;
DROP TABLE IF EXISTS accessory_inventory;
DROP TABLE IF EXISTS glass_inventory;
DROP TABLE IF EXISTS aluminum_inventory;

-- 1. Tabla de Perfiles de Aluminio
CREATE TABLE aluminum_inventory (
    id TEXT PRIMARY KEY, -- Cambiado a TEXT para soportar IDs existentes del sistema
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    detail TEXT,
    weight_per_meter FLOAT DEFAULT 0,
    bar_length FLOAT DEFAULT 6,
    thickness FLOAT DEFAULT 0,
    treatment_cost FLOAT DEFAULT 0,
    is_glazing_bead BOOLEAN DEFAULT false,
    glazing_bead_style TEXT,
    min_glass_thickness FLOAT DEFAULT 0,
    max_glass_thickness FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabla de Vidrios
CREATE TABLE glass_inventory (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    detail TEXT,
    width FLOAT DEFAULT 0,
    height FLOAT DEFAULT 0,
    thickness FLOAT DEFAULT 0,
    price_per_m2 FLOAT DEFAULT 0,
    is_mirror BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Tabla de Accesorios
CREATE TABLE accessory_inventory (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    detail TEXT,
    unit_price FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Tabla de Insumos DVH
CREATE TABLE dvh_inventory (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT,
    detail TEXT,
    thickness FLOAT DEFAULT 0,
    cost FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Tabla de Tratamientos/Colores
CREATE TABLE treatment_inventory (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_per_kg FLOAT DEFAULT 0,
    hex_color TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Tabla de Paneles Ciegos
CREATE TABLE panel_inventory (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    detail TEXT,
    price FLOAT DEFAULT 0,
    unit TEXT DEFAULT 'm2',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Tabla de Recetas (Plantillas)
CREATE TABLE recipes (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Tabla de Presupuestos (Quotes)
CREATE TABLE quotes (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_name TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Añadir flag de migración al perfil actual
ALTER TABLE IF EXISTS profiles ADD COLUMN IF NOT EXISTS is_migrated BOOLEAN DEFAULT false;

-- Habilitar Row Level Security (RLS) para todas las tablas
ALTER TABLE aluminum_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE glass_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE accessory_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvh_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE panel_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Crear políticas con nombres únicos para evitar errores
CREATE POLICY "owner_all_aluminum" ON aluminum_inventory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_all_glass" ON glass_inventory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_all_accessories" ON accessory_inventory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_all_dvh" ON dvh_inventory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_all_treatments" ON treatment_inventory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_all_panels" ON panel_inventory FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_all_recipes" ON recipes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "owner_all_quotes" ON quotes FOR ALL USING (auth.uid() = user_id);

