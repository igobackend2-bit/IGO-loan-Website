const { createClient } = require('@supabase/supabase-js');
function generateId(p) { const t=Date.now().toString().slice(-6), r=Math.random().toString(36).substr(2,4).toUpperCase(); return `${p}-${t}-${r}`; }
exports.handler = async (event) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  const path = event.path ? event.path.replace(/^\/api/, '') : '';
  const method = event.httpMethod;
  try {
    // POST /contracts
    if (method === 'POST' && path === '/contracts') {
      const b = JSON.parse(event.body);
      const c = {
        contract_id: generateId('CNT'),
        procurement_request_id: b.procurementRequestId,
        property_id: b.propertyId,
        vendor_id: b.vendorId,
        customer_id: b.customerId || null,
        contract_type: b.contractType,
        contract_title: b.contractTitle,
        buyer_name: b.buyerName,
        seller_name: b.sellerName,
        total_amount: parseFloat(b.totalAmount),
        advance_amount: parseFloat(b.advanceAmount) || 0,
        balance_amount: parseFloat(b.balanceAmount) || 0,
        agreement_date: b.agreementDate,
        stamp_duty_percent: parseFloat(b.stampDutyPercent) || 5.0,
        status: 'draft'
      };
      const { data, error } = await supabase.from('contracts').insert([c]).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, contract: data, contractId: data.contract_id }) };
    }
    // GET /contracts
    if (method === 'GET' && path === '/contracts') {
      const { procurementRequestId, status, limit } = event.queryStringParameters || {};
      let q = supabase.from('contracts').select('*');
      if (procurementRequestId) q = q.eq('procurement_request_id', procurementRequestId);
      if (status) q = q.eq('status', status);
      if (limit) q = q.limit(parseInt(limit));
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, contracts: data || [] }) };
    }
    // PUT /contracts/:id
    if (method === 'PUT' && path.match(/^\/contracts\/[^/]+$/)) {
      const id = path.split('/')[2];
      const updates = JSON.parse(event.body);
      delete updates.id; delete updates.contract_id; delete updates.created_at;
      const { data, error } = await supabase.from('contracts').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, contract: data }) };
    }
    return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
