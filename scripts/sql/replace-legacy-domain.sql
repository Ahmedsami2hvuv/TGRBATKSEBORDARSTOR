DO $$
DECLARE
  v_old CONSTANT text := 'aboakbar.vercel.app';
  v_new CONSTANT text := 'aboakbr.com';
  r record;
BEGIN
  -- Replace legacy domain in all text/varchar columns in public schema.
  FOR r IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('text', 'character varying')
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
      r.table_schema,
      r.table_name,
      r.column_name,
      r.column_name,
      v_old,
      v_new,
      r.column_name,
      '%' || v_old || '%'
    );
  END LOOP;

  -- Replace legacy domain inside json/jsonb payloads as well.
  FOR r IN
    SELECT table_schema, table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type IN ('json', 'jsonb')
  LOOP
    EXECUTE format(
      'UPDATE %I.%I SET %I = replace(%I::text, %L, %L)::%s WHERE %I::text LIKE %L',
      r.table_schema,
      r.table_name,
      r.column_name,
      r.column_name,
      v_old,
      v_new,
      r.data_type,
      r.column_name,
      '%' || v_old || '%'
    );
  END LOOP;
END $$;
