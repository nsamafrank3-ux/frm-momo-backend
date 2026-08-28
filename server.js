const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

// Load .env file locally (Render handles environment variables automatically)
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MTN Sandbox Configuration variables pulled securely from Environment Variables
const SUBSCRIPTION_KEY = process.env.MOMO_PRIMARY_KEY;
const API_USER = process.env.MOMO_API_USER;
const API_KEY = process.env.MOMO_API_KEY;
const TARGET_ENVIRONMENT = "sandbox";

// 1. HOME ROUTE (Fixes the "Cannot GET /" error when Render wakes up)
app.get('/', (req, res) => {
    res.send('FRM MoMo Backend is awake and running!');
});

// 2. PAYMENT ENDPOINT
app.post('/pay', async (req, res) => {
    const { amount, phone, description } = req.body;

    try {
        // Step A: Request Access Token from MTN Sandbox
        const credentials = Buffer.from(`${API_USER}:${API_KEY}`).toString('base64');
        
        const tokenResponse = await fetch('https://ericssonbasicapi2.azure-api.net/collection/token/', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY
            }
        });

        if (!tokenResponse.ok) {
            const tokenErrText = await tokenResponse.text();
            console.error("Token Error Response:", tokenErrText);
            throw new Error('Failed to get token from MTN Sandbox');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Step B: Trigger Request to Pay (MoMo Collection)
        const referenceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        const payResponse = await fetch('https://ericssonbasicapi2.azure-api.net/collection/v1_0/requesttopay', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Reference-Id': referenceId,
                'X-Target-Environment': TARGET_ENVIRONMENT,
                'Ocp-Apim-Subscription-Key': SUBSCRIPTION_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount.toString(),
                currency: "EUR", // MTN Sandbox default test currency
                externalId: "123456",
                payer: {
                    partyIdType: "MSISDN",
                    partyId: phone
                },
                payerMessage: description || "FRM Savings Deposit",
                payeeNote: "Thank you for saving"
            })
        });

        if (payResponse.status === 202 || payResponse.ok) {
            return res.json({ success: true, referenceId: referenceId, message: "USSD push sent successfully!" });
        } else {
            const errText = await payResponse.text();
            return res.status(400).json({ success: false, error: errText });
        }

    } catch (error) {
        console.error("MoMo Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`FRM MoMo Backend running on port ${PORT}`);
});
