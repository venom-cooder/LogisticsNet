// 1. Configure Environment Variables
// This line should be at the very top. It loads the variables from your .env file.
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
const MONGO_URI = 'mongodb://localhost:27017/logistics_net';

// --- Email Transporter Configuration ---
// UPDATED: I have replaced the .env variables with the credentials you provided.
// This will fix the '535 Authentication failed' error.
// --- Email Transporter Configuration for Gmail ---
const transporter = nodemailer.createTransport({
  service: 'gmail', // Use the built-in Gmail service
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: 'pavitradurgeshp@gmail.com', // Your full Gmail address
    pass: 'ioyn jxsb ifzy xvto',   // The 16-character App Password you just generated
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
      from: '"Logistics Net" <no-reply@logistics.net>',
      to: email,
      subject: 'Your Verification Code',
      text: `Your OTP for Logistics Net is: ${otp}. It will expire in 5 minutes.`,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('OTP Email sent: ' + info.response);
    
    // This URL lets you preview the email Ethereal "caught" for you.
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

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
  console.log(`Server is running successfully on http://localhost:${PORT}`);
});