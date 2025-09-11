// 1. Configure Environment Variables
require('dotenv').config();

// 2. Import Dependencies
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // For hashing passwords

// 3. Initialize the App
const app = express();

// 4. Define the Port
const PORT = process.env.PORT || 3000;

// --- MongoDB Connection ---
const MONGO_URI = process.env.MONGO_URI;

// --- Email Transporter Configuration ---
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
// --- THIS IS THE FIX ---
// We are now explicitly telling the server to trust your Vercel URL.
const corsOptions = {
  origin: 'https://logistics-net.vercel.app', // Your live Vercel frontend URL
  optionsSuccessStatus: 200 
};
app.use(cors(corsOptions));
// --- END OF FIX ---

app.use(express.json());

// 6. Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('MongoDB connection error:', err));

// 7. Mongoose Schemas
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 },
});
const Otp = mongoose.model('Otp', otpSchema);

const startupSchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    yearsInOperation: { type: Number, required: true },
    fleetSize: { type: String, required: true },
    serviceArea: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const Startup = mongoose.model('Startup', startupSchema);

const businessSchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    businessType: { type: String, required: true },
    companySize: { type: String, required: true },
    monthlyShipments: { type: Number, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const Business = mongoose.model('Business', businessSchema);

const customerSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const Customer = mongoose.model('Customer', customerSchema);


// 8. API Routes
app.get('/', (req, res) => res.send('Welcome to the Logistics Net Backend!'));
app.get('/favicon.ico', (req, res) => res.status(204).send());

// OTP Routes
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

// Registration Routes
async function registerUser(Model, userData, res) {
    try {
        const { email, password } = userData;
        const existingUser = await Model.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'An account with this email already exists.' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        userData.password = hashedPassword;
        const newUser = new Model(userData);
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
}

app.post('/api/register/startup', (req, res) => {
    const { companyName, yearsInOperation, fleetSize, serviceArea, email, password } = req.body;
    registerUser(Startup, { companyName, yearsInOperation, fleetSize, serviceArea, email, password }, res);
});

app.post('/api/register/business', (req, res) => {
    const { companyName, businessType, companySize, monthlyShipments, email, password } = req.body;
    registerUser(Business, { companyName, businessType, companySize, monthlyShipments, email, password }, res);
});

app.post('/api/register/customer', (req, res) => {
    const { fullName, email, password } = req.body;
    registerUser(Customer, { fullName, email, password }, res);
});


// 9. Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});