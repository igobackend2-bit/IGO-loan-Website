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
    // GET /properties - list available
    if (method === 'GET' && path === '/properties') {
      const { state, district, minArea, maxArea, landType, limit } = event.queryStringParameters || {};
      let q = supabase.from('properties').select('*').eq('status', 'available');
      if (state) q = q.eq('state', state);
      if (district) q = q.eq('district', district);
      if (minArea) q = q.gte('total_area_acres', parseFloat(minArea));
      if (maxArea) q = q.lte('total_area_acres', parseFloat(maxArea));
      if (landType) q = q.eq('land_type', landType);
      if (limit) q = q.limit(parseInt(limit));
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, properties: data || [], count: data?.length || 0 }) };
    }
    // GET /properties/:id
    if (method === 'GET' && path.match(/^\/properties\/[^/]+$/)) {
      const id = path.split('/')[2];
      const { data, error } = await supabase.from('properties').select('*').eq('id', id).single();
      if (error || !data) return { statusCode: 404, body: JSON.stringify({ error: 'Property not found' }) };
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, property: data }) };
    }
    // POST /properties - create (staff)
    if (method === 'POST' && path === '/properties') {
      const body = JSON.parse(event.body);
      const property = {
        property_id: generateId('PRO'),
        state: body.state,
        district: body.district,
        village: body.village,
        total_area_acres: parseFloat(body.totalAreaAcres),
        land_type: body.landType,
        water_source: body.waterSource || [],
        title_status: body.titleStatus || 'clear',
        status: 'available',
        ...(body.taluka && { taluka: body.taluka }),
        ...(body.surveyNumber && { survey_number: body.surveyNumber }),
        ...(body.soilType && { soil_type: body.soilType }),
        ...(body.irrigationFacility && { irrigation_facility: body.irrigationFacility })
      };
      const { data, error } = await supabase.from('properties').insert([property]).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, property: data }) };
    }
    // PUT /properties/:id
    if (method === 'PUT' && path.match(/^\/properties\/[^/]+$/)) {
      const id = path.split('/')[2];
      const updates = JSON.parse(event.body);
      delete updates.id; delete updates.property_id; delete updates.created_at;
      const { data, error } = await supabase.from('properties').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ success: true, property: data }) };
    }
    // DELETE /properties/:id
    if (method === 'DELETE' && path.match(/^\/properties\/[^/]+$/)) {
      const id = path.split('/')[2];
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Property deleted' }) };
    }
    return { statusCode: 404, body: JSON.stringify({ error: 'Not Found' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
