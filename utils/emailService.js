const sendEmail = async (to, subject, text) => {
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: 'IITK Marketplace',
          email: process.env.EMAIL_USER || 'noreply@iitk-marketplace.com',
        },
        to: [{ email: to }],
        subject,
        htmlContent: `<div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>${subject}</h2>
          <p>Please use the following code:</p>
          <h1 style="letter-spacing: 5px; color: #2563EB;">${text}</h1>
          <p>This code expires in 5 minutes.</p>
        </div>`,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(JSON.stringify(err));
    }

    console.log(`📧 Email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
};

module.exports = sendEmail;