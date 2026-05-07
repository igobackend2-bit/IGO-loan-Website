const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const { sendFormLinkEmail } = require('./services/emailService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase (CONNECTED)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// ==================== FARM LOAN FORM API ====================

// Helper: Calculate Lead Score (0-100)
function calculateLeadScore(data) {
  let score = 0;

  // Investment Capacity (30 points max)
  if (data.investCapacity === '10l+') score += 30;
  else if (data.investCapacity === '5-10l') score += 20;
  else if (data.investCapacity === '0-5l') score += 10;

  // Loan Amount (25 points max)
  const loanAmount = parseFloat(data.loanAmount) || 0;
  if (loanAmount > 1000000) score += 25;
  else if (loanAmount > 500000) score += 20;
  else if (loanAmount > 250000) score += 15;

  // Managed Farming Interest (20 points max)
  if (data.managedInterest === 'yes') score += 20;

  // Geographic Strength (10 points max)
  const strongStates = ['TN', 'AP', 'KA'];
  if (strongStates.includes(data.state)) score += 10;

  // Farmer Experience (10 points max)
  const experience = parseInt(data.experience) || 0;
  if (experience >= 15) score += 10;
  else if (experience >= 10) score += 7;

  return Math.min(score, 100);
}

// Helper: Generate Reference Number
function generateReferenceNumber() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `IGO-${timestamp}-${random}`;
}

// POST: Farm Loan Application
app.post('/api/farm-loan-application', async (req, res) => {
  try {
    const formData = req.body;
    
    // Validate required fields
    if (!formData.fullName || !formData.phone || !formData.loanAmount) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required fields: fullName, phone, loanAmount' 
      });
    }

    // Calculate lead score
    const leadScore = calculateLeadScore(formData);
    
    // Generate reference number
    const referenceNumber = generateReferenceNumber();
    
    // Determine routing
    const routeTo = (leadScore >= 50 && formData.managedInterest === 'yes') ? 'agritech_farms' : 'standard';
    
    // Prepare database record
    const application = {
      reference_number: referenceNumber,
      full_name: formData.fullName,
      phone: formData.phone,
      email: formData.email || null,
      aadhar: formData.aadhar || null,
      state: formData.state,
      district: formData.district,
      farm_size: formData.farmSize ? parseFloat(formData.farmSize) : null,
      ownership: formData.ownership || null,
      soil_type: formData.soilType || null,
      water_source: formData.waterSource || null,
      experience: formData.experience ? parseInt(formData.experience) : null,
      loan_type: formData.loanType,
      loan_amount: parseFloat(formData.loanAmount),
      loan_purpose: formData.loanPurpose || null,
      timeline: formData.timeline || null,
      managed_interest: formData.managedInterest || 'no',
      asset_types: formData.assetTypes || [],
      invest_capacity: formData.investCapacity || null,
      roi_expectation: formData.roiExpectation || null,
      lead_score: leadScore,
      consent: formData.consent || false
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from('farm_loan_applications')
      .insert([application])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Database error: ' + error.message 
      });
    }

    // Store lead score
    await supabase.from('lead_scores').insert([{
      source_type: 'farm_loan',
      source_id: data.id,
      full_name: formData.fullName,
      phone: formData.phone,
      state: formData.state,
      loan_amount: parseFloat(formData.loanAmount),
      invest_capacity: formData.investCapacity,
      managed_interest: formData.managedInterest,
      experience: formData.experience ? parseInt(formData.experience) : null,
      score: leadScore,
      route_to: routeTo,
      agritech_eligible: (leadScore >= 50 && formData.managedInterest === 'yes')
    }]);

    // TODO: Send to Agritech Farms webhook if eligible
    if (routeTo === 'agritech_farms') {
      // Agritech notification will be implemented in Phase 3
      console.log(`Agritech eligible lead: ${referenceNumber} (Score: ${leadScore})`);
    }

    // Return success response
    res.json({
      status: 'success',
      referenceNumber: referenceNumber,
      message: 'Application submitted successfully',
      leadScore: leadScore,
      routeTo: routeTo,
      nextSteps: [
        'Loan officer will contact within 24 hours',
        ...(routeTo === 'agritech_farms' ? ['Agritech Farms team will reach out with partnership proposal'] : [])
      ]
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'Server error: ' + err.message 
    });
  }
});

