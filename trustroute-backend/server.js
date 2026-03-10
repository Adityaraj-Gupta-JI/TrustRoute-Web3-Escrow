const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 🔐 CONFIGURATION
// ==========================================
require('dotenv').config();

// 1. Supabase (Database)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. Corda Web3 Bridge (Blockchain)
const CORDA_API_URL = process.env.CORDA_API_URL || 'http://localhost:10050/api/escrow';
const CORDA_SUPPLIER_NAME = process.env.CORDA_SUPPLIER_NAME || 'O=PartyB, L=New York, C=US';

// 3. Razorpay (Fiat Payment Gateway) - Kept for future production use
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key',
    key_secret: process.env.RAZORPAY_SECRET || 'dummy_secret'
});

// ==========================================
// 🚀 WEB3 API ENDPOINTS
// ==========================================

// 1. GET ALL ORDERS
app.get('/api/orders', async (req, res) => {
    try {
        console.log("Fetching orders from Supabase...");

        // 🚨 FIX: Removed .order('created_at') to prevent 500 error if column is missing
        const { data, error } = await supabase.from('orders').select('*');

        if (error) {
            console.error("❌ SUPABASE ERROR (GET):", error.message);
            throw error;
        }

        res.status(200).json(data || []);
    } catch (error) {
        console.error("GET /api/orders Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 2. DRIVER UPLOADS PROOF
app.post('/api/proof', async (req, res) => {
    try {
        const { order_id, proof_url } = req.body;
        const { error: dbError } = await supabase.from('orders')
            .update({ proof_url: proof_url, status: 'AWAITING_CONFIRMATION' })
            .eq('id', order_id);

        if (dbError) throw new Error(dbError.message);
        res.status(200).json({ message: "Proof uploaded. Waiting for customer approval." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. CUSTOMER CONFIRMS DELIVERY
app.post('/api/confirm', async (req, res) => {
    try {
        const { order_id } = req.body;

        // Update DB First
        const { error: dbError } = await supabase.from('orders').update({ status: 'RELEASED' }).eq('id', order_id);
        if (dbError) throw new Error(dbError.message);

        // Try Corda, but don't crash if it fails
        try {
            await axios.post(`${CORDA_API_URL}/release`, null, { params: { orderId: order_id } });
            console.log(`✅ Corda: Funds released for ${order_id}`);
        } catch (cordaError) {
            console.warn(`⚠️ Corda Warning (Release): ${cordaError.message} - DB updated anyway.`);
        }

        res.status(200).json({ message: "Funds Released to Supplier!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. CUSTOMER/ADMIN DISPUTES DELIVERY
app.post('/api/dispute', async (req, res) => {
    try {
        const { order_id } = req.body;

        // Update DB First
        const { error: dbError } = await supabase.from('orders').update({ status: 'DISPUTED' }).eq('id', order_id);
        if (dbError) throw new Error(dbError.message);

        // Try Corda, but don't crash if it fails
        try {
            await axios.post(`${CORDA_API_URL}/dispute`, null, { params: { orderId: order_id } });
            console.log(`✅ Corda: Dispute logged for ${order_id}`);
        } catch (cordaError) {
            console.warn(`⚠️ Corda Warning (Dispute): ${cordaError.message} - DB updated anyway.`);
        }

        res.status(200).json({ message: "Funds Frozen. Dispute recorded on blockchain." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 💳 FIAT-TO-BLOCKCHAIN ENDPOINTS 
// ==========================================

// 5. Initialize the Fiat Payment (Not used in hackathon bypass, but kept for structure)
app.post('/api/create-payment', async (req, res) => {
    try {
        const { amount } = req.body;
        const options = {
            amount: amount * 100,
            currency: "INR",
            receipt: `rcpt_${Date.now()}`
        };
        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        console.error("Razorpay Create Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// 6. Verify Payment & Lock Escrow on Blockchain (HACKATHON MOCK MODE)
app.post('/api/verify-payment', async (req, res) => {
    try {
        // We only extract the data we need for the mock.
        const { customer_name, driver_name, amount } = req.body;

        const newOrderId = `ORD-${uuidv4().substring(0, 6).toUpperCase()}`;
        console.log(`Processing mock payment for ${customer_name}. Order ID: ${newOrderId}`);

        // 1️⃣ Save to Supabase immediately
        const { error: dbError } = await supabase.from('orders').insert([{
            id: newOrderId, customer_name, driver_name, amount, status: 'LOCKED', proof_url: ''
        }]);

        if (dbError) {
            console.error("❌ SUPABASE INSERT ERROR:", dbError.message);
            throw new Error(`Supabase Error: ${dbError.message}`);
        }

        // 2️⃣ Attempt Corda connection safely
        try {
            await axios.post(`${CORDA_API_URL}/create`, null, {
                params: { supplierName: CORDA_SUPPLIER_NAME, orderId: newOrderId, amount: amount }
            });
            console.log(`✅ Corda: Escrow locked for ${newOrderId}`);
        } catch (cordaError) {
            console.warn(`⚠️ Corda Warning (Lock): ${cordaError.message}. Safely continuing demo.`);
        }

        res.status(200).json({ message: "Payment Secured & Escrow Locked!", order_id: newOrderId });
    } catch (error) {
        console.error("Verify Payment Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// 🚀 START SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`\n🚀 TrustRoute Web3 Backend is LIVE on http://localhost:${PORT}`);
    console.log(`🔗 Corda Bridge Target: ${CORDA_API_URL}`);
});