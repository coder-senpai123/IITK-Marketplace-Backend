const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, text) => {
  try {
    // For development, you can use Ethereal Email, but for this project we use Gmail/SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      family: 4, // Force IPv4 (Render free tier doesn't support IPv6)
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"IITK Marketplace" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Your IITK Marketplace Login Code</h2>
              <p>Please use the following OTP to log in:</p>
              <h1 style="letter-spacing: 5px; color: #2563EB;">${text}</h1>
              <p>This code expires in 5 minutes.</p>
             </div>`
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

module.exports = sendEmail;