// GET: Lead Score
app.get('/api/lead-score', async (req, res) => {
  try {
    const { loanAmount, investCapacity, state, experience, managedInterest } = req.query;
    
    const score = calculateLeadScore({
      loanAmount: loanAmount || 0,
      investCapacity: investCapacity || '',
      state: state || '',
      experience: experience || 0,
      managedInterest: managedInterest || 'no'
    });

    const routeTo = (score >= 50 && managedInterest === 'yes') ? 'agritech_farms' : 
                    (score >= 70) ? 'hot_lead' :
                    (score >= 50) ? 'warm_lead' : 'nurture';

    res.json({
      status: 'success',
      score: score,
      routeTo: routeTo,
      agritechEligible: (score >= 50 && managedInterest === 'yes')
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'Server error: ' + err.message 
    });
  }
});

// ==================== SUBSIDY CALCULATOR API ====================

// Subsidy scheme definitions
const schemes = {
  NHB: {
    name: 'NHB (Horticulture)',
    percentage: 40,
    maxAmount: 5600000,
    categories: ['horticulture'],
    farmerTypes: ['marginal', 'small', 'large']
  },
  AIF: {
    name: 'AIF (Agricultural Infrastructure)',
    percentage: 3,
    maxAmount: 100000000,
    categories: ['infrastructure', 'horticulture'],
    farmerTypes: ['marginal', 'small', 'large', 'entrepreneur'],
    isInterestSubvention: true
  },
  PMEGP: {
    name: 'PMEGP (Business/Manufacturing)',
    percentage: 35,
    maxAmount: 2500000,
    categories: ['msme'],
    farmerTypes: ['entrepreneur']
  },
  KUSUM: {
    name: 'PM-KUSUM (Solar Pumps)',
    percentage: 90,
    maxAmount: 500000,
    categories: ['solar', 'horticulture', 'livestock'],
    farmerTypes: ['marginal', 'small', 'large']
  },
  NABARD: {
    name: 'NABARD (Livestock)',
    percentage: 50,
    maxAmount: 10000000,
    categories: ['livestock'],
    farmerTypes: ['marginal', 'small', 'large']
  }
};

// POST: Subsidy Eligibility Report
app.post('/api/subsidy-eligibility-report', async (req, res) => {
  try {
    const formData = req.body;
    
    // Validate required fields
    if (!formData.projectName || !formData.state || !formData.projectCost) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required fields: projectName, state, projectCost' 
      });
    }

    const projectCost = parseFloat(formData.projectCost);
    const category = formData.category;
    const farmerCategory = formData.farmerCategory;

    // Calculate eligible schemes
    let eligibleSchemes = [];
    let totalSubsidy = 0;

    // Stack subsidies intelligently
    const stackingPriority = ['KUSUM', 'NHB', 'NABARD', 'AIF', 'PMEGP'];

    for (let schemeKey of stackingPriority) {
      const scheme = schemes[schemeKey];
      
      // Check eligibility
      const isCategoryEligible = scheme.categories.includes(category);
      const isFarmerTypeEligible = scheme.farmerTypes.includes(farmerCategory);
      
      if (isCategoryEligible && isFarmerTypeEligible) {
        let subsidyAmount;
        
        if (scheme.isInterestSubvention) {
          // For AIF, calculate interest subvention value (approximate)
          subsidyAmount = (projectCost * scheme.percentage * 7) / 100; // 7 years
        } else {
          subsidyAmount = (projectCost * scheme.percentage) / 100;
        }
        
        // Apply max limit
        subsidyAmount = Math.min(subsidyAmount, scheme.maxAmount);
        
        // Check if we can add more subsidy
        if (totalSubsidy + subsidyAmount <= projectCost * 0.9) { // Cap at 90%
          totalSubsidy += subsidyAmount;
          eligibleSchemes.push({
            scheme: scheme.name,
            key: schemeKey,
            percentage: scheme.percentage,
            amount: Math.round(subsidyAmount),
            maxLimit: scheme.maxAmount
          });
        }
      }
    }

    const remainingCost = projectCost - totalSubsidy;
    const coveragePercent = Math.round((totalSubsidy / projectCost) * 100);
    const farmerContribution = remainingCost * 0.5; // Assume 50% loan, 50% own
    const loanNeeded = remainingCost * 0.5;

    // Prepare database record
    const report = {
      project_name: formData.projectName,
      state: formData.state,
      district: formData.district || null,
      category: category,
      project_cost: projectCost,
      land_ownership: formData.landOwnership || null,
      land_area: formData.landArea ? parseFloat(formData.landArea) : null,
      farmer_category: farmerCategory,
      priority: formData.priority || [],
      prev_subsidy: formData.prevSubsidy || 'no',
      eligible_schemes: eligibleSchemes,
      total_subsidy: Math.round(totalSubsidy),
      your_cost: Math.round(farmerContribution),
      loan_needed: Math.round(loanNeeded),
      subsidy_coverage: coveragePercent,
      processing_timeline: '2-4 months'
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from('subsidy_eligibility_reports')
      .insert([report])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Database error: ' + error.message 
      });
    }

    // Return success response
    res.json({
      status: 'success',
      projectCost: projectCost,
      subsidyStack: eligibleSchemes,
      totalSubsidy: Math.round(totalSubsidy),
      yourCost: Math.round(farmerContribution),
      loanNeeded: Math.round(loanNeeded),
      subsidyCoverage: coveragePercent,
      processingTimeline: '2-4 months',
      reportId: data.id
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'Server error: ' + err.message 
    });
  }
});

