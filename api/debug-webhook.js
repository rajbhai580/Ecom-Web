// This is a temporary debug file. Its only purpose is to log what Razorpay sends.

// Disable Vercel's default body parser to get the raw body
export const config = {
    api: {
        bodyParser: false,
    },
};

// Helper function to read the raw body from the request
const getRawBody = (req) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString()));
        req.on('error', err => reject(err));
    });
};

export default async function handler(req, res) {
  console.log("--- DEBUG WEBHOOK INVOKED ---");

  try {
    // Log everything we can
    console.log("METHOD:", req.method);
    console.log("HEADERS:", JSON.stringify(req.headers, null, 2));

    // Get the raw text body of the request
    const rawBody = await getRawBody(req);
    console.log("RAW BODY:", rawBody);

    // Try to parse it as JSON to see if it's valid
    try {
        const jsonBody = JSON.parse(rawBody);
        console.log("PARSED JSON BODY:", JSON.stringify(jsonBody, null, 2));
    } catch (e) {
        console.error("ERROR: The received body was NOT valid JSON.", e.message);
    }
    
    // Always send a success response so Razorpay doesn't retry
    res.status(200).json({ status: 'debug log captured' });

  } catch (error) {
    console.error("--- FATAL ERROR in DEBUG Webhook Handler ---", error);
    res.status(500).json({ error: 'An internal error occurred during logging.' });
  }
}
