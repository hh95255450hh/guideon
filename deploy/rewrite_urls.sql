\set ON_ERROR_STOP off
-- count before
SELECT 'BEFORE: rows with cloud url in users.* (sample)' AS info;
DO $$
DECLARE
  r record;
  old text := 'https://uwgkszszsogivhphlfdy.supabase.co';
  newurl text := 'https://guideon.om';
  coltype text;
  n bigint;
BEGIN
  FOR r IN
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema='public'
      AND data_type IN ('text','character varying','json','jsonb','ARRAY')
  LOOP
    coltype := CASE WHEN r.data_type = 'ARRAY' THEN 'text[]' ELSE r.data_type END;
    BEGIN
      EXECUTE format(
        'UPDATE public.%I SET %I = replace(%I::text, %L, %L)::%s WHERE %I::text LIKE %L',
        r.table_name, r.column_name, r.column_name, old, newurl, coltype, r.column_name, '%' || old || '%'
      );
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n > 0 THEN RAISE NOTICE 'updated %.% (% rows)', r.table_name, r.column_name, n; END IF;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'skip %.%: %', r.table_name, r.column_name, SQLERRM;
    END;
  END LOOP;
END$$;
