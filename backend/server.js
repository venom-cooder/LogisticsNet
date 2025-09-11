// 1. Configure Environment Variables
require('dotenv').config();

// 2. Import Dependencies
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');

// 3. Initialize the App
const app = express();

// 4. Define the Port
const PORT = process.env.PORT || 3000;

// --- MongoDB Connection ---
const MONGO_URI = process.env.MONGO_URI;

// --- Email Transporter Configuration (Gmail + App Password) ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

// 5. Middleware Setup
// Allow both local and deployed frontend
const corsOptions = {
  origin: [
    'http://localhost:3000',             // for local testing
    'https://logistics-net-frontend.vercel.app' // replace with your actual Vercel frontend URL
  ],
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

// 6. Database Connection
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ Successfully connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 7. Mongoose Schema for OTP
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 }, // auto delete after 5 mins
});

const Otp = mongoose.model('Otp', otpSchema);

// 8. API Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Logistics Net Backend!' });
});

// prevent favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).send());

// --- OTP Generation and Sending ---
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { email },
      { otp },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const mailOptions = {
      from: `"Logistics Net" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      text: `Your OTP for Logistics Net is: ${otp}. It will expire in 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 OTP Email sent to: ${email}`);

    res.status(200).json({ message: 'OTP sent successfully to your email.' });
  } catch (error) {
    console.error('❌ Error sending OTP:', error);
    res.status(500).json({ message: 'Failed to send OTP. Please try again later.' });
  }
});

// --- OTP Verification ---
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' });
    }

    const otpRecord = await Otp.findOne({ email });
    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid OTP or OTP has expired.' });
    }

    if (otpRecord.otp === otp) {
      await Otp.deleteOne({ email });
      res.status(200).json({ message: 'Email verified successfully.' });
    } else {
      res.status(400).json({ message: 'Invalid OTP. Please try again.' });
    }
  } catch (error) {
    console.error('❌ Error verifying OTP:', error);
    res.status(500).json({ message: 'Failed to verify OTP. Please try again later.' });
  }
});

// 9. Start the Server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
