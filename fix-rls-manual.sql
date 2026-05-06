-- MANUAL RLS FIX - Run this in Supabase SQL Editor
-- Go to: https://snveztjjlurdwxqgmpsx.supabase.co/project/sql

-- Step 1: Check current RLS status
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE tablename IN ('farm_loan_applications', 'subsidy_eligibility_reports', 'lead_scores', 'agritech_notifications');

-- Step 2: Disable RLS temporarily to allow operations
ALTER TABLE farm_loan_applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE subsidy_eligibility_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores DISABLE ROW LEVEL SECURITY;
ALTER TABLE agritech_notifications DISABLE ROW LEVEL SECURITY;

-- Step 3: Re-enable RLS
ALTER TABLE farm_loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsidy_eligibility_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE agritech_notifications ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop all existing policies (if any)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('farm_loan_applications', 'subsidy_eligibility_reports', 'lead_scores', 'agritech_notifications')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- Step 5: Create permissive policies for public access (required for form submissions)
CREATE POLICY "Allow public insert farm_loan" ON farm_loan_applications
    FOR INSERT TO PUBLIC WITH CHECK (true);

CREATE POLICY "Allow public select farm_loan" ON farm_loan_applications
    FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Allow public insert subsidy" ON subsidy_eligibility_reports
    FOR INSERT TO PUBLIC WITH CHECK (true);

CREATE POLICY "Allow public select subsidy" ON subsidy_eligibility_reports
    FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Allow public insert lead_scores" ON lead_scores
    FOR INSERT TO PUBLIC WITH CHECK (true);

CREATE POLICY "Allow public select lead_scores" ON lead_scores
    FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Allow public insert agritech" ON agritech_notifications
    FOR INSERT TO PUBLIC WITH CHECK (true);

CREATE POLICY "Allow public select agritech" ON agritech_notifications
    FOR SELECT TO PUBLIC USING (true);

-- Step 6: Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('farm_loan_applications', 'subsidy_eligibility_reports', 'lead_scores', 'agritech_notifications')
ORDER BY tablename, policyname;
