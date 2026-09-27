BEGIN;

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
    intake_row.project_name, primary_email, 'Active', COALESCE(p_total_cost, 0),
    p_intake_pdf_url, NULL, intake_row.client_emails, COALESCE(p_client_names, '{}'),
    intake_row.project_description, intake_row.color_mode, intake_row.color_details,
    intake_row.site_type, array_to_string(COALESCE(intake_row.selected_features, '{}'), ', '),
    intake_row.extra_notes, intake_row.custom_domain, intake_row.target_audience,
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
    project_row.id, COALESCE(intake_row.maintenance_recurrence, 'none'),
    intake_row.maintenance_needs
  );

  SELECT * INTO room_row
  FROM public.chat_rooms
  WHERE name = project_row.name || ' Chat'
    AND (project_id IS NULL OR project_id = project_row.id)
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.chat_rooms
    SET client_email = array_to_string(intake_row.client_emails, ', '),
        client_name = array_to_string(COALESCE(p_client_names, '{}'), ', '),
        project_id = project_row.id
    WHERE id = room_row.id
    RETURNING * INTO room_row;
  ELSE
    INSERT INTO public.chat_rooms (name, client_email, client_name, project_id)
    VALUES (
      project_row.name || ' Chat',
      array_to_string(intake_row.client_emails, ', '),
      array_to_string(COALESCE(p_client_names, '{}'), ', '),
      project_row.id
    )
    RETURNING * INTO room_row;
  END IF;

  DELETE FROM public.project_intakes WHERE id = intake_row.id;

  RETURN jsonb_build_object(
    'project', to_jsonb(project_row),
    'chat_room_id', room_row.id
  );
END;
$$;

COMMIT;
