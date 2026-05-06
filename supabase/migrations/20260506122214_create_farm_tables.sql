-- IGO Farm Loans - Database Tables
-- Migration: Create tables for farm loan forms integration

-- =====================================================
-- 1. FARM LOAN APPLICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS farm_loan_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    aadhar TEXT,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    farm_size DECIMAL(10,2),
    ownership TEXT,
    soil_type TEXT,
    water_source TEXT,
    experience INTEGER,
    loan_type TEXT NOT NULL,
    loan_amount DECIMAL(12,2) NOT NULL,
    loan_purpose TEXT,
    timeline TEXT,
    managed_interest TEXT,
    asset_types TEXT[],
    invest_capacity TEXT,
    roi_expectation TEXT,
    lead_score INTEGER DEFAULT 0,
    consent BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'submitted',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farm_loan_phone ON farm_loan_applications(phone);
CREATE INDEX IF NOT EXISTS idx_farm_loan_status ON farm_loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_farm_loan_created ON farm_loan_applications(created_at);
CREATE INDEX IF NOT EXISTS idx_farm_loan_reference ON farm_loan_applications(reference_number);

-- =====================================================
-- 2. SUBSIDY ELIGIBILITY REPORTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS subsidy_eligibility_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name TEXT NOT NULL,
    state TEXT NOT NULL,
    district TEXT NOT NULL,
    category TEXT NOT NULL,
    project_cost DECIMAL(12,2) NOT NULL,
    land_ownership TEXT,
    land_area DECIMAL(10,2),
    farmer_category TEXT,
    priority TEXT[],
    prev_subsidy TEXT,
    eligible_schemes JSONB DEFAULT '[]',
    total_subsidy DECIMAL(12,2) DEFAULT 0,
    your_cost DECIMAL(12,2) DEFAULT 0,
    loan_needed DECIMAL(12,2) DEFAULT 0,
    subsidy_coverage INTEGER DEFAULT 0,
    processing_timeline TEXT,
    pdf_report_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subsidy_state ON subsidy_eligibility_reports(state);
CREATE INDEX IF NOT EXISTS idx_subsidy_category ON subsidy_eligibility_reports(category);
CREATE INDEX IF NOT EXISTS idx_subsidy_created ON subsidy_eligibility_reports(created_at);

-- =====================================================
-- 3. LEAD SCORES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS lead_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL,
    source_id UUID,
    full_name TEXT,
    phone TEXT,
    state TEXT,
    loan_amount DECIMAL(12,2),
    invest_capacity TEXT,
    managed_interest TEXT,
    experience INTEGER,
    score INTEGER NOT NULL,
    route_to TEXT,
    agritech_eligible BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_scores_phone ON lead_scores(phone);
CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON lead_scores(score);
CREATE INDEX IF NOT EXISTS idx_lead_agritech ON lead_scores(agritech_eligible);

-- =====================================================
-- 4. AGRITECH NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS agritech_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL,
    lead_type TEXT NOT NULL,
    farmer_name TEXT,
    phone TEXT,
    email TEXT,
    loan_amount DECIMAL(12,2),
    invest_capacity TEXT,
    asset_types TEXT[],
    roi_expectation TEXT,
    state TEXT,
    district TEXT,
    lead_score INTEGER,
    webhook_payload JSONB,
    sent_at TIMESTAMP WITH TIME ZONE,
    response_status TEXT,
    response_body TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agritech_lead ON agritech_notifications(lead_id);
CREATE INDEX IF NOT EXISTS idx_agritech_sent ON agritech_notifications(sent_at);
CREATE INDEX IF NOT EXISTS idx_agritech_created ON agritech_notifications(created_at);
