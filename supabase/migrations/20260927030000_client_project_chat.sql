BEGIN;

CREATE OR REPLACE FUNCTION public.create_client_project_chat(
  p_project_id uuid,
  p_name text,
  p_member_emails text[] DEFAULT NULL,
  p_extra_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  project_row public.projects;
  requester_email text := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));
  project_emails text[];
  member_emails text[];
  member_names text[];
  extra_email text := lower(trim(COALESCE(p_extra_email, '')));
  room_id uuid;
  room_name text := trim(COALESCE(p_name, ''));
BEGIN
  IF auth.uid() IS NULL OR requester_email = '' THEN
    RAISE EXCEPTION 'Sign in is required to create a project chat';
  END IF;

  SELECT * INTO project_row
  FROM public.projects
  WHERE id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project not found';
  END IF;

  SELECT COALESCE(array_agg(email ORDER BY email), '{}'::text[])
  INTO project_emails
  FROM (
    SELECT DISTINCT lower(trim(source.email)) AS email
    FROM (
      SELECT unnest(COALESCE(project_row.client_emails, '{}'::text[])) AS email
      UNION ALL
      SELECT regexp_split_to_table(COALESCE(project_row.client_email, ''), ',') AS email
    ) AS source
    WHERE trim(source.email) <> ''
  ) AS normalized;

  IF NOT requester_email = ANY(project_emails) THEN
    RAISE EXCEPTION 'You must be a project member to create its chat';
  END IF;

  IF p_member_emails IS NULL THEN
    member_emails := project_emails;
  ELSE
    SELECT COALESCE(array_agg(email ORDER BY email), '{}'::text[])
    INTO member_emails
    FROM (
      SELECT DISTINCT lower(trim(candidate.email)) AS email
      FROM unnest(p_member_emails) AS candidate(email)
      WHERE trim(candidate.email) <> ''
    ) AS normalized;

    IF NOT member_emails <@ project_emails THEN
      RAISE EXCEPTION 'Chat members must belong to the selected project';
    END IF;
  END IF;

  IF NOT requester_email = ANY(member_emails) THEN
    member_emails := array_append(member_emails, requester_email);
  END IF;

  IF extra_email <> '' THEN
    IF extra_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'Enter a valid additional email address';
    END IF;
    IF NOT extra_email = ANY(member_emails) THEN
      member_emails := array_append(member_emails, extra_email);
    END IF;
  END IF;

  IF room_name = '' OR length(room_name) > 100 THEN
    RAISE EXCEPTION 'Chat name must be between 1 and 100 characters';
  END IF;

  SELECT COALESCE(array_agg(COALESCE(profile.full_name, member.email) ORDER BY member.ordinal), '{}'::text[])
  INTO member_names
  FROM unnest(member_emails) WITH ORDINALITY AS member(email, ordinal)
  LEFT JOIN LATERAL (
    SELECT profiles.full_name
    FROM public.profiles AS profiles
    WHERE lower(profiles.email) = member.email
    LIMIT 1
  ) AS profile ON true;

  INSERT INTO public.chat_rooms (name, client_email, client_name, project_id)
  VALUES (
    room_name,
    array_to_string(member_emails, ', '),
    array_to_string(member_names, ', '),
    project_row.id
  )
  RETURNING id INTO room_id;

  RETURN room_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_client_project_chat(uuid, text, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_client_project_chat(uuid, text, text[], text) TO authenticated;

COMMIT;
