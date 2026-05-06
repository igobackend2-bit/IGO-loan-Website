const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Get loan applications count
    const { count: loanCount, error: loanError } = await supabase
      .from('farm_loan_applications')
      .select('*', { count: 'exact', head: true });

    // 2. Get subsidy reports count
    const { count: subsidyCount, error: subsidyError } = await supabase
      .from('subsidy_eligibility_reports')
      .select('*', { count: 'exact', head: true });

    // 3. Get total subsidy value
    const { data: subsidyData, error: subsidySumError } = await supabase
      .from('subsidy_eligibility_reports')
      .select('total_subsidy');

    const totalSubsidy = subsidyData?.reduce((sum, row) => sum + (parseFloat(row.total_subsidy) || 0), 0) || 0;

    // 4. Get hot leads
    const { count: hotLeads, error: hotError } = await supabase
      .from('lead_scores')
      .select('*', { count: 'exact', head: true })
      .gte('score', 70);

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        totalLeads: loanCount || 0,
        totalApplications: loanCount || 0,
        totalSubsidyReports: subsidyCount || 0,
        subsidyFacilitated: `₹${(totalSubsidy / 100000).toFixed(1)}L`,
        hotLeads: hotLeads || 0,
        activeBrands: 26,
        status: 'CONNECTED'
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: 'ERROR',
        error: err.message
      })
    };
  }
};
