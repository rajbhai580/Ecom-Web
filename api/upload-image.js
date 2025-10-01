import { formidable } from 'formidable';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

// Vercel's default config for parsing the body doesn't handle files, so we disable it.
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
    if (!IMGBB_API_KEY) {
        console.error("Server configuration error: IMGBB_API_KEY is not set in Vercel.");
        return res.status(500).json({ error: 'Server configuration error: ImgBB API key is missing.' });
    }

    try {
        const form = formidable({});
        
        // This is an async operation that needs to be awaited
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve([fields, files]);
            });
        });
        
        const imageFile = files.image?.[0];

        if (!imageFile) {
            return res.status(400).json({ error: 'No image file provided in the request.' });
        }

        // We have the file, now let's prepare to send it to ImgBB
        const imgbbFormData = new FormData();
        imgbbFormData.append('key', IMGBB_API_KEY);
        imgbbFormData.append('image', fs.createReadStream(imageFile.filepath));

        const response = await fetch('https://api.imgbb.com/1/upload', {
            method: 'POST',
            body: imgbbFormData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            console.error('ImgBB API Error Response:', result);
            throw new Error(result.error?.message || `ImgBB API responded with status: ${response.status}`);
        }
        
        // Send the URL back to the admin panel
        console.log("Successfully uploaded image. URL:", result.data.url);
        res.status(200).json({ success: true, url: result.data.url });

    } catch (error) {
        console.error('Upload handler error:', error);
        res.status(500).json({ success: false, error: 'An internal error occurred while uploading the image.' });
    }
}
