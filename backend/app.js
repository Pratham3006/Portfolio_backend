require('dotenv').config();
const express = require('express');
const cors = require('cors');

const port = process.env.PORT || process.env.port || 3000;
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Railway Free/Trial/Hobby plans block SMTP, so email goes out over Brevo's HTTPS API.
const BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
const SENDER_EMAIL = process.env.email; // sender address verified in Brevo
const RECEIVER_EMAIL = process.env.RECEIVER_EMAIL || 'pratham.shetty@gmail.com'; // inbox that receives form messages

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));

async function sendMail({ to, subject, html, replyTo }) {
  const res = await fetch(BREVO_URL, {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Pratham Shetty Portfolio', email: SENDER_EMAIL },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(replyTo && { replyTo: { email: replyTo } }),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Brevo API ${res.status}: ${detail}`);
  }
}

app.get('/', (req, res) => {
  res.json({ ok: true });
});

app.post('/send', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        sucess: false,
        message: 'All fields are required',
      });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(401).json({
        sucess: false,
        message: 'Invalid email format',
      });
    }

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message);

    const ownerHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #007bff; margin-top: 0;">Contact Details:</h3>
            <p><strong>Name:</strong> ${safeName}</p>
            <p><strong>Email:</strong> ${safeEmail}</p>
          </div>
          <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h3 style="color: #333; margin-top: 0;">Message:</h3>
            <p style="line-height: 1.6; color: #555;">${safeMessage}</p>
          </div>
          <div style="margin-top: 20px; padding: 15px; background-color: #e9ecef; border-radius: 5px;">
            <p style="margin: 0; font-size: 12px; color: #666;">
              This message was sent from your portfolio contact form on ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `;

    const autoReplyHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #007bff;">Thank you for reaching out, ${safeName}!</h2>
          <p>I've received your message and will get back to you as soon as possible.</p>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Your message:</h3>
            <p style="font-style: italic; color: #666;">"${safeMessage}"</p>
          </div>

          <p>Best regards,<br>
          <strong>Pratham Shetty</strong><br>
          Frontend Web Developer</p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="font-size: 12px; color: #888;">
              This is an automated response. Please do not reply to this email.
            </p>
          </div>
        </div>
      `;

    await Promise.all([
      sendMail({
        to: RECEIVER_EMAIL,
        subject: `New Contact Form Submission from ${name}`,
        html: ownerHtml,
        replyTo: email,
      }),
      sendMail({
        to: email,
        subject: 'Thank you for contacting me!',
        html: autoReplyHtml,
      }),
    ]);

    res.status(200).json({
      sucess: true,
      message: 'Message sent successfully!',
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message. Please try again later.',
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
