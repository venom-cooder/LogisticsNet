// --- 1. CONFIGURE ENVIRONMENT VARIABLES ---
// This line must be at the very top of your file.
// It loads secret keys (like database passwords, email credentials, etc.)
// from a special `.env` file into `process.env`, so you can use them securely
// without writing them directly in your code.
require('dotenv').config();

// --- 2. IMPORT DEPENDENCIES ---
// These are the external libraries (packages) our server needs to function.
const express = require('express');             // The core framework for building the web server and its APIs.
const mongoose = require('mongoose');           // A library to easily interact with our MongoDB database.
const nodemailer = require('nodemailer');         // The library used for sending emails (for OTPs).
const cors = require('cors');                   // A package to handle Cross-Origin Resource Sharing security.
const bcrypt = require('bcryptjs');             // A library for securely "hashing" user passwords before saving them.
const { spawn } = require('child_process');     // A built-in Node.js module to run external programs, like our Python AI script.

// --- 3. INITIALIZE THE EXPRESS APP ---
// We create an instance of the Express application, which we'll name 'app'.
// 'app' is the main object we will use to define our API routes and configure the server.
const app = express();
const PORT = process.env.PORT || 3000; // The server will run on the port provided by Render, or 3000 on your local machine.

// --- 4. CENTRALIZED COMPANY DATABASE ---
// This object acts as a quick-access, in-memory database for company details.
// When the AI recommends a company by name, this allows the server to instantly
// retrieve and send back all the rich details (address, contact number, etc.) to the frontend.
const COMPANY_DETAILS = {
    'Blue Dart': {'domain': 'bluedart.com', 'hub': 'Nagpur', 'bhopal_address': 'Zone II, MP Nagar', 'care_number': '1860-233-1234', 'safety': 4.9, 'speed': 9.5, 'cost': 7.0, 'reviews': 4.8},
    'Delhivery': {'domain': 'delhivery.com', 'hub': 'Indore', 'bhopal_address': 'Arera Colony', 'care_number': '1800-103-6354', 'safety': 4.5, 'speed': 8.0, 'cost': 9.0, 'reviews': 4.6},
    'DTDC': {'domain': 'dtdc.in', 'hub': 'Indore', 'bhopal_address': 'New Market', 'care_number': '1860-204-2222', 'safety': 4.2, 'speed': 7.5, 'cost': 9.2, 'reviews': 4.8},
    'FedEx': {'domain': 'fedex.com', 'hub': 'Mumbai', 'bhopal_address': 'Hoshangabad Road', 'care_number': '1800-209-6161', 'safety': 4.8, 'speed': 9.2, 'cost': 6.5, 'reviews': 4.7},
    'Gati': {'domain': 'gati.com', 'hub': 'Nagpur', 'bhopal_address': 'Transport Nagar', 'care_number': '1860-123-4284', 'safety': 4.4, 'speed': 7.8, 'cost': 8.8, 'reviews': 4.2},
    'Safexpress': {'domain': 'safexpress.com', 'hub': 'Nagpur', 'bhopal_address': 'Bairagarh', 'care_number': '1800-113-113', 'safety': 4.7, 'speed': 8.2, 'cost': 8.5, 'reviews': 4.5},
    'LogisticStartup': {'domain': 'example.com', 'hub': 'Pune', 'bhopal_address': '123 Innovation Road, Bhopal', 'care_number': '98765-43210', 'safety': 5.0, 'speed': 8.8, 'cost': 9.5, 'reviews': 5.0},
    'TCI Express': {'domain': 'tciexpress.in', 'hub': 'Nagpur', 'bhopal_address': 'Govindpura Industrial Area', 'care_number': '1800-200-0977', 'safety': 4.6, 'speed': 8.0, 'cost': 8.6, 'reviews': 4.7},
};

// --- 5. SETUP CONNECTIONS & MIDDLEWARE ---
const MONGO_URI = process.env.MONGO_URI;
const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASS } });
const corsOptions = { origin: process.env.FRONTEND_URL || 'https://logistics-net.vercel.app' };
app.use(cors(corsOptions));
app.use(express.json());

