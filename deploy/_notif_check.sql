\echo '== users with a phone number (count) =='
select count(*) as with_phone from public.users where phone is not null and phone <> '';
\echo '== who has 96895255450 / similar =='
select id, "userType", email, phone from public.users where phone like '%95255450%' or phone like '%9525%';
