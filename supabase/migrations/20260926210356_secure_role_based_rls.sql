BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
	SELECT COALESCE(
		(SELECT auth.uid()) = 'a854c1f9-292f-49ac-89c0-37dd509e683d'::uuid
		OR EXISTS (
			SELECT 1
			FROM public.profiles AS profile
			WHERE profile.id = (SELECT auth.uid())
				AND lower(COALESCE(profile.role, '')) = 'admin'
		),
		false
	);
$$;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_customer_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
	IF current_user IN ('postgres', 'service_role') OR (SELECT private.is_admin()) THEN
		RETURN NEW;
	END IF;

	IF (to_jsonb(NEW) - 'status') IS DISTINCT FROM (to_jsonb(OLD) - 'status') THEN
		RAISE EXCEPTION 'Customers may only update delivery status';
	END IF;

	IF lower(COALESCE(OLD.status, '')) <> 'shipped'
		OR lower(COALESCE(NEW.status, '')) NOT IN ('delivered', 'undelivered') THEN
		RAISE EXCEPTION 'Customers may only confirm or report delivery for shipped orders';
	END IF;

	RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_customer_order_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.guard_customer_order_update() TO authenticated;

CREATE OR REPLACE FUNCTION private.guard_client_chat_room_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
	IF current_user IN ('postgres', 'service_role') OR (SELECT private.is_admin()) THEN
		RETURN NEW;
	END IF;

	IF (to_jsonb(NEW) - ARRAY['client_email', 'client_name']::text[])
		IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['client_email', 'client_name']::text[]) THEN
		RAISE EXCEPTION 'Clients may only update chat room participants';
	END IF;

	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_client_intake_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
	current_email text := lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''));
BEGIN
	IF current_user IN ('postgres', 'service_role') OR (SELECT private.is_admin()) THEN
		RETURN NEW;
	END IF;

	IF NOT EXISTS (
		SELECT 1
		FROM unnest(COALESCE(NEW.client_emails, '{}'::text[])) AS party(email)
		WHERE lower(trim(party.email)) = current_email
	) THEN
		RAISE EXCEPTION 'The signed-in account must be listed on the intake';
	END IF;

	NEW.status := 'awaiting_admin_review';
	NEW.revision_notes := NULL;
	NEW.contract_terms := NULL;
	NEW.updated_at := now();
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.guard_client_intake_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
	IF current_user IN ('postgres', 'service_role') OR (SELECT private.is_admin()) THEN
		RETURN NEW;
	END IF;

	IF NEW.id IS DISTINCT FROM OLD.id
		OR NEW.created_at IS DISTINCT FROM OLD.created_at
		OR NEW.revision_notes IS DISTINCT FROM OLD.revision_notes
		OR NEW.contract_terms IS DISTINCT FROM OLD.contract_terms THEN
		RAISE EXCEPTION 'Clients may not change administrative intake fields';
	END IF;

	IF lower(COALESCE(NEW.status, '')) <> 'awaiting_admin_review' THEN
		RAISE EXCEPTION 'Clients may only submit an intake for administrative review';
	END IF;

	NEW.updated_at := now();
	RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_client_intake_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_client_intake_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_client_chat_room_update() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.guard_client_intake_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION private.guard_client_intake_update() TO authenticated;
GRANT EXECUTE ON FUNCTION private.guard_client_chat_room_update() TO authenticated;

DROP TRIGGER IF EXISTS guard_client_chat_room_update ON public.chat_rooms;
CREATE TRIGGER guard_client_chat_room_update
BEFORE UPDATE ON public.chat_rooms
FOR EACH ROW EXECUTE FUNCTION private.guard_client_chat_room_update();

DROP TRIGGER IF EXISTS guard_customer_order_update ON public.orders;
CREATE TRIGGER guard_customer_order_update
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION private.guard_customer_order_update();

DROP TRIGGER IF EXISTS guard_client_intake_insert ON public.project_intakes;
CREATE TRIGGER guard_client_intake_insert
BEFORE INSERT ON public.project_intakes
FOR EACH ROW EXECUTE FUNCTION private.guard_client_intake_insert();

DROP TRIGGER IF EXISTS guard_client_intake_update ON public.project_intakes;
CREATE TRIGGER guard_client_intake_update
BEFORE UPDATE ON public.project_intakes
FOR EACH ROW EXECUTE FUNCTION private.guard_client_intake_update();