// GET Application Status
app.get('/api/status/:ref', async (req, res) => {
  try {
    const { ref } = req.params;
    
    const { data, error } = await supabase
      .from('farm_loan_applications')
      .select('*')
      .eq('reference_number', ref)
      .single();

    if (error || !data) {
      return res.status(404).json({ 
        status: 'error', 
        message: 'Application not found' 
      });
    }

    res.json({
      status: 'success',
      referenceNumber: data.reference_number,
      applicationStatus: data.status,
      leadScore: data.lead_score,
      submittedAt: data.created_at
    });

  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Server error: ' + err.message 
    });
  }
});

// ==================== CRM & ADMIN API ====================

// GET All Leads
app.get('/api/leads', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('farm_loan_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, leads: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Send Form Link (Email/WhatsApp)
app.post('/api/send-link', async (req, res) => {
  try {
    const { email, name, referenceNumber } = req.body;
    
    if (!email || !name || !referenceNumber) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await sendFormLinkEmail(email, name, referenceNumber);
    
    if (result.success) {
      res.json({ success: true, message: 'Link sent successfully' });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET All Applications
app.get('/api/applications', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('farm_loan_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, applications: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET All Documents (Placeholder for storage/notifications)
app.get('/api/documents', async (req, res) => {
  try {
    // In a real scenario, this might fetch from a 'documents' table or storage bucket
    // For now, we'll return documents linked to agritech notifications or just a placeholder
    const { data, error } = await supabase
      .from('agritech_notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, documents: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Admin Dashboard Stats
app.get('/api/stats', async (req, res) => {
  try {
    // Get loan applications count
    const { count: loanCount, error: loanError } = await supabase
      .from('farm_loan_applications')
      .select('*', { count: 'exact', head: true });

    // Get subsidy reports count
    const { count: subsidyCount, error: subsidyError } = await supabase
      .from('subsidy_eligibility_reports')
      .select('*', { count: 'exact', head: true });

    // Get total subsidy value
    const { data: subsidyData, error: subsidySumError } = await supabase
      .from('subsidy_eligibility_reports')
      .select('total_subsidy');

    const totalSubsidy = subsidyData?.reduce((sum, row) => sum + (row.total_subsidy || 0), 0) || 0;

    // Get high-score leads
    const { count: hotLeads, error: hotError } = await supabase
      .from('lead_scores')
      .select('*', { count: 'exact', head: true })
      .gte('score', 70);

    res.json({
      totalLeads: loanCount || 0,
      totalApplications: loanCount || 0,
      totalSubsidyReports: subsidyCount || 0,
      subsidyFacilitated: `₹${(totalSubsidy / 100000).toFixed(1)}L`,
      hotLeads: hotLeads || 0,
      activeBrands: 27,
      status: 'CONNECTED'
    });

  } catch (err) {
    res.json({
      totalLeads: 0,
      totalApplications: 0,
      pendingForms: 0,
      subsidyFacilitated: "₹0",
      activeBrands: 0,
      status: 'ERROR',
      error: err.message
    });
  }
});

// ==================== PROCUREMENT & LEGAL API ====================

// Helper: Generate Procurement Reference Number
function generateProcurementId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `PRC-${timestamp}-${random}`;
}

// Helper: Generate Property ID
function generatePropertyId() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `PRO-${timestamp}-${random}`;
}

// Helper: Generate Vendor ID
function generateVendorId() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `VND-${timestamp}-${random}`;
}

// Helper: Generate Document ID
function generateDocumentId() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `DOC-${timestamp}-${random}`;
}

// Helper: Generate Contract ID
function generateContractId() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `CNT-${timestamp}-${random}`;
}

// Helper: Generate Payment ID
function generatePaymentId() {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `PAY-${timestamp}-${random}`;
}

// ==================== PROPERTIES API ====================

// GET: List all available properties (public)
app.get('/api/properties', async (req, res) => {
  try {
    const { state, district, minArea, maxArea, landType, limit = 50 } = req.query;
    
    let query = supabase
      .from('properties')
      .select('*')
      .eq('status', 'available');

    if (state) query = query.eq('state', state);
    if (district) query = query.eq('district', district);
    if (minArea) query = query.gte('total_area_acres', parseFloat(minArea));
    if (maxArea) query = query.lte('total_area_acres', parseFloat(maxArea));
    if (landType) query = query.eq('land_type', landType);

    query = query.limit(parseInt(limit));

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, properties: data, count: data?.length || 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: Single property by ID
app.get('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    res.json({ success: true, property: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST: Create property (staff only)
app.post('/api/properties', async (req, res) => {
  try {
    const propertyData = req.body;
    
    // Generate property_id
    const propertyId = generatePropertyId();
    
    const property = {
      property_id: propertyId,
      state: propertyData.state,
      district: propertyData.district,
      taluka: propertyData.taluka || null,
      village: propertyData.village,
      survey_number: propertyData.surveyNumber || null,
      plot_number: propertyData.plotNumber || null,
      khasra_number: propertyData.khasraNumber || null,
      total_area_acres: parseFloat(propertyData.totalAreaAcres),
      cultivatable_area_acres: propertyData.cultivatableAreaAcres ? parseFloat(propertyData.cultivatableAreaAcres) : null,
      land_type: propertyData.landType,
      soil_type: propertyData.soilType || null,
      water_source: propertyData.waterSource || [],
      irrigation_facility: propertyData.irrigationFacility || null,
      topography: propertyData.topography || null,
      elevation_meters: propertyData.elevationMeters ? parseFloat(propertyData.elevationMeters) : null,
      title_status: propertyData.titleStatus || 'clear',
      ownership_type: propertyData.ownershipType || null,
      encumbrance_certificate: propertyData.encumbranceCertificate || null,
      mutation_status: propertyData.mutationStatus || null,
      road_access: propertyData.roadAccess || null,
      distance_to_highway_km: propertyData.distanceToHighwayKm ? parseFloat(propertyData.distanceToHighwayKm) : null,
      distance_to_market_km: propertyData.distanceToMarketKm ? parseFloat(propertyData.distanceToMarketKm) : null,
      electricity_available: propertyData.electricityAvailable || false,
      market_value_per_acre: propertyData.marketValuePerAcre ? parseFloat(propertyData.marketValuePerAcre) : null,
      igo_assessed_value: propertyData.igoAssessedValue ? parseFloat(propertyData.igoAssessedValue) : null,
      images: propertyData.images || [],
      latitude: propertyData.latitude ? parseFloat(propertyData.latitude) : null,
      longitude: propertyData.longitude ? parseFloat(propertyData.longitude) : null,
      status: propertyData.status || 'available',
      notes: propertyData.notes || null
    };

    const { data: result, error } = await supabase
      .from('properties')
      .insert([property])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, property: result, propertyId: propertyId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT: Update property (staff only)
app.put('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove immutable fields
    delete updates.id;
    delete updates.property_id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, property: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE: Property (staff only)
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== VENDORS API ====================

// POST: Create vendor (staff only)
app.post('/api/vendors', async (req, res) => {
  try {
    const vendorData = req.body;
    
    const vendorId = generateVendorId();
    
    const vendor = {
      vendor_id: vendorId,
      vendor_type: vendorData.vendorType,
      name: vendorData.name,
      pan_number: vendorData.panNumber || null,
      aadhaar_number: vendorData.aadhaarNumber || null,
      gst_number: vendorData.gstNumber || null,
      phone: vendorData.phone || null,
      alternate_phone: vendorData.alternatePhone || null,
      email: vendorData.email || null,
      address_line1: vendorData.addressLine1 || null,
      address_line2: vendorData.addressLine2 || null,
      city: vendorData.city || null,
      state: vendorData.state,
      pincode: vendorData.pincode || null,
      kyc_status: 'pending',
      documents: vendorData.documents || [],
      notes: vendorData.notes || null
    };

    const { data: result, error } = await supabase
      .from('vendors')
      .insert([vendor])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, vendor: result, vendorId: vendorId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: All vendors (staff only)
app.get('/api/vendors', async (req, res) => {
  try {
    const { kycStatus, limit = 100 } = req.query;
    
    let query = supabase.from('vendors').select('*');

    if (kycStatus) query = query.eq('kyc_status', kycStatus);
    query = query.limit(parseInt(limit));

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, vendors: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: Single vendor (staff only)
app.get('/api/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    res.json({ success: true, vendor: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT: Update vendor KYC status (staff only)
app.put('/api/vendors/:id/kyc', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, verifiedBy, notes } = req.body;
    
    const updates = {
      kyc_status: status,
      kyc_verified_at: status === 'verified' ? new Date().toISOString() : null,
      verified_by: verifiedBy || null,
      notes: notes || null
    };

    const { data, error } = await supabase
      .from('vendors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, vendor: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== PROCUREMENT REQUESTS API ====================

// POST: Create procurement request
app.post('/api/procurement-requests', async (req, res) => {
  try {
    const requestData = req.body;
    
    const requestId = generateProcurementId();
    
    const request = {
      request_id: requestId,
      customer_name: requestData.customerName,
      customer_phone: requestData.customerPhone,
      customer_email: requestData.customerEmail || null,
      customer_reference: requestData.customerReference || null,
      required_state: requestData.requiredState,
      required_district: requestData.requiredDistrict || null,
      required_taluka: requestData.requiredTaluka || null,
      required_village: requestData.requiredVillage || null,
      min_area_acres: requestData.minAreaAcres ? parseFloat(requestData.minAreaAcres) : null,
      max_area_acres: requestData.maxAreaAcres ? parseFloat(requestData.maxAreaAcres) : null,
      max_budget: requestData.maxBudget ? parseFloat(requestData.maxBudget) : null,
      land_type_preference: requestData.landTypePreference || [],
      soil_preference: requestData.soilPreference || [],
      water_source_preference: requestData.waterSourcePreference || [],
      intended_use: requestData.intendedUse || null,
      purchase_timeline: requestData.purchaseTimeline || null,
      status: 'new',
      priority: requestData.priority || 'normal',
      notes: requestData.notes || null,
      search_started_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('procurement_requests')
      .insert([request])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, request: result, requestId: requestId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: All procurement requests (staff only)
app.get('/api/procurement-requests', async (req, res) => {
  try {
    const { status, assignedTo, limit = 100 } = req.query;
    
    let query = supabase.from('procurement_requests').select('*');

    if (status) query = query.eq('status', status);
    if (assignedTo) query = query.eq('assigned_to', assignedTo);
    query = query.limit(parseInt(limit));

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, requests: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: Single procurement request
app.get('/api/procurement-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('procurement_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    res.json({ success: true, request: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT: Update procurement request (staff only)
app.put('/api/procurement-requests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove immutable fields
    delete updates.id;
    delete updates.request_id;
    delete updates.created_at;
    delete updates.customer_name;
    delete updates.customer_phone;

    // Auto-set timestamps based on status changes
    if (updates.status === 'searching' && !updates.search_started_at) {
      updates.search_started_at = new Date().toISOString();
    }
    if (updates.status === 'completed' && !updates.deal_closed_at) {
      updates.deal_closed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('procurement_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, request: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST: Shortlist property for request
app.post('/api/procurement-requests/:id/shortlist', async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyId } = req.body;
    
    // Get current shortlist
    const { data: requestData, error: fetchError } = await supabase
      .from('procurement_requests')
      .select('shortlisted_properties')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const shortlist = requestData.shortlisted_properties || [];
    if (!shortlist.includes(propertyId)) {
      shortlist.push(propertyId);
    }

    const { data, error } = await supabase
      .from('procurement_requests')
      .update({ shortlisted_properties: shortlist })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, request: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST: Select property (finalize)
app.post('/api/procurement-requests/:id/select-property', async (req, res) => {
  try {
    const { id } = req.params;
    const { propertyId } = req.body;
    
    const { data, error } = await supabase
      .from('procurement_requests')
      .update({
        selected_property_id: propertyId,
        property_found_at: new Date().toISOString(),
        status: 'negotiation'
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, request: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== LEGAL DOCUMENTS API ====================

// POST: Upload legal document
app.post('/api/legal-documents', async (req, res) => {
  try {
    const docData = req.body;
    
    const documentId = generateDocumentId();
    
    const document = {
      document_id: documentId,
      procurement_request_id: docData.procurementRequestId,
      property_id: docData.propertyId,
      vendor_id: docData.vendorId,
      document_type: docData.documentType,
      document_name: docData.documentName,
      document_number: docData.documentNumber || null,
      file_url: docData.fileUrl,
      file_size_bytes: docData.fileSize || null,
      mime_type: docData.mimeType || null,
      verification_status: 'pending',
      valid_until: docData.validUntil || null,
      is_mandatory: docData.isMandatory !== false,
      submission_channel: docData.submissionChannel || 'upload',
      uploaded_by: docData.uploadedBy || null
    };

    const { data: result, error } = await supabase
      .from('legal_documents')
      .insert([document])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, document: result, documentId: documentId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: Get documents for a request/property/vendor
app.get('/api/legal-documents', async (req, res) => {
  try {
    const { procurementRequestId, propertyId, vendorId } = req.query;
    
    let query = supabase.from('legal_documents').select('*');
    
    if (procurementRequestId) query = query.eq('procurement_request_id', procurementRequestId);
    if (propertyId) query = query.eq('property_id', propertyId);
    if (vendorId) query = query.eq('vendor_id', vendorId);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, documents: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT: Verify/Update document status
app.put('/api/legal-documents/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, verifiedBy, verificationNotes } = req.body;
    
    const updates = {
      verification_status: status,
      verified_by: verifiedBy || null,
      verified_at: status === 'verified' || status === 'rejected' ? new Date().toISOString() : null,
      verification_notes: verificationNotes || null
    };

    const { data, error } = await supabase
      .from('legal_documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, document: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== CONTRACTS API ====================

// POST: Create contract
app.post('/api/contracts', async (req, res) => {
  try {
    const contractData = req.body;
    
    const contractId = generateContractId();
    
    const contract = {
      contract_id: contractId,
      procurement_request_id: contractData.procurementRequestId,
      property_id: contractData.propertyId,
      vendor_id: contractData.vendorId,
      customer_id: contractData.customerId || null,
      contract_type: contractData.contractType,
      contract_title: contractData.contractTitle,
      contract_number: contractData.contractNumber || null,
      buyer_name: contractData.buyerName,
      seller_name: contractData.sellerName,
      total_amount: parseFloat(contractData.totalAmount),
      advance_amount: parseFloat(contractData.advanceAmount) || 0,
      balance_amount: parseFloat(contractData.balanceAmount) || 0,
      payment_schedule: contractData.paymentSchedule || [],
      property_snapshot: contractData.propertySnapshot || null,
      agreement_date: contractData.agreementDate,
      possession_date: contractData.possessionDate || null,
      registration_date: contractData.registrationDate || null,
      stamp_duty_percent: parseFloat(contractData.stampDutyPercent) || 5.0,
      registration_fee: parseFloat(contractData.registrationFee) || 0,
      status: 'draft',
      notes: contractData.notes || null
    };

    const { data: result, error } = await supabase
      .from('contracts')
      .insert([contract])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, contract: result, contractId: contractId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: Get contracts
app.get('/api/contracts', async (req, res) => {
  try {
    const { procurementRequestId, status, limit = 100 } = req.query;
    
    let query = supabase.from('contracts').select('*');

    if (procurementRequestId) query = query.eq('procurement_request_id', procurementRequestId);
    if (status) query = query.eq('status', status);
    query = query.limit(parseInt(limit));

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, contracts: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT: Update contract status
app.put('/api/contracts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Remove immutable fields
    delete updates.id;
    delete updates.contract_id;
    delete updates.created_at;

    const { data, error } = await supabase
      .from('contracts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, contract: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== DUE DILIGENCE API ====================

// POST: Initialize due diligence
app.post('/api/due-diligence', async (req, res) => {
  try {
    const { procurementRequestId, propertyId, vendorId } = req.body;
    
    // Get property details
    const { data: propertyData, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', propertyId)
      .single();

    if (propertyError) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    // Check vendor KYC status
    const { data: vendorData, error: vendorError } = await supabase
      .from('vendors')
      .select('kyc_status')
      .eq('id', vendorId)
      .single();

    // Build default checklist
    const defaultChecklist = [
      {
        item: 'Title Deed Verification',
        status: vendorData?.kyc_status === 'verified' ? 'pending' : 'blocked',
        remarks: vendorData?.kyc_status === 'verified' ? 'Awaiting document upload' : 'Vendor KYC not verified',
        verified_by: null,
        verified_at: null
      },
      {
        item: 'Encumbrance Certificate',
        status: 'pending',
        remarks: '',
        verified_by: null,
        verified_at: null
      },
      {
        item: 'Mutation Certificate',
        status: 'pending',
        remarks: '',
        verified_by: null,
        verified_at: null
      },
      {
        item: 'Land Revenue Receipts',
        status: 'pending',
        remarks: '',
        verified_by: null,
        verified_at: null
      },
      {
        item: 'Land Use Certificate',
        status: 'pending',
        remarks: '',
        verified_by: null,
        verified_at: null
      },
      {
        item: 'NOC from Local Bodies',
        status: 'pending',
        remarks: '',
        verified_by: null,
        verified_at: null
      },
      {
        item: 'Soil & Water Test Reports',
        status: 'pending',
        remarks: '',
        verified_by: null,
        verified_at: null
      },
      {
        item: 'Physical Site Verification',
        status: 'pending',
        remarks: '',
        verified_by: null,
        verified_at: null
      }
    ];

    // Determine overall status
    const overallStatus = vendorData?.kyc_status === 'verified' ? 'in_progress' : 'issues_found';

    const dueDiligence = {
      procurement_request_id: procurementRequestId,
      property_id: propertyId,
      vendor_id: vendorId,
      items: defaultChecklist,
      overall_status: overallStatus,
      completion_percentage: 0,
      risk_level: vendorData?.kyc_status === 'verified' ? 'low' : 'high',
      risk_factors: vendorData?.kyc_status !== 'verified' ? ['Vendor KYC pending'] : [],
      approved: false,
      notes: req.body.notes || null
    };

    const { data: result, error } = await supabase
      .from('due_diligence')
      .insert([dueDiligence])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, dueDiligence: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: Due diligence for request
app.get('/api/due-diligence', async (req, res) => {
  try {
    const { procurementRequestId } = req.query;
    
    const { data, error } = await supabase
      .from('due_diligence')
      .select('*')
      .eq('procurement_request_id', procurementRequestId)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Due diligence not found' });
    }

    res.json({ success: true, dueDiligence: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT: Update due diligence checklist item
app.put('/api/due-diligence/:id/item', async (req, res) => {
  try {
    const { id } = req.params;
    const { itemIndex, status, remarks, verifiedBy } = req.body;
    
    // Get current due diligence
    const { data: ddData, error: fetchError } = await supabase
      .from('due_diligence')
      .select('items, overall_status')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({ success: false, error: 'Due diligence not found' });
    }

    const items = ddData.items || [];
    if (itemIndex >= 0 && itemIndex < items.length) {
      items[itemIndex].status = status;
      items[itemIndex].remarks = remarks || '';
      items[itemIndex].verified_by = verifiedBy || null;
      items[itemIndex].verified_at = new Date().toISOString();
    }

    // Recalculate completion percentage
    const completed = items.filter(i => i.status === 'verified' || i.status === 'passed').length;
    const total = items.length;
    const completionPercent = Math.round((completed / total) * 100);
    const overallStatus = completionPercent === 100 ? 'completed' : (completionPercent > 0 ? 'in_progress' : 'pending');

    // Check for issues
    const hasIssues = items.some(i => i.status === 'rejected' || i.status === 'blocked' || i.status === 'issues_found');
    const riskLevel = hasIssues ? 'high' : (completionPercent === 100 ? 'low' : 'medium');

    const { data, error } = await supabase
      .from('due_diligence')
      .update({
        items,
        overall_status: overallStatus,
        completion_percentage: completionPercent,
        risk_level: riskLevel,
        approved: completionPercent === 100 && !hasIssues
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, dueDiligence: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== PAYMENTS API ====================

// POST: Create payment schedule
app.post('/api/payments', async (req, res) => {
  try {
    const paymentData = req.body;
    
    const paymentId = generatePaymentId();
    
    const payment = {
      payment_id: paymentId,
      procurement_request_id: paymentData.procurementRequestId,
      property_id: paymentData.propertyId,
      vendor_id: paymentData.vendorId,
      contract_id: paymentData.contractId || null,
      payment_type: paymentData.paymentType,
      payment_stage: paymentData.paymentStage,
      amount: parseFloat(paymentData.amount),
      due_date: paymentData.dueDate || null,
      payment_method: paymentData.paymentMethod || null,
      transaction_reference: paymentData.transactionReference || null,
      receipt_url: paymentData.receiptUrl || null,
      status: paymentData.status || 'pending',
      notes: paymentData.notes || null
    };

    const { data: result, error } = await supabase
      .from('procurement_payments')
      .insert([payment])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, payment: result, paymentId: paymentId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET: Payments for a request
app.get('/api/payments', async (req, res) => {
  try {
    const { procurementRequestId, status } = req.query;
    
    let query = supabase.from('procurement_payments').select('*');
    
    if (procurementRequestId) query = query.eq('procurement_request_id', procurementRequestId);
    if (status) query = query.eq('status', status);

    const { data, error } = await query.order('due_date', { ascending: true });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, payments: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT: Update payment status
app.put('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Set paid_at if status changed to paid
    if (updates.status === 'paid' && !updates.paid_at) {
      updates.paid_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('procurement_payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, payment: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== STAFF USERS API ====================

// GET: All staff (basic - restricted to admin in production)
app.get('/api/staff', async (req, res) => {
  try {
    const { role, activeOnly = true } = req.query;
    
    let query = supabase.from('staff_users').select('id, staff_id, name, email, phone, role, department, is_active, last_login_at, created_at');

    if (role) query = query.eq('role', role);
    if (activeOnly === 'true') query = query.eq('is_active', true);

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, staff: data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST: Create staff user (admin only)
app.post('/api/staff', async (req, res) => {
  try {
    const staffData = req.body;
    
    const staffId = `IGO-${Date.now().toString().slice(-6)}`;
    
    const staff = {
      staff_id: staffId,
      name: staffData.name,
      email: staffData.email,
      phone: staffData.phone || null,
      role: staffData.role || 'field_agent',
      department: staffData.department || 'procurement',
      permissions: staffData.permissions || [],
      is_active: true
    };

    const { data: result, error } = await supabase
      .from('staff_users')
      .insert([staff])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, staff: result, staffId: staffId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== PROCUREMENT DASHBOARD STATS ====================

// GET: Procurement stats
app.get('/api/procurement-stats', async (req, res) => {
  try {
    // Total properties
    const { count: totalProperties, error: propErr } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true });

    // Available properties
    const { count: availableProperties, error: availErr } = await supabase
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'available');

    // Total procurement requests
    const { count: totalRequests, error: reqErr } = await supabase
      .from('procurement_requests')
      .select('*', { count: 'exact', head: true });

    // Active requests
    const { count: activeRequests, error: activeErr } = await supabase
      .from('procurement_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['new', 'searching', 'shortlisted', 'negotiation']);

    // Completed deals
    const { count: completedDeals, error: compErr } = await supabase
      .from('procurement_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // Total contracts
    const { count: totalContracts, error: contractErr } = await supabase
      .from('contracts')
      .select('*', { count: 'exact', head: true });

    // Pending documents
    const { count: pendingDocs, error: docsErr } = await supabase
      .from('legal_documents')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'pending');

    res.json({
      totalProperties: totalProperties || 0,
      availableProperties: availableProperties || 0,
      totalRequests: totalRequests || 0,
      activeRequests: activeRequests || 0,
      completedDeals: completedDeals || 0,
      totalContracts: totalContracts || 0,
      pendingDocuments: pendingDocs || 0,
      status: 'CONNECTED'
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      error: err.message,
      stats: {
        totalProperties: 0, availableProperties: 0, totalRequests: 0,
        activeRequests: 0, completedDeals: 0, totalContracts: 0, pendingDocuments: 0
      }
    });
  }
});

// ==================== REPORTING & ANALYTICS API ====================

// GET: Transaction summary
app.get('/api/procurement-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let contractsQuery = supabase
      .from('contracts')
      .select('total_amount, created_at');
    
    if (startDate) contractsQuery = contractsQuery.gte('agreement_date', startDate);
    if (endDate) contractsQuery = contractsQuery.lte('agreement_date', endDate);
    
    const { data: contracts, error: contractsErr } = await contractsQuery;

    let paymentsQuery = supabase
      .from('procurement_payments')
      .select('amount, status, paid_at');
    
    if (startDate) paymentsQuery = paymentsQuery.gte('paid_at', startDate);
    if (endDate) paymentsQuery = paymentsQuery.lte('paid_at', endDate);
    
    const { data: payments, error: paymentsErr } = await paymentsQuery;

    const totalDealValue = contracts?.reduce((sum, c) => sum + (c.total_amount || 0), 0) || 0;
    const totalPaid = payments?.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const pendingAmount = totalDealValue - totalPaid;

    res.json({
      totalDealValue,
      totalPaid,
      pendingAmount,
      totalContracts: contracts?.length || 0,
      totalPayments: payments?.length || 0,
      period: { startDate, endDate }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== STATIC ROUTES ====================

// Serve Portal
app.get('/portal', (req, res) => {
  res.sendFile(path.join(__dirname, 'portal.html'));
});

// Serve Admin (Placeholder)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin/index.html'));
});

// Default Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 IGO Full-Stack Server Running`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log(`📡 Database: Supabase Connected`);
  console.log(`📝 Farm Loan API: POST /api/farm-loan-application`);
  console.log(`📝 Subsidy API: POST /api/subsidy-eligibility-report`);
  console.log(`📝 Lead Score API: GET /api/lead-score\n`);
});
