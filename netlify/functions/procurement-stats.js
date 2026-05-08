const { createClient } = require('@supabase/supabase-js');
exports.handler = async (event) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  try {
    const [propAll, propAvail, reqAll, reqActive, reqCompleted, contracts, pendingDocs] = await Promise.all([
      supabase.from('properties').select('*', { count: 'exact', head: true }),
      supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'available'),
      supabase.from('procurement_requests').select('*', { count: 'exact', head: true }),
      supabase.from('procurement_requests').select('*', { count: 'exact', head: true }).in('status', ['new','searching','shortlisted','negotiation']),
      supabase.from('procurement_requests').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('contracts').select('*', { count: 'exact', head: true }),
      supabase.from('legal_documents').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending')
    ]);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalProperties: propAll.count || 0,
        availableProperties: propAvail.count || 0,
        totalRequests: reqAll.count || 0,
        activeRequests: reqActive.count || 0,
        completedDeals: reqCompleted.count || 0,
        totalContracts: contracts.count || 0,
        pendingDocuments: pendingDocs.count || 0,
        status: 'CONNECTED'
      })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
