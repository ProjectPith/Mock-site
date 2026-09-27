BEGIN;

INSERT INTO public.profiles (id, full_name, role, email)
SELECT
  users.id,
  users.raw_user_meta_data ->> 'full_name',
  CASE
    WHEN users.id = 'a854c1f9-292f-49ac-89c0-37dd509e683d'::uuid THEN 'admin'
    ELSE 'client'
  END,
  users.email
FROM auth.users AS users
LEFT JOIN public.profiles AS profiles ON profiles.id = users.id
WHERE profiles.id IS NULL;

COMMIT;
