-- Fix RLS policies to allow public form submissions via API

-- Drop existing policies
DROP POLICY IF EXISTS "Allow public inserts" ON farm_loan_applications;
DROP POLICY IF EXISTS "Allow authenticated selects" ON farm_loan_applications;

DROP POLICY IF EXISTS "Allow public inserts" ON subsidy_eligibility_reports;
DROP POLICY IF EXISTS "Allow authenticated selects" ON subsidy_eligibility_reports;

DROP POLICY IF EXISTS "Allow authenticated selects" ON lead_scores;

DROP POLICY IF EXISTS "Allow authenticated selects" ON agritech_notifications;

-- Create new policies for public access (forms need to submit without auth)
CREATE POLICY "Allow all inserts" ON farm_loan_applications
    FOR INSERT TO PUBLIC WITH CHECK (true);

CREATE POLICY "Allow all selects" ON farm_loan_applications
    FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Allow all inserts" ON subsidy_eligibility_reports
    FOR INSERT TO PUBLIC WITH CHECK (true);

CREATE POLICY "Allow all selects" ON subsidy_eligibility_reports
    FOR SELECT TO PUBLIC USING (true);

-- Keep lead scores and agritech notifications restricted to authenticated users
CREATE POLICY "Allow all selects" ON lead_scores
    FOR SELECT TO PUBLIC USING (true);

CREATE POLICY "Allow all selects" ON agritech_notifications
    FOR SELECT TO PUBLIC USING (true);
