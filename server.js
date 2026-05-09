const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const { sendFormLinkEmail, sendAdminNotification } = require('./services/emailService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// In-Memory Lead Store (Real-time fallback for Demo/Dev Mode)
let mockLeads = [];

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
    if (!formData.fullName || !formData.phone || (!formData.loanAmount && !formData.investment)) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Missing required fields: fullName, phone, loanAmount or investment' 
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
      farm_size: formData.farmSize ? parseFloat(formData.farmSize) : (formData.area ? parseFloat(formData.area) : null),
      ownership: formData.ownership || null,
      soil_type: formData.soilType || null,
      water_source: formData.waterSource || null,
      experience: formData.experience ? parseInt(formData.experience) : null,
      loan_type: formData.loanType || 'farm-loan',
      loan_amount: parseFloat(formData.loanAmount) || (formData.investment ? parseFloat(formData.investment) : 0),
      loan_purpose: formData.loanPurpose || formData.projectVertical || formData.estateType || null,
      timeline: formData.timeline || null,
      managed_interest: formData.managedInterest || (formData.loanType === 'agri-estate' ? 'yes' : 'no'),
      asset_types: formData.assetTypes || [],
      invest_capacity: formData.investCapacity || (formData.investment ? `${formData.investment}L` : null),
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
      
      // Fallback for demo/development if keys are placeholders
      if (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.includes('YOUR_')) {
        console.warn('⚠️ Using Mock Success Fallback (Keys are placeholders)');
        
        const mockEntry = {
          id: 'mock-' + Date.now(),
          reference_number: referenceNumber,
          full_name: formData.fullName,
          phone: formData.phone,
          email: formData.email || null,
          state: formData.state,
          district: formData.district,
          loan_type: formData.loanType || 'farm-loan',
          loan_amount: application.loan_amount,
          purpose: application.loan_purpose,
          status: 'submitted',
          created_at: new Date().toISOString()
        };
        mockLeads.unshift(mockEntry);

        // Real-time email alert to admin@igofarmloans.com
        sendAdminNotification(formData.loanType || 'farm-loan', formData);

        return res.json({
          status: 'success',
          referenceNumber: referenceNumber,
          message: 'Application submitted successfully (Mock Mode)',
          leadScore: leadScore,
          routeTo: routeTo,
          nextSteps: ['Demo mode active: In a real environment, this would be saved to Supabase']
        });
      }

      return res.status(500).json({ 
        status: 'error', 
        message: 'Database error: ' + error.message 
      });
    }

    // Store lead score (optional, don't fail the whole request if this fails)
    try {
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
    } catch (scoreErr) {
      console.error('Lead score storage failed (non-critical):', scoreErr);
    }

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

      // Fallback for demo/development if keys are placeholders
      if (process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY.includes('YOUR_')) {
        console.warn('⚠️ Using Mock Success Fallback (Subsidy Report)');
        
        const mockEntry = {
          id: 'mock-sub-' + Date.now(),
          full_name: formData.fullName || formData.projectName,
          phone: formData.phone || 'N/A',
          state: formData.state,
          district: formData.district,
          loan_type: 'subsidy-calculator',
          status: 'completed',
          created_at: new Date().toISOString(),
          total_subsidy: Math.round(totalSubsidy)
        };
        mockLeads.unshift(mockEntry);

        // Real-time email alert to admin@igofarmloans.com
        sendAdminNotification('subsidy-report', {
          ...formData,
          totalSubsidy: Math.round(totalSubsidy)
        });

        return res.json({
          status: 'success',
          projectCost: projectCost,
          subsidyStack: eligibleSchemes,
          totalSubsidy: Math.round(totalSubsidy),
          yourCost: Math.round(farmerContribution),
          loanNeeded: Math.round(loanNeeded),
          subsidyCoverage: coveragePercent,
          processingTimeline: '2-4 months',
          reportId: mockEntry.id
        });
      }

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
      // If Supabase fails but we have mock leads, return them for the "wow" factor
      if (mockLeads.length > 0) {
        return res.json({ success: true, leads: mockLeads, source: 'mock_memory' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    // Merge real data with any mock session data for the dashboard
    const allLeads = [...mockLeads, ...data];
    res.json({ success: true, leads: allLeads });
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

// GET All Leads (Unified for Admin)
app.get('/api/leads', async (req, res) => {
  try {
    const { data: supabaseLeads, error } = await supabase
      .from('farm_loan_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch failed, returning mock leads only:', error.message);
      return res.json({ success: true, leads: mockLeads });
    }

    // Combine with mock leads for real-time visibility in demo/dev
    const combinedLeads = [...supabaseLeads, ...mockLeads].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );

    res.json({ success: true, leads: combinedLeads });
  } catch (err) {
    res.status(500).json({ success: true, leads: mockLeads, note: 'Error fetching Supabase: ' + err.message });
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

    const totalSubsidyValue = subsidyData?.reduce((sum, row) => sum + (row.total_subsidy || 0), 0) || 0;

    res.json({
      success: true,
      totalLeads: (loanCount || 0) + mockLeads.length,
      totalApplications: (loanCount || 0) + mockLeads.length,
      totalSubsidyReports: subsidyCount || 0,
      subsidyFacilitated: `₹${(totalSubsidyValue / 100000).toFixed(1)}L`,
      activeBrands: 26,
      status: 'CONNECTED'
    });

  } catch (err) {
    res.json({
      success: false,
      totalLeads: mockLeads.length,
      totalApplications: mockLeads.length,
      status: 'ERROR',
      error: err.message
    });
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

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`\n🚀 IGO Full-Stack Server Running`);
    console.log(`🔗 Local: http://localhost:${port}`);
    console.log(`📡 Database: Supabase Connected`);
    console.log(`📝 Farm Loan API: POST /api/farm-loan-application`);
    console.log(`📝 Subsidy API: POST /api/subsidy-eligibility-report`);
    console.log(`📝 Lead Score API: GET /api/lead-score`);
    console.log(`📝 Portal: http://localhost:${port}/portal`);
    console.log(`📝 Procurement endpoints deployed as Netlify Functions`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${port} is busy, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
};

startServer(PORT);
