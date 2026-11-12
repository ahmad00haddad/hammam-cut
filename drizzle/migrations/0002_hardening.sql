-- Phase 6 hardening. ONE statement only.
-- bookings.notified_at: a booking triggers at most one Telegram notification.
--
-- NOTE: an earlier draft of this file also redefined create_booking (party-name length check).
-- That check is already in 0003_anti_abuse.sql, which has the newer create_booking.
-- Do NOT re-create create_booking from this file: it would overwrite the 0003 version.
-- Apply once. Safe to re-run.

alter table public.bookings add column if not exists notified_at timestamptz;
