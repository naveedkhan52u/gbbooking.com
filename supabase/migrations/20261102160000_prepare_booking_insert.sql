-- Validate bookings against currently approved provider listings and snapshot server-side data.
-- booking_number is an existing GENERATED ALWAYS AS IDENTITY column and remains unchanged.
CREATE OR REPLACE FUNCTION public.prepare_booking_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  listing record;
BEGIN
  IF auth.uid() IS NULL OR NEW.customer_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Booking must be submitted for the signed-in customer';
  END IF;

  SELECT ps.id, ps.provider_user_id, ps.title, ps.price, ps.pricing_unit,
         pp.business_name, r.name AS region_name, ps.verification_status,
         ps.is_active, pp.status AS provider_status
    INTO listing
  FROM public.provider_services ps
  JOIN public.provider_profiles pp ON pp.user_id = ps.provider_user_id
  JOIN public.regions r ON r.id = ps.region_id
  WHERE ps.id = NEW.provider_service_id;

  IF NOT FOUND
     OR listing.verification_status <> 'approved'
     OR NOT listing.is_active
     OR listing.provider_status <> 'approved' THEN
    RAISE EXCEPTION 'This provider listing is not currently bookable';
  END IF;

  NEW.provider_user_id := listing.provider_user_id;
  NEW.service_title_snapshot := listing.title;
  NEW.provider_name_snapshot := listing.business_name;
  NEW.region_name_snapshot := listing.region_name;
  NEW.price_snapshot := listing.price;
  NEW.pricing_unit_snapshot := listing.pricing_unit;
  NEW.status := 'pending';
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prepare_booking_insert_trigger ON public.bookings;
CREATE TRIGGER prepare_booking_insert_trigger
BEFORE INSERT ON public.bookings
FOR EACH ROW
EXECUTE FUNCTION public.prepare_booking_insert();
