const { createClient } = require('@supabase/supabase-js');

// Helper: Calculate Lead Score
function calculateLeadScore(data) {
  let score = 0;
  if (data.investCapacity === '10l+') score += 30;
  else if (data.investCapacity === '5-10l') score += 20;
  else if (data.investCapacity === '0-5l') score += 10;

  const loanAmount = parseFloat(data.loanAmount) || 0;
  if (loanAmount > 1000000) score += 25;
  else if (loanAmount > 500000) score += 20;
  else if (loanAmount > 250000) score += 15;

  if (data.managedInterest === 'yes') score += 20;
  const strongStates = ['TN', 'AP', 'KA'];
  if (strongStates.includes(data.state)) score += 10;

  const experience = parseInt(data.experience) || 0;
  if (experience >= 15) score += 10;
  else if (experience >= 10) score += 7;

  return Math.min(score, 100);
}

// Helper: Generate Reference Number
function generateReferenceNumber() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `IGO-${timestamp}-${random}`;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const formData = JSON.parse(event.body);
    const leadScore = calculateLeadScore(formData);
    const referenceNumber = generateReferenceNumber();
    const routeTo = (leadScore >= 50 && formData.managedInterest === 'yes') ? 'agritech_farms' : 'standard';

    const application = {
      reference_number: referenceNumber,
      full_name: formData.fullName,
      phone: formData.phone,
      email: formData.email,
      state: formData.state,
      district: formData.district,
      farm_size: parseFloat(formData.farmSize),
      loan_type: formData.loanType,
      loan_amount: parseFloat(formData.loanAmount),
      loan_purpose: formData.loanPurpose,
      managed_interest: formData.managedInterest,
      lead_score: leadScore,
      status: 'submitted'
    };

    const { data, error } = await supabase
      .from('farm_loan_applications')
      .insert([application])
      .select()
      .single();

    if (error) throw error;

    // Insert into lead_scores
    await supabase.from('lead_scores').insert([{
      source_type: 'farm_loan',
      source_id: data.id,
      full_name: formData.fullName,
      phone: formData.phone,
      score: leadScore,
      route_to: routeTo
    }]);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: 'success',
        referenceNumber: referenceNumber,
        leadScore: leadScore,
        routeTo: routeTo
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: 'error', message: err.message })
    };
  }
};