DROP POLICY IF EXISTS "Allow public insert on bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Allow public select on bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS bookmarks_admin_all ON public.bookmarks;
DROP POLICY IF EXISTS "Allow all operations on chat_rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Allow public insert to chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Allow public read access to chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Clients can only view rooms they belong to" ON public.chat_rooms;
DROP POLICY IF EXISTS "Users can view relevant chat rooms" ON public.chat_rooms;
DROP POLICY IF EXISTS "Allow public insert to messages" ON public.messages;
DROP POLICY IF EXISTS "Allow public read access to messages" ON public.messages;
DROP POLICY IF EXISTS "Users can read messages in their rooms" ON public.messages;
DROP POLICY IF EXISTS "Allow update orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders by email" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders by email" ON public.orders;
DROP POLICY IF EXISTS "allow public select" ON public.orders;
DROP POLICY IF EXISTS "Allow read access to user names for chat" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view intakes" ON public.project_intakes;
DROP POLICY IF EXISTS "Allow public insert and full manage" ON public.project_intakes;
DROP POLICY IF EXISTS "Allow public intake submissions" ON public.project_intakes;
DROP POLICY IF EXISTS "Allow public select by intake ID" ON public.project_intakes;
DROP POLICY IF EXISTS "Allow public update by intake ID" ON public.project_intakes;
DROP POLICY IF EXISTS "Enable insert access for anyone" ON public.project_intakes;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.project_intakes;
DROP POLICY IF EXISTS "Enable update access for project_intakes" ON public.project_intakes;
DROP POLICY IF EXISTS "Users can update their own project intakes" ON public.project_intakes;
DROP POLICY IF EXISTS "Users can view their own project intakes" ON public.project_intakes;
DROP POLICY IF EXISTS "Allow full access on projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view shared projects" ON public.projects;
DROP POLICY IF EXISTS "Users can view subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view project transactions" ON public.transactions;

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_intakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.profiles, public.projects, public.project_intakes,
	public.chat_rooms, public.messages, public.orders, public.transactions,
	public.subscriptions, public.bookmarks, public.contracts, public.order_items
TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.projects, public.chat_rooms, public.bookmarks TO authenticated;
GRANT UPDATE ON public.project_intakes TO authenticated;
GRANT UPDATE ON public.orders TO authenticated;
GRANT INSERT (
	project_name, company_name, client_emails, all_accounts_created,
	project_description, color_mode, color_details, site_type, selected_features,
	extra_notes, status, custom_domain, target_audience, maintenance_recurrence,
	maintenance_needs, custom_specifications, vibe_text
) ON public.project_intakes TO authenticated;

CREATE POLICY profiles_select_self_or_admin ON public.profiles
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()) OR (SELECT private.is_admin()));

