BEGIN;

DELETE FROM public.profiles AS profile
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users AS auth_user
  WHERE auth_user.id = profile.id
);

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_auth_users_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

COMMIT;
