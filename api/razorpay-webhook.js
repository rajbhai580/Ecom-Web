import admin from 'firebase-admin';
import crypto from 'crypto';

// --- Secure Initialization of Firebase Admin ---
try {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (error) {
  console.error('CRITICAL: Firebase Admin initialization failed.', error);
}

const db = admin.firestore();
const RAZORPAY_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

// Helper function to read the raw body from the request
const getRawBody = (req) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', err => reject(err));
    });
};

// Disable Vercel's default body parser to access the raw body
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
  console.log("--- Webhook Invoked ---");

  if (!RAZORPAY_SECRET) {
      console.error("FATAL: RAZORPAY_WEBHOOK_SECRET is not set.");
      return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['x-razorpay-signature'];
    
    // --- NEW, MORE RELIABLE VALIDATION METHOD ---
    const shasum = crypto.createHmac('sha256', RAZORPAY_SECRET);
    shasum.update(rawBody); // We use the raw body buffer directly
    const digest = shasum.digest('hex');

    if (digest !== signature) {
      console.error('--- SIGNATURE MISMATCH --- The secret in Vercel does not match Razorpay.');
      return res.status(403).json({ error: 'Invalid signature.' });
    }
    console.log("--- Signature Verified Successfully ---");

    // Now that we've verified the raw body, we can safely parse it as JSON
    const body = JSON.parse(rawBody.toString());
    const event = body;
    console.log("Event Type:", event.event);

    if (event.event === 'payment.captured') {
        const paymentInfo = event.payload.payment.entity;
        const razorpayPhone = paymentInfo.contact || '';
        const customerPhone = razorpayPhone.replace(/\D/g, '').slice(-10);
        const amountPaid = paymentInfo.amount / 100;

        console.log(`Payment captured. Searching for pending order for phone: ${customerPhone} and amount: ${amountPaid}`);

        if (!customerPhone) {
            console.warn("Webhook received for payment with no contact number. Cannot find order.");
            return res.status(200).json({ status: 'ignored_no_contact' });
        }

        const ordersRef = db.collection('orders');
        const q = ordersRef
            .where('customerPhone', '==', customerPhone)
            .where('amount', '==', amountPaid)
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .limit(1);

        const querySnapshot = await q.get();

        if (querySnapshot.empty) {
            console.warn(`--- Webhook search complete. No matching PENDING order was found. ---`);
            return res.status(200).json({ status: 'no_matching_pending_order' });
        }

        const orderDoc = querySnapshot.docs[0];
        await orderDoc.ref.update({
            status: 'paid',
            paymentId: paymentInfo.id,
            paymentDetails: paymentInfo,
        });
        
        console.log(`--- SUCCESS! Updated order ${orderDoc.id} to 'paid'. ---`);
    } else {
        console.log(`Webhook received for event '${event.event}', which is not 'payment.captured'. Ignoring.`);
    }

    res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('--- FATAL ERROR in Webhook Handler ---', error);
    res.status(500).json({ error: 'An internal error occurred.' });
  }
}
