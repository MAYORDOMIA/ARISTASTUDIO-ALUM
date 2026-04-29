-- ========================================================
-- SCRIPT DE MIGRACIÓN UNIFICADO - ARISTA STUDIO (V3)
-- ========================================================

-- 1. LIMPIEZA Y PERMISOS DE ESQUEMA (SOLUCIONA "permission denied")
-- Ejecuta esto si ves errores de permisos en el esquema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS public.perfiles_usuarios (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'super_admin')),
    is_active BOOLEAN DEFAULT false,
    limite_dispositivos INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABLAS MAESTRAS (GENERALES)
CREATE TABLE IF NOT EXISTS public.maestro_perfiles (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    detail TEXT,
    weight_per_meter FLOAT DEFAULT 0,
    bar_length FLOAT DEFAULT 6000,
    thickness FLOAT DEFAULT 0,
    is_glazing_bead BOOLEAN DEFAULT false,
    glazing_bead_style TEXT,
    min_glass_thickness FLOAT,
    max_glass_thickness FLOAT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maestro_vidrios (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    detail TEXT,
    thickness FLOAT DEFAULT 4,
    price_per_m2 FLOAT DEFAULT 0,
    is_mirror BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maestro_accesorios (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    detail TEXT,
    unit_price FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maestro_recetas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    line TEXT,
    type TEXT,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maestro_tratamientos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price_per_kg FLOAT DEFAULT 0,
    hex_color TEXT DEFAULT '#000000',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maestro_paneles (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    detail TEXT,
    price FLOAT DEFAULT 0,
    unit TEXT DEFAULT 'm2',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.maestro_dvh (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    detail TEXT,
    cost FLOAT DEFAULT 0,
    thickness FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABLAS DE USUARIO (MATERIALES PROPIOS)
CREATE TABLE IF NOT EXISTS public.materiales_perfiles_usuario (
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
    min_glass_thickness FLOAT,
    max_glass_thickness FLOAT,
    treatment_cost FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE IF NOT EXISTS public.materiales_vidrios_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_vidrios(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    detail TEXT,
    price_per_m2 FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE IF NOT EXISTS public.materiales_accesorios_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_accesorios(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    detail TEXT,
    unit_price FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE IF NOT EXISTS public.recetas_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_recetas(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE IF NOT EXISTS public.tratamientos_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT REFERENCES public.maestro_tratamientos(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    price_per_kg FLOAT DEFAULT 0,
    hex_color TEXT DEFAULT '#000000',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE IF NOT EXISTS public.paneles_usuario (
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

CREATE TABLE IF NOT EXISTS public.dvh_usuario (
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

CREATE TABLE IF NOT EXISTS public.presupuestos (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    cliente_nombre TEXT,
    numero_presupuesto SERIAL,
    cliente_email TEXT,
    total FLOAT DEFAULT 0,
    items JSONB DEFAULT '[]',
    pdf_url TEXT,
    estado TEXT DEFAULT 'borrador' CHECK (estado IN ('borrador', 'enviado', 'aprobado', 'rechazado')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. DISPOSITIVOS
CREATE TABLE IF NOT EXISTS public.gestion_dispositivos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, device_id)
);

CREATE TABLE IF NOT EXISTS public.configuracion_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- 6. SEGURIDAD (RLS)
ALTER TABLE public.perfiles_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales_perfiles_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales_vidrios_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales_accesorios_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamientos_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paneles_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dvh_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestion_dispositivos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.configuracion_usuario ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.maestro_perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_vidrios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_accesorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_tratamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_paneles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_dvh ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS SIMPLIFICADAS
CREATE POLICY "perfiles_poly" ON public.perfiles_usuarios FOR ALL USING (auth.uid() = id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "dispositivos_poly" ON public.gestion_dispositivos FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "alu_poly" ON public.materiales_perfiles_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "vid_poly" ON public.materiales_vidrios_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "acc_poly" ON public.materiales_accesorios_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "rec_poly" ON public.recetas_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "trt_poly" ON public.tratamientos_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "pnl_poly" ON public.paneles_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "dvh_poly" ON public.dvh_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "pre_poly" ON public.presupuestos FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
CREATE POLICY "config_poly" ON public.configuracion_usuario FOR ALL USING (auth.uid() = user_id OR (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

-- POLÍTICAS MAESTROS
CREATE POLICY "maestro_read" ON public.maestro_perfiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "maestro_admin" ON public.maestro_perfiles FOR ALL USING ((SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "maestro_read_v" ON public.maestro_vidrios FOR SELECT TO authenticated USING (true);
CREATE POLICY "maestro_admin_v" ON public.maestro_vidrios FOR ALL USING ((SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "maestro_read_a" ON public.maestro_accesorios FOR SELECT TO authenticated USING (true);
CREATE POLICY "maestro_admin_a" ON public.maestro_accesorios FOR ALL USING ((SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "maestro_read_r" ON public.maestro_recetas FOR SELECT TO authenticated USING (true);
CREATE POLICY "maestro_admin_r" ON public.maestro_recetas FOR ALL USING ((SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "maestro_read_t" ON public.maestro_tratamientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "maestro_admin_t" ON public.maestro_tratamientos FOR ALL USING ((SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "maestro_read_p" ON public.maestro_paneles FOR SELECT TO authenticated USING (true);
CREATE POLICY "maestro_admin_p" ON public.maestro_paneles FOR ALL USING ((SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');

CREATE POLICY "maestro_read_d" ON public.maestro_dvh FOR SELECT TO authenticated USING (true);
CREATE POLICY "maestro_admin_d" ON public.maestro_dvh FOR ALL USING ((SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'super_admin');
