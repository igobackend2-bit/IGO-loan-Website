const { createClient } = require('@supabase/supabase-js');

// Helper: Generate IDs
function generateId(prefix) {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const data = JSON.parse(event.body);
    
    // Validate required fields
    if (!data.customerName || !data.customerPhone || !data.requiredState) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    const request = {
      request_id: generateId('PRC'),
      customer_name: data.customerName,
      customer_phone: data.customerPhone,
      customer_email: data.customerEmail || null,
      customer_reference: data.customerReference || null,
      required_state: data.requiredState,
      required_district: data.requiredDistrict || null,
      required_taluka: data.requiredTaluka || null,
      required_village: data.requiredVillage || null,
      min_area_acres: data.minAreaAcres ? parseFloat(data.minAreaAcres) : null,
      max_area_acres: data.maxAreaAcres ? parseFloat(data.maxAreaAcres) : null,
      max_budget: data.maxBudget ? parseFloat(data.maxBudget) : null,
      land_type_preference: data.landTypePreference || [],
      soil_preference: data.soilPreference || [],
      water_source_preference: data.waterSourcePreference || [],
      intended_use: data.intendedUse || null,
      purchase_timeline: data.purchaseTimeline || null,
      priority: data.priority || 'normal',
      status: 'new',
      notes: data.notes || null,
      search_started_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('procurement_requests')
      .insert([request])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, request: result, requestId: result.request_id })
    };

  } catch (err) {
    console.error('Function error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
