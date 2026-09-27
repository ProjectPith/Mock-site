BEGIN;

CREATE OR REPLACE FUNCTION public.send_fulfillment_email_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
	trigger_secret text;
BEGIN
	IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
		SELECT decrypted_secret
		INTO trigger_secret
		FROM vault.decrypted_secrets
		WHERE name = 'fulfillment_trigger_secret'
			AND decrypted_secret <> ''
		ORDER BY created_at DESC
		LIMIT 1;

		IF trigger_secret IS NULL THEN
			RAISE WARNING 'Fulfillment trigger secret is not configured';
			RETURN NEW;
		END IF;

		PERFORM net.http_post(
			url := 'https://rpfclpfipqspbdbanobj.supabase.co/functions/v1/send-fulfulment-email',
			headers := jsonb_build_object(
				'Content-Type', 'application/json',
				'x-fulfillment-trigger', trigger_secret
			),
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

REVOKE ALL ON FUNCTION public.send_fulfillment_email_on_update() FROM PUBLIC, anon, authenticated;

COMMIT;
