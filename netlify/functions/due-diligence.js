const { createClient } = require('@supabase/supabase-js');
exports.handler = async (event) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  const path = event.path ? event.path.replace(/^\/api/, '') : '';
  const method = event.httpMethod;
  try {
    // POST /due-diligence - initialize
    if (method === 'POST' && path === '/due-diligence') {
      const { procurementRequestId, propertyId, vendorId, notes } = JSON.parse(event.body);
      const { data: property } = await supabase.from('properties').select('*').eq('id', propertyId).single();
      if (!property) throw new Error('Property not found');
      const { data: vendor } = await supabase.from('vendors').select('kyc_status').eq('id', vendorId).single();
      const isVendorOk = vendor?.kyc_status === 'verified';
      const items = [
        { item: 'Title Deed Verification', status: isVendorOk ? 'pending' : 'blocked', remarks: isVendorOk ? 'Awaiting document upload' : 'Vendor KYC not verified' },
        { item: 'Encumbrance Certificate', status: 'pending', remarks: '' },
        { item: 'Mutation Certificate', status: 'pending', remarks: '' },
        { item: 'Land Revenue Receipts', status: 'pending', remarks: '' },
        { item: 'Land Use Certificate', status: 'pending', remarks: '' },
        { item: 'NOC from Local Bodies', status: 'pending', remarks: '' },
        { item: 'Soil & Water Test Reports', status: 'pending', remarks: '' },
        { item: 'Physical Site Verification', status: 'pending', remarks: '' }
      ];
      const due = {
        procurement_request_id: procurementRequestId,
        property_id: propertyId,
        vendor_id: vendorId,
        items,
        overall_status: isVendorOk ? 'in_progress' : 'issues_found',
        risk_level: isVendorOk ? 'low' : 'high',
        risk_factors: isVendorOk ? [] : ['Vendor KYC pending'],
        notes: notes || null
      };
      const { data: result, error } = await supabase.from('due_diligence').insert([due]).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, dueDiligence: result }) };
    }
    // GET /due-diligence?procurementRequestId=...
    if (method === 'GET' && path === '/due-diligence') {
      const { procurementRequestId } = event.queryStringParameters || {};
      const { data, error } = await supabase.from('due_diligence').select('*').eq('procurement_request_id', procurementRequestId).single();
      if (error || !data) return { statusCode: 404, body: JSON.stringify({ error: 'Due diligence not found' }) };
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, dueDiligence: data }) };
    }
    // PUT /due-diligence/:id/item
    if (method === 'PUT' && path.match(/^\/due-diligence\/[^/]+\/item$/)) {
      const id = path.split('/')[2];
      const { itemIndex, status: newStatus, remarks, verifiedBy } = JSON.parse(event.body);
      const { data: dd } = await supabase.from('due_diligence').select('items').eq('id', id).single();
      if (!dd) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      const items = dd.items || [];
      if (itemIndex >= 0 && itemIndex < items.length) {
        items[itemIndex].status = newStatus;
        items[itemIndex].remarks = remarks || '';
        items[itemIndex].verified_by = verifiedBy || null;
        items[itemIndex].verified_at = new Date().toISOString();
      }
      const completed = items.filter(i => ['verified','passed'].includes(i.status)).length;
      const total = items.length;
      const pct = Math.round((completed/total)*100);
      const overall = pct === 100 ? 'completed' : (pct > 0 ? 'in_progress' : 'pending');
      const hasIssues = items.some(i => ['rejected','blocked','issues_found'].includes(i.status));
      const { data: updated, error } = await supabase.from('due_diligence')
        .update({ items, overall_status: overall, completion_percentage: pct, risk_level: hasIssues ? 'high' : (pct===100?'low':'medium'), approved: pct===100 && !hasIssues })
        .eq('id', id).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, dueDiligence: updated }) };
    }
    return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
