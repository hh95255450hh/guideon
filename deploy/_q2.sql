\echo '== all team-type users =='
select id, "userType", "fullName", email from public.users where "userType"='team';
\echo '== any row with that email (any column) =='
select id, "userType", "fullName", email from public.users where email ilike '%alshukili2012%';
\echo '== team-related columns in users table =='
select column_name from information_schema.columns where table_schema='public' and table_name='users' and (column_name ilike '%team%' or column_name ilike '%member%');
\echo '== is there a separate teams table? =='
select table_name from information_schema.tables where table_schema='public' and table_name ilike '%team%';
