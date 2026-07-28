-- تفعيل أمان مستوى الصفوف (Row Level Security - RLS) على جميع الجداول في المخطط العام (public) لحل تنبيه سوبابيس الأمني
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
    END LOOP;
END $$;
