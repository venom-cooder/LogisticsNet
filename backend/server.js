// 1. Configure Environment Variables
// This line should be at the very top. It loads the variables for local development.
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
// This will now use the variable from Render's environment.
const MONGO_URI = process.env.MONGO_URI;

// --- Email Transporter Configuration for Gmail ---
// This is now securely configured to use environment variables for your Gmail credentials.
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.GMAIL_USER, // Reads your Gmail address from Render's environment
    pass: process.env.GMAIL_APP_PASS,   // Reads your 16-digit App Password from Render's environment
  },
});


// 5. Middleware Setup
app.use(cors());
app.use(express.json());


// 6. Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('MongoDB connection error:', err));

// 7. Mongoose Schema for OTP
const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // The document will be automatically deleted after 5 minutes
  },
});

const Otp = mongoose.model('Otp', otpSchema);


// 8. API Routes
app.get('/', (req, res) => {
  res.send('Welcome to the Logistics Net Backend!');
});

// --- OTP Generation and Sending Route ---
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate({ email }, { otp }, { upsert: true, new: true, setDefaultsOnInsert: true });

    const mailOptions = {
      from: `"Logistics Net" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: 'Your Verification Code',
      text: `Your OTP for Logistics Net is: ${otp}. It will expire in 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    console.log('OTP Email sent to: ' + email);
    
    res.status(200).json({ message: 'OTP sent successfully to your email.' });

  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ message: 'Failed to send OTP. Please check server logs.' });
  }
});

// --- OTP Verification Route ---
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
            res.status(400).json({ message: 'Invalid OTP. Please check and try again.' });
        }

    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ message: 'Failed to verify OTP. Please try again later.' });
    }
});


// 9. Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
