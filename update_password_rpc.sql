-- Ejecuta este script en el editor SQL de Supabase
CREATE OR REPLACE FUNCTION public.update_user_password_by_admin(target_user_id UUID, new_password TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- Verify the caller is super_admin
    IF (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) != 'super_admin' THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Update auth.users password using pgcrypto crypt function
    UPDATE auth.users 
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = target_user_id;
END;
$$;
