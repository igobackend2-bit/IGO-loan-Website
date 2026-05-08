const { createClient } = require('@supabase/supabase-js');
function generateId(p) { const t=Date.now().toString().slice(-6), r=Math.random().toString(36).substr(2,4).toUpperCase(); return `${p}-${t}-${r}`; }
exports.handler = async (event) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  const path = event.path ? event.path.replace(/^\/api/, '') : '';
  const method = event.httpMethod;
  try {
    // POST /payments
    if (method === 'POST' && path === '/payments') {
      const b = JSON.parse(event.body);
      const p = {
        payment_id: generateId('PAY'),
        procurement_request_id: b.procurementRequestId,
        property_id: b.propertyId,
        vendor_id: b.vendorId,
        contract_id: b.contractId || null,
        payment_type: b.paymentType,
        payment_stage: b.paymentStage,
        amount: parseFloat(b.amount),
        due_date: b.dueDate || null,
        status: b.status || 'pending'
      };
      const { data, error } = await supabase.from('procurement_payments').insert([p]).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, payment: data, paymentId: data.payment_id }) };
    }
    // GET /payments
    if (method === 'GET' && path === '/payments') {
      const { procurementRequestId, status } = event.queryStringParameters || {};
      let q = supabase.from('procurement_payments').select('*');
      if (procurementRequestId) q = q.eq('procurement_request_id', procurementRequestId);
      if (status) q = q.eq('status', status);
      const { data, error } = await q.order('due_date', { ascending: true });
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, payments: data || [] }) };
    }
    // PUT /payments/:id
    if (method === 'PUT' && path.match(/^\/payments\/[^/]+$/)) {
      const id = path.split('/')[2];
      const updates = JSON.parse(event.body);
      if (updates.status === 'paid' && !updates.paid_at) updates.paid_at = new Date().toISOString();
      const { data, error } = await supabase.from('procurement_payments').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, payment: data }) };
    }
    return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
