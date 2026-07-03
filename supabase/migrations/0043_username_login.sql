-- 0043_username_login.sql
--
-- Lets clients sign in with USERNAME instead of email (GradienteiOS's
-- "CORREO O USUARIO" field; the web login can adopt it too).
--
-- GoTrue's password grant only accepts an email, so the client first
-- resolves alias → email. A naive "email_for_username" RPC would be a
-- user-enumeration + email-harvesting surface; instead, verify_login only
-- reveals the email WHEN THE CALLER ALREADY KNOWS THE PASSWORD — it
-- checks the bcrypt hash in auth.users via pgcrypto before returning
-- anything. Wrong password or unknown alias → null, indistinguishable.
--
-- ⚠ OPERATIONAL NOTE (see 0028/0033/0040/0041): prod migration history is
-- drifted — apply this BY HAND in the Supabase SQL editor. NEVER `supabase
-- db push`.

create or replace function public.verify_login(p_username text, p_password text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text;
  v_hash  text;
begin
  select au.email, au.encrypted_password
    into v_email, v_hash
  from public.users pu
  join auth.users au on au.id = pu.id
  where lower(pu.username) = lower(trim(p_username))
  limit 1;

  if v_email is null or v_hash is null or v_hash = '' then
    return null;
  end if;

  -- bcrypt verify (GoTrue hashes are $2a$…); pgcrypto's crypt() re-derives
  -- with the stored salt. Constant-shaped response either way.
  if extensions.crypt(p_password, v_hash) = v_hash then
    return v_email;
  end if;

  return null;
end;
$$;

comment on function public.verify_login(text, text) is
  'Alias login resolver: returns the email for a username ONLY when the password verifies against auth.users. Null otherwise. Added for GradienteiOS.';

-- Same exposure discipline as peek_invite_card (0033/0034):
revoke execute on function public.verify_login(text, text) from public;
grant execute on function public.verify_login(text, text) to anon, authenticated, service_role;
