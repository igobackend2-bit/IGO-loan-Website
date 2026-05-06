const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('farm_loan_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: error.message })
      };
    }

    // Transform for the dashboard if needed, or return as is
    const leads = data.map(lead => ({
      id: lead.id,
      reference_number: lead.reference_number,
      full_name: lead.full_name,
      email: lead.email,
      phone: lead.phone,
      loan_type: lead.loan_type,
      status: lead.status,
      created_at: lead.created_at,
      data: lead // Include full data object
    }));

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // Allow cross-origin for local testing
      },
      body: JSON.stringify({ success: true, leads })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
