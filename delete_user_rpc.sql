CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Verify the caller is super_admin
    IF (SELECT role FROM public.perfiles_usuarios WHERE id = auth.uid()) != 'super_admin' THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Delete from auth.users (this will cascade to perfiles_usuarios and all other tables)
    DELETE FROM auth.users WHERE id = target_user_id;

END;
$$;
