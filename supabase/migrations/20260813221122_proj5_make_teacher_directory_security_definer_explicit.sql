
-- Make the security-definer behavior explicit rather than implicit, so the
-- intent is unambiguous to future maintainers: this view MUST bypass
-- profiles' RLS (that's the entire point — anon has no other way to read
-- teacher names), but must stay narrowly scoped to id+full_name where
-- role='teacher'.
alter view teacher_directory set (security_invoker = false);
