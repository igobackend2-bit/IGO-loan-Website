const { createClient } = require('@supabase/supabase-js');
function generateId(prefix) {
  const t = Date.now().toString().slice(-6);
  const r = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `${prefix}-${t}-${r}`;
}
exports.handler = async (event) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  const path = event.path ? event.path.replace(/^\/api/, '') : '';
  const method = event.httpMethod;
  try {
    // POST /vendors
    if (method === 'POST' && path === '/vendors') {
      const body = JSON.parse(event.body);
      const vendor = {
        vendor_id: generateId('VND'),
        vendor_type: body.vendorType,
        name: body.name,
        pan_number: body.panNumber || null,
        aadhaar_number: body.aadhaarNumber || null,
        gst_number: body.gstNumber || null,
        phone: body.phone || null,
        email: body.email || null,
        state: body.state,
        kyc_status: 'pending',
        documents: body.documents || []
      };
      const { data, error } = await supabase.from('vendors').insert([vendor]).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, vendor: data, vendorId: data.vendor_id }) };
    }
    // GET /vendors
    if (method === 'GET' && path === '/vendors') {
      const { kycStatus, limit } = event.queryStringParameters || {};
      let q = supabase.from('vendors').select('*');
      if (kycStatus) q = q.eq('kyc_status', kycStatus);
      if (limit) q = q.limit(parseInt(limit));
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, vendors: data || [] }) };
    }
    // GET /vendors/:id
    if (method === 'GET' && path.match(/^\/vendors\/[^/]+$/)) {
      const id = path.split('/')[2];
      const { data, error } = await supabase.from('vendors').select('*').eq('id', id).single();
      if (error || !data) return { statusCode: 404, body: JSON.stringify({ error: 'Vendor not found' }) };
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, vendor: data }) };
    }
    // PUT /vendors/:id/kyc
    if (method === 'PUT' && path.match(/^\/vendors\/[^/]+\/kyc$/)) {
      const id = path.split('/')[2];
      const { status, verifiedBy, notes } = JSON.parse(event.body);
      const updates = {
        kyc_status: status,
        kyc_verified_at: status === 'verified' ? new Date().toISOString() : null,
        verified_by: verifiedBy || null,
        notes: notes || null
      };
      const { data, error } = await supabase.from('vendors').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, vendor: data }) };
    }
    return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
