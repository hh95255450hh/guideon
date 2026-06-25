\echo 'NEW_USER_IDS'
select id from public.users order by id;
\echo 'NEW_AUDIT_DELETES'
select table_name from information_schema.tables where table_schema='public' and table_name ilike '%audit%';
