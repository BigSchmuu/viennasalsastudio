-- CREATE OR REPLACE FUNCTION doesn't replace a function whose argument list
-- changed (adding p_dance_role changed the signature), so it left the old
-- overload behind instead of replacing it, making RPC calls ambiguous.
drop function if exists public.create_regular_course_booking(uuid, text, date, text, boolean);
drop function if exists public.join_waitlist(uuid, text, date);
