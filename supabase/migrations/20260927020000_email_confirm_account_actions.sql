BEGIN;

CREATE TABLE public.account_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('update', 'delete')),
  change_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  password_change boolean NOT NULL DEFAULT false,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_action_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_action_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_action_requests TO service_role;

CREATE OR REPLACE FUNCTION public.claim_account_action_request(p_token_hash text)
RETURNS SETOF public.account_action_requests
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.account_action_requests
  SET used_at = now()
  WHERE token_hash = p_token_hash
    AND used_at IS NULL
    AND expires_at > now()
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION public.claim_account_action_request(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_account_action_request(text) TO service_role;

COMMIT;
