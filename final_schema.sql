-- ==========================================
-- SCRIPT DE BASE DE DATOS RECONSTRUCCIÓN TOTAL (FINAL)
-- ARISTA STUDIO - SOLUCIÓN PARA INFINITE RECURSION
-- ==========================================

-- 0. REINICIO TOTAL
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 0.1 PERMISOS ESENCIALES
-- ==========================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- ==========================================
-- 1. ESTRUCTURA BÁSICA
-- ==========================================
CREATE TABLE public.perfiles_usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'super_admin')),
    limite_dispositivos INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla para gestion de dispositivos
CREATE TABLE public.gestion_dispositivos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    nombre_dispositivo TEXT,
    last_login TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla para guardar ajustes del usuario
CREATE TABLE public.configuracion_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    config_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- Tabla para evitar recursión en RLS
CREATE TABLE public.configuracion_admin (
    email TEXT PRIMARY KEY
);
INSERT INTO public.configuracion_admin (email) VALUES ('aristastudiouno@gmail.com');

-- Función para evitar recursión en RLS (SECURITY DEFINER ignora las RLS)
CREATE OR REPLACE FUNCTION public.es_admin() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.perfiles_usuarios p
        JOIN public.configuracion_admin a ON p.email = a.email
        WHERE p.id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 2. TABLAS MAESTRAS (CON TODAS LAS COLUMNAS)
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
    master_ref TEXT,
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
    master_ref TEXT,
    code TEXT NOT NULL,
    detail TEXT,
    price_per_m2 FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE public.materiales_accesorios_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT,
    code TEXT NOT NULL,
    detail TEXT,
    unit_price FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE public.recetas_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT,
    name TEXT NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE public.tratamientos_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT,
    name TEXT NOT NULL,
    price_per_kg FLOAT DEFAULT 0,
    hex_color TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

CREATE TABLE public.paneles_usuario (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.perfiles_usuarios(id) ON DELETE CASCADE,
    master_ref TEXT,
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
    master_ref TEXT,
    type TEXT NOT NULL,
    detail TEXT,
    cost FLOAT DEFAULT 0,
    thickness FLOAT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, master_ref)
);

-- ==========================================
-- 4. PRESUPUESTOS (DATOS OPERATIVOS)
-- ==========================================
CREATE TABLE public.presupuestos (
    id TEXT PRIMARY KEY,
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

-- ==========================================
-- 5. RLS (NO RECURSIVO)
-- ==========================================
ALTER TABLE public.perfiles_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales_perfiles_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales_vidrios_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materiales_accesorios_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tratamientos_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paneles_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dvh_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestion_dispositivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_vidrios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_accesorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_tratamientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_paneles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maestro_dvh ENABLE ROW LEVEL SECURITY;

-- Política de Admin para todoss (usa la función SECURITY DEFINER)
CREATE POLICY "admin_all_perfiles" ON public.perfiles_usuarios FOR ALL USING (public.es_admin() OR auth.uid() = id);

-- Políticas generales para tablas de usuario (REUTILIZACIÓN)
CREATE POLICY "owner_or_admin_materials_perfiles" ON public.materiales_perfiles_usuario FOR ALL USING (public.es_admin() OR auth.uid() = user_id);
CREATE POLICY "owner_or_admin_materials_vidrios" ON public.materiales_vidrios_usuario FOR ALL USING (public.es_admin() OR auth.uid() = user_id);
CREATE POLICY "owner_or_admin_materials_accesorios" ON public.materiales_accesorios_usuario FOR ALL USING (public.es_admin() OR auth.uid() = user_id);
CREATE POLICY "owner_or_admin_recetas" ON public.recetas_usuario FOR ALL USING (public.es_admin() OR auth.uid() = user_id);
CREATE POLICY "owner_or_admin_tratamientos" ON public.tratamientos_usuario FOR ALL USING (public.es_admin() OR auth.uid() = user_id);
CREATE POLICY "owner_or_admin_paneles" ON public.paneles_usuario FOR ALL USING (public.es_admin() OR auth.uid() = user_id);
CREATE POLICY "owner_or_admin_dvh" ON public.dvh_usuario FOR ALL USING (public.es_admin() OR auth.uid() = user_id);
CREATE POLICY "owner_or_admin_gestion_dispositivos" ON public.gestion_dispositivos FOR ALL USING (public.es_admin() OR auth.uid() = user_id);
CREATE POLICY "owner_or_admin_configuracion_usuario" ON public.configuracion_usuario FOR ALL USING (public.es_admin() OR auth.uid() = user_id);
CREATE POLICY "owner_or_admin_presupuestos" ON public.presupuestos FOR ALL USING (public.es_admin() OR auth.uid() = user_id);

-- Para maestros:
CREATE POLICY "public_read_master_perfiles" ON public.maestro_perfiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_master_perfiles" ON public.maestro_perfiles FOR ALL USING (public.es_admin());

CREATE POLICY "public_read_master_vidrios" ON public.maestro_vidrios FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_master_vidrios" ON public.maestro_vidrios FOR ALL USING (public.es_admin());

CREATE POLICY "public_read_master_accesorios" ON public.maestro_accesorios FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_master_accesorios" ON public.maestro_accesorios FOR ALL USING (public.es_admin());

CREATE POLICY "public_read_master_recetas" ON public.maestro_recetas FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_master_recetas" ON public.maestro_recetas FOR ALL USING (public.es_admin());

CREATE POLICY "public_read_master_tratamientos" ON public.maestro_tratamientos FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_master_tratamientos" ON public.maestro_tratamientos FOR ALL USING (public.es_admin());

CREATE POLICY "public_read_master_paneles" ON public.maestro_paneles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_master_paneles" ON public.maestro_paneles FOR ALL USING (public.es_admin());

CREATE POLICY "public_read_master_dvh" ON public.maestro_dvh FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_all_master_dvh" ON public.maestro_dvh FOR ALL USING (public.es_admin());
