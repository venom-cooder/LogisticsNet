// --- 1. CONFIGURE ENVIRONMENT VARIABLES ---
// This line must be at the very top. It loads secret keys (like database passwords, email credentials)
// from a `.env` file into `process.env`, ensuring they are kept secure.
require('dotenv').config();

// --- 2. IMPORT DEPENDENCIES ---
// These are the external libraries (packages) our server needs to function.
const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer'); // Using Nodemailer for sending emails
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { spawn } = require('child_process');

// --- 3. INITIALIZE THE EXPRESS APP ---
const app = express();
const PORT = process.env.PORT || 3000;

// --- 4. CENTRALIZED COMPANY DATABASE ---
// This object acts as a quick-access, in-memory database for company details.
// It allows the server to instantly provide rich data for the AI's recommendations.
const COMPANY_DETAILS = {
    'Blue Dart': {'domain': 'bluedart.com', 'hub': 'Nagpur', 'bhopal_address': 'Zone II, MP Nagar', 'care_number': '1860-233-1234', 'safety': 4.9, 'speed': 9.5, 'cost': 7.0, 'reviews': 4.8},
    'Delhivery': {'domain': 'delhivery.com', 'hub': 'Indore', 'bhopal_address': 'Arera Colony', 'care_number': '1800-103-6354', 'safety': 4.5, 'speed': 8.0, 'cost': 9.0, 'reviews': 4.6},
    // ... (rest of your 50 companies would be listed here)
};

// --- 5. SETUP CONNECTIONS & MIDDLEWARE ---
const MONGO_URI = process.env.MONGO_URI;
// This creates a "transporter" object that knows how to send emails via your Gmail account.
// It uses the secure credentials you've stored in your environment variables on Render.
const transporter = nodemailer.createTransport({ 
    service: 'gmail', 
    auth: { 
        user: process.env.GMAIL_USER, 
        pass: process.env.GMAIL_APP_PASS 
    } 
});

// CORS Configuration: This is a critical security step. It tells our backend to ONLY accept
// requests from our live frontend website.
const corsOptions = { origin: process.env.FRONTEND_URL || 'https://logistics-net.vercel.app' };
app.use(cors(corsOptions));

// JSON Middleware: This tells Express to automatically parse incoming request bodies as JSON.
app.use(express.json());

// --- 6. ESTABLISH DATABASE CONNECTION ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- 7. DEFINE DATABASE SCHEMAS & MODELS ---
// A schema is a blueprint that defines the structure for data in a MongoDB collection.

const otpSchema = new mongoose.Schema({ email: { type: String, required: true }, otp: { type: String, required: true }, createdAt: { type: Date, default: Date.now, expires: 300 }});
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

const intracitySchema = new mongoose.Schema({
    companyName: { type: String, required: true },
    vehicleType: { type: String, required: true },
    cityOfOperation: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
});
const IntraCity = mongoose.model('IntraCity', intracitySchema);


// --- 8. DEFINE ALL API ROUTES (ENDPOINTS) ---

// A. Test and Info Routes
app.get('/', (req, res) => res.send('Welcome to the Logistics Net Backend!'));
app.get('/favicon.ico', (req, res) => res.status(204).send());
app.get('/api/company/:companyName', (req, res) => {
    const details = COMPANY_DETAILS[req.params.companyName];
    if (details) res.status(200).json(details);
    else res.status(404).json({ message: "Company details not found." });
});

// B. AI Recommendation Route
app.post('/api/recommend', (req, res) => {
    const { origin, destination, priorities, fragility } = req.body;
    // Spawns a separate Python process to run the AI model.
    const pythonProcess = spawn('python3', [ 'predict_api.py', origin, destination, priorities.join(','), fragility ]);
    let pythonResponse = '', errorResponse = '';
    pythonProcess.stdout.on('data', (data) => { pythonResponse += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorResponse += data.toString(); });
    pythonProcess.on('close', (code) => {
        if (code !== 0 || errorResponse) {
            console.error(`Python script error: ${errorResponse}`);
            return res.status(500).json({ error: "Failed to get AI recommendation." });
        }
        try { res.status(200).json(JSON.parse(pythonResponse)); }
        catch (e) { res.status(500).json({ error: "Invalid response from AI model." }); }
    });
});

// C. Authentication Routes (OTP, Registration, Login)

// Handles sending a new OTP to a user's email.
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate({ email }, { otp }, { upsert: true, new: true, setDefaultsOnInsert: true });
    
    const mailOptions = { 
        from: `"Logistics Net" <${process.env.GMAIL_USER}>`, 
        to: email, 
        subject: 'Your Verification Code', 
        text: `Your OTP for Logistics Net is: ${otp}.` 
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'OTP sent successfully.' });
  } catch (error) { 
    // This enhanced error logging will help debug issues on Render.
    console.error('--- OTP SENDING FAILED (SERVER ERROR) ---');
    console.error('Time:', new Date().toISOString());
    console.error('Error Details:', error);
    console.error('--- END OF ERROR ---');
    res.status(500).json({ message: 'Failed to send OTP. Check server logs for details.' }); 
  }
});

// Handles verifying an OTP submitted by a user.
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const otpRecord = await Otp.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) return res.status(400).json({ message: 'Invalid or expired OTP.' });
        await Otp.deleteOne({ email });
        res.status(200).json({ message: 'Email verified successfully.' });
    } catch (error) { res.status(500).json({ message: 'Failed to verify OTP.' }); }
});

// This is a generic, reusable function for registering any type of user.
// It handles checking for existing users, hashing the password, and saving the new user.
async function registerUser(Model, userData, res) {
    try {
        const { email, password } = userData;
        if (await Model.findOne({ email })) return res.status(400).json({ message: 'An account with this email already exists.' });
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(password, salt);
        await new Model(userData).save();
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) { res.status(500).json({ message: 'Server error during registration.' }); }
}

// This is a generic, reusable function for logging in any type of user.
// It handles finding the user, securely comparing passwords, and sending the response.
async function loginUser(Model, req, res) {
    try {
        const { email, password } = req.body;
        const user = await Model.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found." });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: "Invalid credentials." });
        res.status(200).json({ message: "Login successful!" });
    } catch (error) { res.status(500).json({ message: 'Server error during login.' }); }
}

// --- Specific Registration Endpoints ---
// Each of these routes calls the same 'registerUser' function, but passes in the correct Model.
app.post('/api/register/startup', (req, res) => registerUser(Startup, req.body, res));
app.post('/api/register/business', (req, res) => registerUser(Business, req.body, res));
app.post('/api/register/intracity', (req, res) => registerUser(IntraCity, req.body, res));

// --- Specific Login Endpoints ---
// Each of these routes calls the same 'loginUser' function, but passes in the correct Model.
app.post('/api/login/startup', (req, res) => loginUser(Startup, req, res));
app.post('/api/login/business', (req, res) => loginUser(Business, req, res));
app.post('/api/login/intracity', (req, res) => loginUser(IntraCity, req, res));


// --- 9. START THE SERVER ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
