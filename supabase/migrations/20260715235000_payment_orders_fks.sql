-- Add missing FK constraints so PostgREST can resolve joins in the admin payments page
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users_profile(id) ON DELETE SET NULL;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_cycle_id_fkey
  FOREIGN KEY (cycle_id) REFERENCES public.user_cycles(id) ON DELETE SET NULL;
