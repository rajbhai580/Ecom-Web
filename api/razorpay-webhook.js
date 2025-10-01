// This code runs on Vercel's servers, not in the browser.
import admin from 'firebase-admin';
import crypto from 'crypto';

// --- Firebase Admin SDK Initialization ---
// You need to get your service account credentials from Firebase
// Project Settings -> Service Accounts -> Generate new private key
// Then, store this JSON in a Vercel Environment Variable.
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Get the webhook secret from Vercel Environment Variables
const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// The main function that Vercel will run
export default async function handler(req, res) {
  // 1. Check that the request is a POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const signature = req.headers['x-razorpay-signature'];
  const body = req.body;

  // 2. IMPORTANT: Verify the signature
  try {
    const shasum = crypto.createHmac('sha256', RAZORPAY_SECRET);
    // Vercel automatically parses the body, so we need to stringify it again for the check
    shasum.update(JSON.stringify(body));
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      console.error('Signature mismatch. Request is not from Razorpay.');
      return res.status(403).json({ error: 'Invalid signature' });
    }
  } catch (error) {
    console.error('Error during signature validation:', error);
    return res.status(500).json({ error: 'Internal Server Error during validation' });
  }

  // 3. Signature is valid. Process the event.
  const event = body;

  if (event.event === 'payment.captured') {
    const paymentInfo = event.payload.payment.entity;
    const customerEmail = paymentInfo.email;
    const amountPaid = paymentInfo.amount / 100;

    console.log(`Payment successful by ${customerEmail} for ₹${amountPaid}.`);

    try {
      //
      // YOUR CORE LOGIC GOES HERE
      //
      // For example, if you were using an order system, you would find the
      // order using an ID from `paymentInfo.notes` and update its status.
      //
      // const orderId = paymentInfo.notes.order_id;
      // if(orderId) {
      //   const orderRef = db.collection('orders').doc(orderId);
      //   await orderRef.update({ status: 'Paid', paymentId: paymentInfo.id });
      //   console.log(`Updated order ${orderId} to 'Paid'`);
      // }

    } catch (error) {
      console.error('Error updating database:', error);
      // Let Razorpay know we received it, but log the error for yourself.
    }
  }

  // 4. Acknowledge the event was received successfully
  res.status(200).json({ status: 'ok' });
}