CREATE POLICY projects_select_client_or_admin ON public.projects
FOR SELECT TO authenticated
USING (
	(SELECT private.is_admin())
	OR lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
		string_to_array(lower(replace(COALESCE(client_email, ''), ' ', '')), ',')
	)
	OR EXISTS (
		SELECT 1 FROM unnest(COALESCE(client_emails, '{}'::text[])) AS party(email)
		WHERE lower(trim(party.email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
	)
);
CREATE POLICY projects_admin_all ON public.projects
FOR ALL TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY project_intakes_select_client_or_admin ON public.project_intakes
FOR SELECT TO authenticated
USING (
	(SELECT private.is_admin())
	OR EXISTS (
		SELECT 1 FROM unnest(COALESCE(client_emails, '{}'::text[])) AS party(email)
		WHERE lower(trim(party.email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
	)
);
CREATE POLICY project_intakes_insert_client_or_admin ON public.project_intakes
FOR INSERT TO authenticated
WITH CHECK (
	(SELECT private.is_admin())
	OR EXISTS (
		SELECT 1 FROM unnest(COALESCE(client_emails, '{}'::text[])) AS party(email)
		WHERE lower(trim(party.email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
	)
);
CREATE POLICY project_intakes_update_client_or_admin ON public.project_intakes
FOR UPDATE TO authenticated
USING (
	(SELECT private.is_admin())
	OR EXISTS (
		SELECT 1 FROM unnest(COALESCE(client_emails, '{}'::text[])) AS party(email)
		WHERE lower(trim(party.email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
	)
)
WITH CHECK (
	(SELECT private.is_admin())
	OR EXISTS (
		SELECT 1 FROM unnest(COALESCE(client_emails, '{}'::text[])) AS party(email)
		WHERE lower(trim(party.email)) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
	)
);
CREATE POLICY project_intakes_admin_all ON public.project_intakes
FOR ALL TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY bookmarks_select_project_client_or_admin ON public.bookmarks
FOR SELECT TO authenticated
USING (
	(SELECT private.is_admin())
	OR EXISTS (
		SELECT 1 FROM public.projects AS project
		WHERE project.id = bookmarks.project_id
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
CREATE POLICY bookmarks_admin_all ON public.bookmarks
FOR ALL TO authenticated
USING ((SELECT private.is_admin()))
WITH CHECK ((SELECT private.is_admin()));

CREATE POLICY chat_rooms_select_participant_or_admin ON public.chat_rooms
FOR SELECT TO authenticated
USING (
	(SELECT private.is_admin())
	OR lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
		string_to_array(lower(replace(COALESCE(client_email, ''), ' ', '')), ',')
	)
);
CREATE POLICY chat_rooms_insert_participant_or_admin ON public.chat_rooms
FOR INSERT TO authenticated
WITH CHECK (
	(SELECT private.is_admin())
	OR (
		project_id IS NULL
		AND lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
			string_to_array(lower(replace(COALESCE(client_email, ''), ' ', '')), ',')
		)
	)
);
CREATE POLICY chat_rooms_update_participant_or_admin ON public.chat_rooms
FOR UPDATE TO authenticated
USING (
	(SELECT private.is_admin())
	OR lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
		string_to_array(lower(replace(COALESCE(client_email, ''), ' ', '')), ',')
	)
)
WITH CHECK (
	(SELECT private.is_admin())
	OR lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
		string_to_array(lower(replace(COALESCE(client_email, ''), ' ', '')), ',')
	)
);
CREATE POLICY chat_rooms_admin_delete ON public.chat_rooms
FOR DELETE TO authenticated
USING ((SELECT private.is_admin()));

CREATE POLICY messages_select_participant_or_admin ON public.messages
FOR SELECT TO authenticated
USING (
	(SELECT private.is_admin())
	OR EXISTS (
		SELECT 1 FROM public.chat_rooms AS room
		WHERE room.id = messages.room_id
			AND lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
				string_to_array(lower(replace(COALESCE(room.client_email, ''), ' ', '')), ',')
			)
	)
);
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
			SELECT 1 FROM public.chat_rooms AS room
			WHERE room.id = messages.room_id
				AND lower(COALESCE((SELECT auth.jwt() ->> 'email'), '')) = ANY (
					string_to_array(lower(replace(COALESCE(room.client_email, ''), ' ', '')), ',')
				)
		)
	)
);

CREATE POLICY orders_select_customer_or_admin ON public.orders
FOR SELECT TO authenticated
USING (
	(SELECT private.is_admin())
	OR lower(COALESCE(customer_email, '')) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
);
CREATE POLICY orders_update_customer_or_admin ON public.orders
FOR UPDATE TO authenticated
USING (
	(SELECT private.is_admin())
	OR lower(COALESCE(customer_email, '')) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
)
WITH CHECK (
	(SELECT private.is_admin())
	OR lower(COALESCE(customer_email, '')) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
);

CREATE POLICY subscriptions_select_client_or_admin ON public.subscriptions
FOR SELECT TO authenticated
USING (
	(SELECT private.is_admin())
	OR lower(COALESCE(client_email, '')) = lower(COALESCE((SELECT auth.jwt() ->> 'email'), ''))
);

CREATE POLICY transactions_select_project_client_or_admin ON public.transactions
FOR SELECT TO authenticated
USING (
	(SELECT private.is_admin())
	OR EXISTS (
		SELECT 1 FROM public.projects AS project
		WHERE project.id = transactions.project_id
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

CREATE POLICY contracts_admin_select ON public.contracts
FOR SELECT TO authenticated
USING ((SELECT private.is_admin()));
CREATE POLICY order_items_admin_select ON public.order_items
FOR SELECT TO authenticated
USING ((SELECT private.is_admin()));

DROP TRIGGER IF EXISTS send_email_on_order_completion ON public.orders;
DROP FUNCTION IF EXISTS public.trigger_fulfillment_email();
DROP FUNCTION IF EXISTS public.send_fulfillment_email_trigger();
DROP FUNCTION IF EXISTS public.get_user_name_by_email(text);

CREATE OR REPLACE FUNCTION public.send_fulfillment_email_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
		PERFORM net.http_post(
			url := 'https://rpfclpfipqspbdbanobj.supabase.co/functions/v1/send-fulfillment-email',
			headers := jsonb_build_object('Content-Type', 'application/json'),
			body := jsonb_build_object(
				'record', jsonb_build_object(
					'id', NEW.id,
					'customer_email', NEW.customer_email,
					'customer_name', NEW.customer_name,
					'tracking_number', NEW.tracking_number,
					'status', NEW.status
				)
			)
		);
	END IF;
	RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
	INSERT INTO public.profiles (id, full_name, role, email)
	VALUES (
		NEW.id,
		NEW.raw_user_meta_data ->> 'full_name',
		'client',
		NEW.email
	);
	RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_fulfillment_email_on_update() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS chat_rooms_project_id_idx ON public.chat_rooms (project_id);
CREATE INDEX IF NOT EXISTS messages_room_id_idx ON public.messages (room_id);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS transactions_project_id_idx ON public.transactions (project_id);

COMMIT;
