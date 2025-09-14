// --- 1. CONFIGURE ENVIRONMENT VARIABLES ---
// This line should always be at the very top.
// It loads secret keys (like database passwords and email credentials)
// from a special `.env` file into the application's environment.
require('dotenv').config();

// --- 2. IMPORT DEPENDENCIES ---
// These are the external libraries our server needs to function.
const express = require('express'); // The core framework for building the web server.
const mongoose = require('mongoose'); // A library to easily interact with our MongoDB database.
const nodemailer = require('nodemailer'); // The library used for sending emails (for OTPs).
const cors = require('cors'); // A package to handle Cross-Origin Resource Sharing security.
const bcrypt = require('bcryptjs'); // A library for securely hashing user passwords.
const { spawn } = require('child_process'); // A built-in Node.js module to run external scripts, like our Python AI.

// --- 3. INITIALIZE THE EXPRESS APP ---
// We create an instance of the Express application, which we'll use to build our API.
const app = express();

// --- 4. DEFINE THE PORT ---
// This is the network port our server will listen on.
// It will use the port defined in the deployment environment (like Render) or default to 3000 for local development.
const PORT = process.env.PORT || 3000;

// --- 5. SETUP CONNECTIONS & MIDDLEWARE ---

// MongoDB Connection String
// This securely reads your database URL from the environment variables.
const MONGO_URI = process.env.MONGO_URI;

// Email Transporter Configuration
// This configures nodemailer to send emails using your Gmail account.
// It securely reads your email and App Password from the environment variables.
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

// CORS (Cross-Origin Resource Sharing) Configuration
// This is a critical security step. It tells our backend server to ONLY accept
// requests from our live frontend website (e.g., your Vercel URL).
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://logistics-net.vercel.app',
  optionsSuccessStatus: 200 
};
app.use(cors(corsOptions));

// JSON Middleware
// This tells Express to automatically parse incoming request bodies as JSON.
app.use(express.json());

// --- 6. ESTABLISH DATABASE CONNECTION ---
mongoose.connect(MONGO_URI)
  .then(() => console.log('Successfully connected to MongoDB.'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- 7. DEFINE DATABASE SCHEMAS & MODELS ---
// A schema is a blueprint for the data that will be stored in a collection.

// OTP Schema: Stores temporary OTPs and auto-deletes them after 5 minutes.
const otpSchema = new mongoose.Schema({ email: { type: String, required: true }, otp: { type: String, required: true }, createdAt: { type: Date, default: Date.now, expires: 300 }, });
const Otp = mongoose.model('Otp', otpSchema);

// User Schemas: Define the structure for each type of user.
const startupSchema = new mongoose.Schema({ companyName: { type: String, required: true }, yearsInOperation: { type: Number, required: true }, fleetSize: { type: String, required: true }, serviceArea: { type: String, required: true }, email: { type: String, required: true, unique: true }, password: { type: String, required: true }, });
const Startup = mongoose.model('Startup', startupSchema);

const businessSchema = new mongoose.Schema({ companyName: { type: String, required: true }, businessType: { type: String, required: true }, companySize: { type: String, required: true }, monthlyShipments: { type: Number, required: true }, email: { type: String, required: true, unique: true }, password: { type: String, required: true }, });
const Business = mongoose.model('Business', businessSchema);

const customerSchema = new mongoose.Schema({ fullName: { type: String, required: true }, email: { type: String, required: true, unique: true }, password: { type: String, required: true }, });
const Customer = mongoose.model('Customer', customerSchema);


// --- 8. DEFINE API ROUTES (ENDPOINTS) ---

// A simple test route to confirm the server is running.
app.get('/', (req, res) => res.send('Welcome to the Logistics Net Backend!'));

// --- OTP Generation Route ---
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
        if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required.' });
        
        const otpRecord = await Otp.findOne({ email });
        if (!otpRecord || otpRecord.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP or OTP has expired.' });
        }

        await Otp.deleteOne({ email }); // OTP is correct, delete it so it can't be reused.
        res.status(200).json({ message: 'Email verified successfully.' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ message: 'Failed to verify OTP. Please try again later.' });
    }
});

// --- USER REGISTRATION ROUTES ---

// A generic function to handle registration for any user type.
async function registerUser(Model, userData, res) {
    try {
        const { email, password } = userData;
        if (await Model.findOne({ email })) {
            return res.status(400).json({ message: 'An account with this email already exists.' });
        }
        // Securely hash the password before saving it.
        const salt = await bcrypt.genSalt(10);
        userData.password = await bcrypt.hash(password, salt);
        
        await new Model(userData).save();
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error during registration.' });
    }
}

app.post('/api/register/startup', (req, res) => registerUser(Startup, req.body, res));
app.post('/api/register/business', (req, res) => registerUser(Business, req.body, res));
app.post('/api/register/customer', (req, res) => registerUser(Customer, req.body, res));

// --- AI RECOMMENDATION ROUTE ---
app.post('/api/recommend', (req, res) => {
    const { origin, destination, priorities, fragility } = req.body;
    
    // Run the Python script as a separate process and pass user inputs as arguments.
    const pythonProcess = spawn('python3', [ 'predict_api.py', origin, destination, priorities.join(','), fragility ]);

    let pythonResponse = '';
    let errorResponse = '';
    pythonProcess.stdout.on('data', (data) => { pythonResponse += data.toString(); });
    pythonProcess.stderr.on('data', (data) => { errorResponse += data.toString(); });

    pythonProcess.on('close', (code) => {
        if (code !== 0 || errorResponse) {
            console.error(`Python script error: ${errorResponse}`);
            return res.status(500).json({ error: "Failed to get AI recommendation.", details: errorResponse });
        }
        try {
            res.status(200).json(JSON.parse(pythonResponse));
        } catch (e) {
            console.error("Failed to parse JSON from Python script:", pythonResponse);
            res.status(500).json({ error: "Invalid response from AI model." });
        }
    });
});


// --- 9. START THE SERVER ---
// This command starts the server, which begins listening for incoming requests on the specified port.
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});