// --- 6. ESTABLISH DATABASE CONNECTION ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- 7. DEFINE DATABASE SCHEMAS & MODELS ---
// A schema is a blueprint that defines the structure of documents within a MongoDB collection.

const otpSchema = new mongoose.Schema({ email: { type: String, required: true }, otp: { type: String, required: true }, createdAt: { type: Date, default: Date.now, expires: 300 }});
const Otp = mongoose.model('Otp', otpSchema);

// --- CORRECTED: User Schemas now include all fields from the registration form ---
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
    password: { type: String, required: true }
});
const Customer = mongoose.model('Customer', customerSchema);


// --- 8. DEFINE API ROUTES (ENDPOINTS) ---

// A. Test and Info Routes
app.get('/', (req, res) => res.send('Welcome to the Logistics Net Backend!'));
app.get('/favicon.ico', (req, res) => res.status(204).send()); // Prevents 404 errors in logs for the browser icon.
app.get('/api/company/:companyName', (req, res) => {
    const details = COMPANY_DETAILS[req.params.companyName];
    if (details) res.status(200).json(details);
    else res.status(404).json({ message: "Company details not found." });
});

// B. AI Recommendation Route
app.post('/api/recommend', (req, res) => {
    const { origin, destination, priorities, fragility } = req.body;
    const pythonProcess = spawn('python3', [ 'predict_api.py', origin, destination, priorities.join(','), fragility ]);
    let pythonResponse = '', errorResponse = '';
    pythonProcess.stdout.on('data', (data) => { pythonResponse += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorResponse += data.toString(); });
    pythonProcess.on('close', (code) => {
        if (code !== 0 || errorResponse) {
            console.error(`Python script error: ${errorResponse}`);
            return res.status(500).json({ error: "Failed to get AI recommendation.", details: errorResponse });
        }
        try { res.status(200).json(JSON.parse(pythonResponse)); }
        catch (e) { res.status(500).json({ error: "Invalid response from AI model." }); }
    });
});

// C. Authentication Routes (OTP, Registration, Login)
app.post('/api/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required.' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate({ email }, { otp }, { upsert: true, new: true, setDefaultsOnInsert: true });
    const mailOptions = { from: `"Logistics Net" <${process.env.GMAIL_USER}>`, to: email, subject: 'Your Verification Code', text: `Your OTP for Logistics Net is: ${otp}. It will expire in 5 minutes.` };
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'OTP sent successfully.' });
  } catch (error) { res.status(500).json({ message: 'Failed to send OTP.' }); }
});

app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required.' });
        const otpRecord = await Otp.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) return res.status(400).json({ message: 'Invalid or expired OTP.' });
        await Otp.deleteOne({ email });
        res.status(200).json({ message: 'Email verified successfully.' });
    } catch (error) { res.status(500).json({ message: 'Failed to verify OTP.' }); }
});

// Generic registration function
async function registerUser(Model, userData, res) {
    try {
        const { email, password } = userData;
        if (await Model.findOne({ email })) return res.status(400).json({ message: 'Account with this email already exists.' });
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(password, salt); // Hash the password
        await new Model(userData).save(); // Saves the complete user data
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) { res.status(500).json({ message: 'Server error during registration.' }); }
}

// CORRECTED: The registration routes now pass the full request body to the registerUser function.
app.post('/api/register/startup', (req, res) => registerUser(Startup, req.body, res));
app.post('/api/register/business', (req, res) => registerUser(Business, req.body, res));
app.post('/api/register/customer', (req, res) => registerUser(Customer, req.body, res));


// Login Routes
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
app.post('/api/login/startup', (req, res) => loginUser(Startup, req, res));
app.post('/api/login/business', (req, res) => loginUser(Business, req, res));
app.post('/api/login/customer', (req, res) => loginUser(Customer, req, res));


// --- 9. START THE SERVER ---
// This command starts the server, which begins listening for incoming requests on the specified port.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
