-- SCRIPT DE CORRECCIÓN PROFESIONAL: Permite guardar perfiles y materiales personalizados.
-- Al usar UUIDs u IDs generados localmente (Date.now()) para perfiles nuevos,
-- estos no existen en las tablas 'maestras'. Por tanto, debemos quitar la restricción
-- de llave foránea (Foreign Key) de 'master_ref' para permitir ítems propios de cada empresa.

BEGIN;

ALTER TABLE public.materiales_perfiles_usuario DROP CONSTRAINT IF EXISTS materiales_perfiles_usuario_master_ref_fkey;
ALTER TABLE public.materiales_vidrios_usuario DROP CONSTRAINT IF EXISTS materiales_vidrios_usuario_master_ref_fkey;
ALTER TABLE public.materiales_accesorios_usuario DROP CONSTRAINT IF EXISTS materiales_accesorios_usuario_master_ref_fkey;
ALTER TABLE public.recetas_usuario DROP CONSTRAINT IF EXISTS recetas_usuario_master_ref_fkey;
ALTER TABLE public.tratamientos_usuario DROP CONSTRAINT IF EXISTS tratamientos_usuario_master_ref_fkey;
ALTER TABLE public.paneles_usuario DROP CONSTRAINT IF EXISTS paneles_usuario_master_ref_fkey;
ALTER TABLE public.dvh_usuario DROP CONSTRAINT IF EXISTS dvh_usuario_master_ref_fkey;

COMMIT;
