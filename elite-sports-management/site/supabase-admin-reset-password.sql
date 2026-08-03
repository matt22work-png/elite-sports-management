-- Admin password-reset support (APPLIED to prod via migration
-- `admin_reset_password_helper`). Kept here for version control.
--
-- Service-role-only helper: is a given email an ESM admin? The admin-reset-user-password
-- Edge Function calls this (as service_role) to authorize the caller server-side. The
-- `private` schema isn't exposed to PostgREST, so anon/authenticated clients cannot call
-- this and cannot read private.esm_admins directly.

create or replace function public.is_admin_email(p_email text)
returns boolean
language sql
security definer
set search_path = public, private
as $$
  select exists (
    select 1 from private.esm_admins where lower(email) = lower(p_email)
  );
$$;

revoke all on function public.is_admin_email(text) from public;
revoke all on function public.is_admin_email(text) from anon;
revoke all on function public.is_admin_email(text) from authenticated;
grant execute on function public.is_admin_email(text) to service_role;

-- The Edge Function itself lives at supabase/functions/admin-reset-user-password/index.ts.
-- It requires a valid JWT (verify_jwt), then re-checks the caller is an admin via the
-- helper above, then uses the service-role Admin API (auth.admin.updateUserById) to set
-- the target user's password. The service-role key is a Supabase secret, never shipped to
-- the browser.
