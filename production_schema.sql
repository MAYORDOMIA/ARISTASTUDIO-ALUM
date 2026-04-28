-- ==========================================
-- SCRIPT DE BASE DE DATOS INDUSTRIAL PREMIUM
-- ARISTA STUDIO - SUPABASE RECONSTRUCCIÓN TOTAL
-- ==========================================

-- 0. REINICIO TOTAL
-- IMPORTANTE: Esto borrará todos los datos existentes en el esquema public.
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- ==========================================
-- 0.1 PERMISOS DE ESQUEMA (FIX PARA ERRORES DE ACCESO)
-- ==========================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. PERFILES Y GESTIÓN DE DISPOSITIVOS
-- ==========================================

CREATE TABLE public.perfiles_usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'super_admin')),
    limite_dispositivos INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT false, -- Empiezan inactivos por defecto
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.gestion_dispositivos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    last_login TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, device_id)
);

-- ==========================================
-- 2. TABLAS MAESTRAS (PLANTILLAS GLOBALES)
-- ==========================================

CREATE TABLE public.maestro_perfiles (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    detail TEXT,
    weight_per_meter FLOAT DEFAULT 0,
    bar_length FLOAT DEFAULT 6000,
    thickness FLOAT DEFAULT 0,
    is_glazing_bead BOOLEAN DEFAULT false,
    glazing_bead_style TEXT,
    min_glass_thickness FLOAT DEFAULT 0,
    max_glass_thickness FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.maestro_vidrios (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    detail TEXT,
    thickness FLOAT DEFAULT 0,
    price_per_m2 FLOAT DEFAULT 0,
    is_mirror BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.maestro_accesorios (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    detail TEXT,
    unit_price FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.maestro_tratamientos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_per_kg FLOAT DEFAULT 0,
    hex_color TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.maestro_recetas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    line TEXT,
    type TEXT,
    visual_type TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.maestro_paneles (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    detail TEXT,
    price FLOAT DEFAULT 0,
    unit TEXT DEFAULT 'm2',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.maestro_dvh (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('Cámara', 'Butilo', 'Sales', 'Escuadras')),
    detail TEXT,
    cost FLOAT DEFAULT 0,
    thickness FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 3. TABLAS DE USUARIO (DATOS OPERATIVOS)
-- ==========================================

CREATE TABLE public.materiales_perfiles_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_perfiles(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    detail TEXT,
    weight_per_meter FLOAT DEFAULT 0,
    bar_length FLOAT DEFAULT 6000,
    thickness FLOAT DEFAULT 0,
    is_glazing_bead BOOLEAN DEFAULT false,
    glazing_bead_style TEXT,
    min_glass_thickness FLOAT DEFAULT 0,
    max_glass_thickness FLOAT DEFAULT 0,
    treatment_cost FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE public.materiales_vidrios_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_vidrios(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    detail TEXT,
    price_per_m2 FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE public.materiales_accesorios_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_accesorios(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    detail TEXT,
    unit_price FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE public.recetas_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_recetas(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE public.tratamientos_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_tratamientos(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price_per_kg FLOAT DEFAULT 0,
    hex_color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE public.paneles_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_paneles(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    detail TEXT,
    price FLOAT DEFAULT 0,
    unit TEXT DEFAULT 'm2',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE public.dvh_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_dvh(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    detail TEXT,
    cost FLOAT DEFAULT 0,
    thickness FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

-- ==========================================
-- 4. MOVIMIENTOS: PRESUPUESTOS Y PEDIDOS
-- ==========================================

CREATE TABLE public.presupuestos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    numero_presupuesto SERIAL,
    cliente_nombre TEXT,
    cliente_email TEXT,
    total FLOAT DEFAULT 0,
    items JSONB DEFAULT '[]',
    pdf_url TEXT,
    estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviado', 'aprobado', 'rechazado')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.pedidos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    presupuesto_id UUID REFERENCES public.presupuestos(id) ON DELETE SET NULL,
    total FLOAT DEFAULT 0,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_produccion', 'completado', 'entregado')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 5. LÓGICA DE AUTOMATIZACIÓN (TRIGGERS)
-- ==========================================

CREATE OR REPLACE FUNCTION public.crear_perfil_y_clonar_datos()
RETURNS TRIGGER AS $$
DECLARE
    super_admin_email TEXT := 'aristastudiouno@gmail.com';
BEGIN
    -- 1. Crear Perfil de Usuario
    INSERT INTO public.perfiles_usuarios (id, email, role, is_active)
    VALUES (
        NEW.id, 
        NEW.email, 
        CASE WHEN NEW.email = super_admin_email THEN 'super_admin' ELSE 'user' END,
        CASE WHEN NEW.email = super_admin_email THEN true ELSE false END
    );

    -- 2. Clonar Perfiles Maestros
    INSERT INTO public.materiales_perfiles_usuario (user_id, master_ref, code, detail, weight_per_meter, bar_length, thickness, is_glazing_bead, glazing_bead_style, min_glass_thickness, max_glass_thickness)
    SELECT NEW.id, id, code, detail, weight_per_meter, bar_length, thickness, is_glazing_bead, glazing_bead_style, min_glass_thickness, max_glass_thickness
    FROM public.maestro_perfiles;

    -- 3. Vidrios
    INSERT INTO public.materiales_vidrios_usuario (user_id, master_ref, code, detail, price_per_m2)
    SELECT NEW.id, id, code, detail, price_per_m2
    FROM public.maestro_vidrios;

    -- 4. Accesorios
    INSERT INTO public.materiales_accesorios_usuario (user_id, master_ref, code, detail, unit_price)
    SELECT NEW.id, id, code, detail, unit_price
    FROM public.maestro_accesorios;

    -- 5. Recetas
    INSERT INTO public.recetas_usuario (user_id, master_ref, name, data)
    SELECT NEW.id, id, name, data
    FROM public.maestro_recetas;

    -- 6. Tratamientos
    INSERT INTO public.tratamientos_usuario (user_id, master_ref, name, price_per_kg, hex_color)
    SELECT NEW.id, id, name, price_per_kg, hex_color
    FROM public.maestro_tratamientos;

    -- 7. Paneles
    INSERT INTO public.paneles_usuario (user_id, master_ref, code, detail, price, unit)
    SELECT NEW.id, id, code, detail, price, unit
    FROM public.maestro_paneles;

    -- 8. DVH
    INSERT INTO public.dvh_usuario (user_id, master_ref, type, detail, cost, thickness)
    SELECT NEW.id, id, type, detail, cost, thickness
    FROM public.maestro_dvh;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- IMPORTANTE: Para activar el trigger corre esto en el editor:
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
-- AFTER INSERT ON auth.users
-- FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_y_clonar_datos();

-- ==========================================
-- 6. SEGURIDAD (RLS - ROW LEVEL SECURITY)
-- ==========================================

ALTER TABLE perfiles_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion_dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiales_perfiles_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiales_vidrios_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE materiales_accesorios_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE recetas_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE tratamientos_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE paneles_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE dvh_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestro_perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestro_vidrios ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestro_accesorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestro_recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestro_tratamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestro_paneles ENABLE ROW LEVEL SECURITY;
ALTER TABLE maestro_dvh ENABLE ROW LEVEL SECURITY;

-- Helper Administrador (Referencia rápida pero usamos inline por seguridad y para evitar recursión)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.perfiles_usuarios 
        WHERE id = auth.uid() AND (role = 'super_admin' OR email = 'aristastudiouno@gmail.com')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- POLÍTICAS
CREATE POLICY "perfiles_owner_or_admin" ON perfiles_usuarios FOR ALL USING (auth.uid() = id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "dispositivos_owner_or_admin" ON gestion_dispositivos FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "materials_owner_or_admin" ON materiales_perfiles_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "glass_owner_or_admin" ON materiales_vidrios_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "acc_owner_or_admin" ON materiales_accesorios_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "treatments_owner_or_admin" ON tratamientos_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "panels_owner_or_admin" ON paneles_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "dvh_owner_or_admin" ON dvh_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "recipes_owner_or_admin" ON recetas_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "quotes_owner_or_admin" ON presupuestos FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "orders_owner_or_admin" ON pedidos FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

-- Maestros: Todos leen, solo Admin edita
CREATE POLICY "everyone_read_masters_perfiles" ON maestro_perfiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_masters_perfiles" ON maestro_perfiles FOR ALL USING ((SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "everyone_read_masters_vidrios" ON maestro_vidrios FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_masters_vidrios" ON maestro_vidrios FOR ALL USING ((SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "everyone_read_masters_accesorios" ON maestro_accesorios FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_masters_accesorios" ON maestro_accesorios FOR ALL USING ((SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "everyone_read_masters_tratamientos" ON maestro_tratamientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_masters_tratamientos" ON maestro_tratamientos FOR ALL USING ((SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "everyone_read_masters_recetas" ON maestro_recetas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_masters_recetas" ON maestro_recetas FOR ALL USING ((SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "everyone_read_masters_paneles" ON maestro_paneles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_masters_paneles" ON maestro_paneles FOR ALL USING ((SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "everyone_read_masters_dvh" ON maestro_dvh FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_masters_dvh" ON maestro_dvh FOR ALL USING ((SELECT role FROM perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

-- ==========================================
-- 7. SEMILLA DE DATOS (MUESTRA)
-- ==========================================

-- Vidrios
INSERT INTO maestro_vidrios (id, code, detail, thickness, price_per_m2) VALUES
('v1', 'FLOAT 4mm', 'Cristal Incoloro 4mm', 4, 16017),
('v2', 'FLOAT 5mm', 'Cristal Incoloro 5mm', 5, 20950),
('v3', 'FLOAT 6mm', 'Cristal Incoloro 6mm', 6, 24530),
('v4', 'LAM 3+3', 'Laminado Incoloro 3+3', 6, 55068);

-- Accesorios
INSERT INTO maestro_accesorios (id, code, detail, unit_price) VALUES
('a1', 'FALL-H', 'Falleba Herrero Estándar', 1200),
('a2', 'RUEDA-H', 'Rueda Rulemán Herrero', 850),
('a3', 'FELPA', 'Felpa 5x7 mm (metro)', 150);

-- Perfiles (Ejemplos)
INSERT INTO maestro_perfiles (id, code, detail, bar_length, weight_per_meter) VALUES
('1774641461111-0', '1', 'Marco Corrediza Herrero', 6030, 0.731),
('1774641461111-1', '2', 'Zócalo/Cabezal Corrediza Herrero', 6000, 0.355),
('1774641461111-2', '3', 'Parante Lateral Corrediza Herrero', 6000, 0.366);

