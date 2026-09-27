BEGIN;

DROP POLICY IF EXISTS chat_rooms_select_participant_or_admin ON public.chat_rooms;
CREATE POLICY chat_rooms_select_participant_or_admin ON public.chat_rooms
FOR SELECT TO authenticated
USING (
  (SELECT private.is_admin())
  OR lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
    string_to_array(lower(replace(COALESCE(client_email, ''), ' ', '')), ',')
  )
  OR EXISTS (
    SELECT 1
    FROM public.projects AS project
    WHERE project.id = chat_rooms.project_id
      AND (
        lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
          string_to_array(lower(replace(COALESCE(project.client_email, ''), ' ', '')), ',')
        )
        OR EXISTS (
          SELECT 1 FROM unnest(COALESCE(project.client_emails, '{}'::text[])) AS party(email)
          WHERE lower(trim(party.email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
        )
      )
  )
);

DROP POLICY IF EXISTS messages_select_participant_or_admin ON public.messages;
CREATE POLICY messages_select_participant_or_admin ON public.messages
FOR SELECT TO authenticated
USING (
  (SELECT private.is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.chat_rooms AS room
    WHERE room.id = messages.room_id
      AND (
        lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
          string_to_array(lower(replace(COALESCE(room.client_email, ''), ' ', '')), ',')
        )
        OR EXISTS (
          SELECT 1
          FROM public.projects AS project
          WHERE project.id = room.project_id
            AND (
              lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
                string_to_array(lower(replace(COALESCE(project.client_email, ''), ' ', '')), ',')
              )
              OR EXISTS (
                SELECT 1 FROM unnest(COALESCE(project.client_emails, '{}'::text[])) AS party(email)
                WHERE lower(trim(party.email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
              )
            )
        )
      )
  )
);

DROP POLICY IF EXISTS messages_insert_participant_or_admin ON public.messages;
CREATE POLICY messages_insert_participant_or_admin ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  (
    (SELECT private.is_admin())
    AND sender_type = 'admin'
  )
  OR (
    NOT (SELECT private.is_admin())
    AND sender_type = 'client'
    AND EXISTS (
      SELECT 1
      FROM public.chat_rooms AS room
      WHERE room.id = messages.room_id
        AND (
          lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
            string_to_array(lower(replace(COALESCE(room.client_email, ''), ' ', '')), ',')
          )
          OR EXISTS (
            SELECT 1
            FROM public.projects AS project
            WHERE project.id = room.project_id
              AND (
                lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
                  string_to_array(lower(replace(COALESCE(project.client_email, ''), ' ', '')), ',')
                )
                OR EXISTS (
                  SELECT 1 FROM unnest(COALESCE(project.client_emails, '{}'::text[])) AS party(email)
                  WHERE lower(trim(party.email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
                )
              )
          )
        )
    )
  )
);

COMMIT;
