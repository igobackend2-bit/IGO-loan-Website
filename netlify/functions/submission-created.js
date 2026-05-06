const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  const payload = JSON.parse(event.body).payload;
  const formName = payload.form_name;
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Received submission from form: ${formName}`);

  try {
    if (formName === 'dpr-portal') {
      const data = payload.data;
      const application = {
        reference_number: `IGO-DPR-${Date.now()}`,
        full_name: data.fullName,
        phone: data.phone,
        email: data.email,
        state: data.state,
        district: data.district,
        loan_type: 'DPR_REQUEST',
        loan_amount: parseFloat(data.projectCost) || 0,
        loan_purpose: `Category: ${data.category}, Scheme: ${data.selected_scheme}`,
        status: 'submitted',
        managed_interest: 'no'
      };

      const { error } = await supabase
        .from('farm_loan_applications')
        .insert([application]);

      if (error) throw error;
      console.log('Successfully synced DPR request to Supabase');
    }

    return { statusCode: 200 };
  } catch (err) {
    console.error('Error syncing to Supabase:', err.message);
    return { statusCode: 500, body: err.message };
  }
};
