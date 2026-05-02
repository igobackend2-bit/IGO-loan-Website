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

// Initialize Supabase (DISCONNECTED)
/*
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
*/

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '/')));

// ==================== LEAD CAPTURE API (MAINTENANCE MODE) ====================

// Submit Enquiry (Lead)
app.post('/api/enquiry', async (req, res) => {
  res.status(503).json({ success: false, error: 'Database service is currently disconnected for maintenance.' });
});

// GET Application Status
app.get('/api/status/:ref', async (req, res) => {
  res.status(503).json({ success: false, error: 'Database service is currently disconnected for maintenance.' });
});

// ==================== CRM & ADMIN API (DISCONNECTED) ====================

// GET All Leads
app.get('/api/leads', async (req, res) => {
  res.status(503).json({ success: false, error: 'Database service is currently disconnected for maintenance.' });
});

// Send Form Link (Email/WhatsApp)
app.post('/api/send-link', async (req, res) => {
  res.status(503).json({ success: false, error: 'Database service is currently disconnected for maintenance.' });
});

// GET All Applications
app.get('/api/applications', async (req, res) => {
  res.status(503).json({ success: false, error: 'Database service is currently disconnected for maintenance.' });
});

// GET All Documents
app.get('/api/documents', async (req, res) => {
  res.status(503).json({ success: false, error: 'Database service is currently disconnected for maintenance.' });
});

// GET Admin Dashboard Stats
app.get('/api/stats', async (req, res) => {
  res.json({
    totalLeads: 0,
    totalApplications: 0,
    pendingForms: 0,
    subsidyFacilitated: "₹0",
    activeBrands: 0,
    status: 'DISCONNECTED'
  });
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
  console.log(`📡 Database: Supabase Integrated\n`);
});
