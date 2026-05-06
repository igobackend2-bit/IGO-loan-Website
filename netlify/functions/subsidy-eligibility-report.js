const { createClient } = require('@supabase/supabase-js');

const schemes = {
  NHB: { name: 'NHB (Horticulture)', percentage: 40, maxAmount: 5600000, categories: ['horticulture'], farmerTypes: ['marginal', 'small', 'large'] },
  AIF: { name: 'AIF (Agricultural Infrastructure)', percentage: 3, maxAmount: 100000000, categories: ['infrastructure', 'horticulture'], farmerTypes: ['marginal', 'small', 'large', 'entrepreneur'], isInterestSubvention: true },
  PMEGP: { name: 'PMEGP (Business/Manufacturing)', percentage: 35, maxAmount: 2500000, categories: ['msme'], farmerTypes: ['entrepreneur'] },
  KUSUM: { name: 'PM-KUSUM (Solar Pumps)', percentage: 90, maxAmount: 500000, categories: ['solar', 'horticulture', 'livestock'], farmerTypes: ['marginal', 'small', 'large'] },
  NABARD: { name: 'NABARD (Livestock)', percentage: 50, maxAmount: 10000000, categories: ['livestock'], farmerTypes: ['marginal', 'small', 'large'] }
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const formData = JSON.parse(event.body);
    const projectCost = parseFloat(formData.projectCost);
    const category = formData.category;
    const farmerCategory = formData.farmerCategory;

    let eligibleSchemes = [];
    let totalSubsidy = 0;
    const stackingPriority = ['KUSUM', 'NHB', 'NABARD', 'AIF', 'PMEGP'];

    for (let schemeKey of stackingPriority) {
      const scheme = schemes[schemeKey];
      if (scheme.categories.includes(category) && scheme.farmerTypes.includes(farmerCategory)) {
        let amount = scheme.isInterestSubvention ? (projectCost * scheme.percentage * 7) / 100 : (projectCost * scheme.percentage) / 100;
        amount = Math.min(amount, scheme.maxAmount);
        if (totalSubsidy + amount <= projectCost * 0.9) {
          totalSubsidy += amount;
          eligibleSchemes.push({ scheme: scheme.name, amount: Math.round(amount) });
        }
      }
    }

    const report = {
      project_name: formData.projectName,
      state: formData.state,
      category: category,
      project_cost: projectCost,
      eligible_schemes: eligibleSchemes,
      total_subsidy: Math.round(totalSubsidy),
      loan_needed: Math.round((projectCost - totalSubsidy) * 0.5),
      subsidy_coverage: Math.round((totalSubsidy / projectCost) * 100)
    };

    const { data, error } = await supabase
      .from('subsidy_eligibility_reports')
      .insert([report])
      .select()
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: 'success',
        totalSubsidy: Math.round(totalSubsidy),
        subsidyStack: eligibleSchemes,
        reportId: data.id
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
