const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, text) => {
  try {
    await resend.emails.send({
      from: `IITK Marketplace <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
      to,
      subject,
      html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>${subject}</h2>
              <p>Please use the following code:</p>
              <h1 style="letter-spacing: 5px; color: #2563EB;">${text}</h1>
              <p>This code expires in 5 minutes.</p>
             </div>`
    });
    console.log(`📧 Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

module.exports = sendEmail;