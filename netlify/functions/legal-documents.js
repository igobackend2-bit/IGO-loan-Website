const { createClient } = require('@supabase/supabase-js');
function generateId(p) { const t=Date.now().toString().slice(-6), r=Math.random().toString(36).substr(2,4).toUpperCase(); return `${p}-${t}-${r}`; }
exports.handler = async (event) => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);
  const path = event.path ? event.path.replace(/^\/api/, '') : '';
  const method = event.httpMethod;
  try {
    // POST /legal-documents
    if (method === 'POST' && path === '/legal-documents') {
      const b = JSON.parse(event.body);
      const doc = {
        document_id: generateId('DOC'),
        procurement_request_id: b.procurementRequestId,
        property_id: b.propertyId,
        vendor_id: b.vendorId,
        document_type: b.documentType,
        document_name: b.documentName,
        file_url: b.fileUrl,
        verification_status: 'pending',
        is_mandatory: b.isMandatory !== false
      };
      const { data, error } = await supabase.from('legal_documents').insert([doc]).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, document: data, documentId: data.document_id }) };
    }
    // GET /legal-documents
    if (method === 'GET' && path === '/legal-documents') {
      const { procurementRequestId, propertyId, vendorId } = event.queryStringParameters || {};
      let q = supabase.from('legal_documents').select('*');
      if (procurementRequestId) q = q.eq('procurement_request_id', procurementRequestId);
      if (propertyId) q = q.eq('property_id', propertyId);
      if (vendorId) q = q.eq('vendor_id', vendorId);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, documents: data || [] }) };
    }
    // PUT /legal-documents/:id/verify
    if (method === 'PUT' && path.match(/^\/legal-documents\/[^/]+\/verify$/)) {
      const id = path.split('/')[2];
      const { status: stat, verifiedBy, verificationNotes } = JSON.parse(event.body);
      const updates = {
        verification_status: stat,
        verified_by: verifiedBy || null,
        verified_at: (stat === 'verified' || stat === 'rejected') ? new Date().toISOString() : null,
        verification_notes: verificationNotes || null
      };
      const { data, error } = await supabase.from('legal_documents').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, document: data }) };
    }
    return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
