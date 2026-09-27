BEGIN;

INSERT INTO public.profiles (id, full_name, role, email)
SELECT
  users.id,
  users.raw_user_meta_data ->> 'full_name',
  'client',
  users.email
FROM auth.users users
LEFT JOIN public.profiles profiles ON profiles.id = users.id
WHERE profiles.id IS NULL;

COMMIT;
