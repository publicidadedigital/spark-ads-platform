-- Allow 'cakto' and 'cartao' as payment methods for external gateway payments
ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS payment_orders_method_check;
ALTER TABLE payment_orders ADD CONSTRAINT payment_orders_method_check
  CHECK (method = ANY (ARRAY['pix','crypto','internal_balance','cakto','cartao']));
