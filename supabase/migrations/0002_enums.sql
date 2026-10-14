create type public.app_role as enum ('customer','manager','super_admin');
create type public.reservation_status as enum ('draft','pending','for_approval','approved','pending_cancellation','cancelled','rejected','pending_refund','refund_approved','refunded','completed');
create type public.payment_status as enum ('unpaid','pending','partially_paid','fully_paid','failed','refunded','partially_refunded');
create type public.support_status as enum ('pending','replied','done');
create type public.refund_status as enum ('pending','approved','rejected','completed');
