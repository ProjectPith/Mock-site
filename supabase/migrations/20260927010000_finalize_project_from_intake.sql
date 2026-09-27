BEGIN;

CREATE TABLE IF NOT EXISTS public.project_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  company_name text,
  project_description text,
  target_audience text,
  custom_domain text,
  site_type text,
  color_mode text,
  color_details jsonb,
  selected_features text[] NOT NULL DEFAULT '{}',
  custom_specifications text,
  extra_notes text,
  vibe_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
  recurrence text NOT NULL DEFAULT 'none',
  needs text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_maintenance ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.project_details, public.project_maintenance FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.project_details, public.project_maintenance TO authenticated;

CREATE POLICY project_details_select_client_or_admin ON public.project_details
FOR SELECT TO authenticated
USING (
  (SELECT private.is_admin())
  OR EXISTS (
    SELECT 1 FROM public.projects project
    WHERE project.id = project_details.project_id
      AND (
        lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
          string_to_array(lower(replace(COALESCE(project.client_email, ''), ' ', '')), ',')
        )
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(project.client_emails, '{}'::text[])) party(email)
          WHERE lower(trim(party.email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
        )
      )
  )
);

CREATE POLICY project_maintenance_select_client_or_admin ON public.project_maintenance
FOR SELECT TO authenticated
USING (
  (SELECT private.is_admin())
  OR EXISTS (
    SELECT 1 FROM public.projects project
    WHERE project.id = project_maintenance.project_id
      AND (
        lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
          string_to_array(lower(replace(COALESCE(project.client_email, ''), ' ', '')), ',')
        )
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(project.client_emails, '{}'::text[])) party(email)
          WHERE lower(trim(party.email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
        )
      )
  )
);

CREATE OR REPLACE FUNCTION public.finalize_project_from_intake(
  p_intake_id uuid,
  p_intake_pdf_url text DEFAULT NULL,
  p_total_cost numeric DEFAULT 0,
  p_client_names text[] DEFAULT '{}',
  p_contract_terms jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  intake_row public.project_intakes;
  project_row public.projects;
  room_row public.chat_rooms;
  primary_email text;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can finalize project intakes';
  END IF;

  SELECT * INTO intake_row
  FROM public.project_intakes
  WHERE id = p_intake_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Intake % was not found', p_intake_id;
  END IF;

  primary_email := COALESCE(intake_row.client_emails[1], 'client@example.com');

  INSERT INTO public.projects (
    name, client_email, status, total_cost, intake_pdf_url, contract_pdf_url,
    client_emails, client_names, project_description, color_mode, color_details,
    site_type, selected_features, extra_notes, custom_domain, target_audience,
    company_name
  ) VALUES (
    intake_row.project_name,
    primary_email,
    'Active',
    COALESCE(p_total_cost, 0),
    p_intake_pdf_url,
    NULL,
    intake_row.client_emails,
    COALESCE(p_client_names, '{}'),
    intake_row.project_description,
    intake_row.color_mode,
    intake_row.color_details,
    intake_row.site_type,
    array_to_string(COALESCE(intake_row.selected_features, '{}'), ', '),
    intake_row.extra_notes,
    intake_row.custom_domain,
    intake_row.target_audience,
    intake_row.company_name
  )
  RETURNING * INTO project_row;

  INSERT INTO public.project_details (
    project_id, company_name, project_description, target_audience, custom_domain,
    site_type, color_mode, color_details, selected_features,
    custom_specifications, extra_notes, vibe_text
  ) VALUES (
    project_row.id, intake_row.company_name, intake_row.project_description,
    intake_row.target_audience, intake_row.custom_domain, intake_row.site_type,
    intake_row.color_mode, intake_row.color_details,
    COALESCE(intake_row.selected_features, '{}'), intake_row.custom_specifications,
    intake_row.extra_notes, intake_row.vibe_text
  );

  INSERT INTO public.project_maintenance (project_id, recurrence, needs)
  VALUES (
    project_row.id,
    COALESCE(intake_row.maintenance_recurrence, 'none'),
    intake_row.maintenance_needs
  );

  INSERT INTO public.chat_rooms (name, client_email, client_name, project_id)
  VALUES (
    project_row.name || ' Chat',
    array_to_string(intake_row.client_emails, ', '),
    array_to_string(COALESCE(p_client_names, '{}'), ', '),
    project_row.id
  )
  RETURNING * INTO room_row;

  DELETE FROM public.project_intakes WHERE id = intake_row.id;

  RETURN jsonb_build_object(
    'project', to_jsonb(project_row),
    'chat_room_id', room_row.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_project_from_intake(uuid, text, numeric, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finalize_project_from_intake(uuid, text, numeric, text[], jsonb) TO authenticated;

COMMIT;
