const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB (Ensure you set MONGO_URI in your Render environment variables)
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/momosave', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("Connected to MongoDB successfully"))
.catch(err => console.error("MongoDB connection error:", err));

// Vault Schema updated with subscription flags
const VaultSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    savingYear: Number,
    targetAmount: Number,
    dailyAmount: Number,
    lockTermMonths: Number,
    enforcementTier: String,
    flexBalance: { type: Number, default: 0 },
    currentSaved: { type: Number, default: 0 },
    accumulatedLockMonths: { type: Number, default: 0 },
    startDateTimestamp: Number,
    savedDays: { type: Object, default: {} },
    ledgerRecords: { type: Array, default: [] },
    isSubscribed: { type: Boolean, default: false },
    subscriptionExpiryTimestamp: { type: Number, default: 0 }
});

const Vault = mongoose.model('Vault', VaultSchema);

// 1. Payment Route (/pay) - Handles both savings deposits and K5 subscriptions
app.post('/pay', async (req, res) => {
    try {
        const { amount, phone, description } = req.body;
        
        if (!amount || !phone) {
            return res.status(400).json({ success: false, error: "Missing amount or phone number." });
        }

        console.log(`[MTN MoMo Gateway] Processing payment of ZMW ${amount} for ${phone} (${description})`);

        // NOTE: If you integrate the official MTN MoMo Collections API later, 
        // you would make your external API request to MTN here. 
        // For now, this acts as the live backend bridge responding to your frontend:
        
        res.json({
            success: true,
            message: `USSD push sent successfully to ${phone} for ZMW ${amount}`,
            transactionId: 'MOMO-ZM-' + Math.floor(100000 + Math.random() * 900000)
        });

    } catch (error) {
        console.error("Payment processing error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 2. Sync Vault Route (/api/vault/sync)
app.post('/api/vault/sync', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) return res.status(400).json({ success: false, error: "Phone number required" });

        const vault = await Vault.findOne({ phone });
        if (vault) {
            res.json({ success: true, vault });
        } else {
            res.json({ success: false, message: "No cloud record found for this number." });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. Update/Save Vault Route (/api/vault/update)
app.post('/api/vault/update', async (req, res) => {
    try {
        const { phone, ...updateData } = req.body;
        if (!phone) return res.status(400).json({ success: false, error: "Phone number required" });

        // Upsert: Updates if exists, creates if it's a new user
        const vault = await Vault.findOneAndUpdate(
            { phone },
            { $set: updateData },
            { new: true, upsert: true }
        );

        res.json({ success: true, vault });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`MoMoSave Backend running on port ${PORT}`);
});
