-- Script para la creación y configuración de la tabla de anuncios (Globales e Individuales)
-- Ejecutar este script en Supabase -> SQL Editor para corregir permisos y habilitar mensajes individuales

CREATE TABLE IF NOT EXISTS public.anuncios_globales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_active boolean DEFAULT true,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_email text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS target_user_email text;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.anuncios_globales ADD COLUMN IF NOT EXISTS type text DEFAULT 'info';

-- Crear índice para optimizar consultas de anuncios activos
CREATE INDEX IF NOT EXISTS idx_anuncios_active_target ON public.anuncios_globales (is_active, target_user_id);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.anuncios_globales ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas previas conflictivas
DROP POLICY IF EXISTS "Users can read their announcements" ON public.anuncios_globales;
DROP POLICY IF EXISTS "Anyone can read active announcements" ON public.anuncios_globales;
DROP POLICY IF EXISTS "Super admins can manage announcements" ON public.anuncios_globales;

-- Política de lectura segura:
-- Utiliza auth.jwt() ->> 'email' y perfiles_usuarios para evitar cualquier error de permisos en auth.users
CREATE POLICY "Users can read their announcements" ON public.anuncios_globales
  FOR SELECT USING (
    is_active = true 
    AND (
      (target_user_id IS NULL AND target_user_email IS NULL)
      OR (auth.uid() IS NOT NULL AND target_user_id = auth.uid())
      OR (auth.jwt() ->> 'email' IS NOT NULL AND target_user_email = (auth.jwt() ->> 'email'))
      OR (auth.uid() IS NOT NULL AND target_user_email = (SELECT email FROM public.perfiles_usuarios WHERE id = auth.uid()))
    )
  );

-- Política de administración:
-- Solo el super_admin puede insertar, actualizar o eliminar anuncios
CREATE POLICY "Super admins can manage announcements" ON public.anuncios_globales
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.perfiles_usuarios 
      WHERE perfiles_usuarios.id = auth.uid() 
      AND perfiles_usuarios.role = 'super_admin'
    )
  );
