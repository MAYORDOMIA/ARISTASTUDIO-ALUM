-- SCRIPT DEFINITIVO: LIBERAR CANDADOS DE SUPABASE (FOREIGN KEYS EN MASTER_REF)
-- Permite que cada usuario/empresa guarde perfiles, vidrios, accesorios y recetas
-- con identificadores propios sin exigir que existan previamente en el catálogo central maestro.

BEGIN;

-- 1. Eliminación directa por los nombres estándar de Postgres
ALTER TABLE public.materiales_perfiles_usuario DROP CONSTRAINT IF EXISTS materiales_perfiles_usuario_master_ref_fkey;
ALTER TABLE public.materiales_vidrios_usuario DROP CONSTRAINT IF EXISTS materiales_vidrios_usuario_master_ref_fkey;
ALTER TABLE public.materiales_accesorios_usuario DROP CONSTRAINT IF EXISTS materiales_accesorios_usuario_master_ref_fkey;
ALTER TABLE public.recetas_usuario DROP CONSTRAINT IF EXISTS recetas_usuario_master_ref_fkey;
ALTER TABLE public.tratamientos_usuario DROP CONSTRAINT IF EXISTS tratamientos_usuario_master_ref_fkey;
ALTER TABLE public.paneles_usuario DROP CONSTRAINT IF EXISTS paneles_usuario_master_ref_fkey;
ALTER TABLE public.dvh_usuario DROP CONSTRAINT IF EXISTS dvh_usuario_master_ref_fkey;

-- 2. Eliminación dinámica de seguridad (busca cualquier restricción de llave foránea restante sobre 'master_ref')
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.table_schema, tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'master_ref'
          AND tc.table_name IN (
            'materiales_perfiles_usuario',
            'materiales_vidrios_usuario',
            'materiales_accesorios_usuario',
            'recetas_usuario',
            'tratamientos_usuario',
            'paneles_usuario',
            'dvh_usuario'
          )
    ) LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I;', r.table_schema, r.table_name, r.constraint_name);
        RAISE NOTICE 'Candado liberado: % en tabla %', r.constraint_name, r.table_name;
    END LOOP;
END $$;

COMMIT;
