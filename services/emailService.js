const nodemailer = require('nodemailer');

const sendFormLinkEmail = async (email, name, refNum) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const formLink = `http://localhost:5000/portal?ref=${refNum}`;

    const mailOptions = {
      from: `"IGO AgrITech Farms" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Official Loan & Subsidy Application - ${refNum}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; border: 1px solid #e2e8f0; border-radius: 20px;">
          <h2 style="color: #059669;">Hello ${name},</h2>
          <p style="font-size: 16px; color: #1e293b;">Thank you for your enquiry with IGO AgrITech Farms. We are ready to help you secure your government subsidy and loan.</p>
          <div style="background: #f8fafc; padding: 30px; border-radius: 16px; margin: 30px 0; text-align: center;">
            <p style="margin-bottom: 20px; font-weight: bold;">Your Official Application Link:</p>
            <a href="${formLink}" style="background: #059669; color: #fff; padding: 15px 30px; border-radius: 100px; text-decoration: none; font-weight: bold; font-size: 18px;">Fill Application Form</a>
          </div>
          <p style="font-size: 14px; color: #64748b;">Your Reference Number: <strong>${refNum}</strong></p>
          <p style="font-size: 14px; color: #64748b; margin-top: 40px;">Best Regards,<br><strong>IGO Groups National Digital Team</strong></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email Error:', error);
    return { success: false, error: error.message };
  }
};

const sendAdminNotification = async (type, data) => {
  try {
    const isMock = !process.env.SMTP_USER || process.env.SMTP_USER.includes('your-email');
    
    if (isMock) {
      console.log('--- MOCK ADMIN EMAIL ---');
      console.log('To: admin@igofarmloans.com');
      console.log('Subject:', `NEW ENQUIRY: ${type.toUpperCase()}`);
      console.log('Data:', data);
      console.log('------------------------');
      return { success: true, mock: true };
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"IGO System Alert" <${process.env.SMTP_USER}>`,
      to: 'admin@igofarmloans.com',
      subject: `🚨 NEW ENQUIRY: ${type.toUpperCase()} - ${data.fullName || 'New Lead'}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #059669;">New Lead Captured</h2>
          <p><strong>Source:</strong> ${type}</p>
          <hr>
          <p><strong>Name:</strong> ${data.fullName || data.name}</p>
          <p><strong>Phone:</strong> ${data.phone || data.mobile}</p>
          <p><strong>Email:</strong> ${data.email || 'Not provided'}</p>
          <p><strong>Location:</strong> ${data.district || 'N/A'}, ${data.state || 'N/A'}</p>
          ${data.loanAmount ? `<p><strong>Loan Amount:</strong> ₹${data.loanAmount}</p>` : ''}
          <hr>
          <p style="font-size: 12px; color: #666;">This is an automated alert from IGO Groups Command Center.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Admin Email Alert Error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendFormLinkEmail, sendAdminNotification };
