// This function will safely check and report the status of your environment variables.
export default async function handler(req, res) {
    
    // Read the secret variables from the Vercel environment.
    const razorpaySecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const firebaseKey = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    // Send a JSON response with the status of each variable.
    res.status(200).json({
        message: "Vercel Environment Variable Debug Information",
        
        RAZORPAY_WEBHOOK_SECRET_EXISTS: !!razorpaySecret,
        RAZORPAY_WEBHOOK_SECRET_IS_STRING: typeof razorpaySecret === 'string',
        RAZORPAY_WEBHOOK_SECRET_LENGTH: razorpaySecret ? razorpaySecret.length : 0,
        
        FIREBASE_SERVICE_ACCOUNT_JSON_EXISTS: !!firebaseKey,
        FIREBASE_SERVICE_ACCOUNT_JSON_IS_STRING: typeof firebaseKey === 'string',
        FIREBASE_SERVICE_ACCOUNT_JSON_LENGTH: firebaseKey ? firebaseKey.length : 0
    });
}
