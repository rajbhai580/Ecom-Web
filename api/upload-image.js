import fetch from 'node-fetch';
import FormData from 'form-data';

// This is your new Vercel Serverless Function.
// It acts as a secure proxy to the ImgBB API.

export default async function handler(req, res) {
    // 1. Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Get the secret API key from Vercel's environment variables
    const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
    if (!IMGBB_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: ImgBB API key is missing.' });
    }

    try {
        // 3. The front-end will send the image as a Base64 string in the request body.
        const { image: base64Image } = req.body;
        if (!base64Image) {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        // 4. Create a form to send to ImgBB's API.
        const form = new FormData();
        form.append('key', IMGBB_API_KEY);
        form.append('image', base64Image); // ImgBB API accepts Base64 strings directly.

        // 5. Make the secure, server-to-server request to ImgBB.
        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: form,
        });

        const result = await response.json();

        // 6. Check if ImgBB reported an error.
        if (!response.ok || !result.success) {
            console.error('ImgBB API Error:', result);
            return res.status(500).json({ error: 'Failed to upload image.', details: result.error.message });
        }

        // 7. Send the public image URL back to the front-end.
        return res.status(200).json({ url: result.data.url });

    } catch (error) {
        console.error('Error in upload-image function:', error);
        return res.status(500).json({ error: 'An unexpected error occurred.' });
    }
}
