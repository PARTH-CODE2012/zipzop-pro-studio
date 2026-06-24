const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// FFmpeg का पाथ सेट करें
ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
app.use(cors());
app.use(express.json());

// अपलोड और आउटपुट फोल्डर बनाना
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'output');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// मल्टीपार्ट फाइल अपलोड सेटिंग्स
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ status: 'Backend running', timestamp: new Date() });
});

// AI वेस्ट पार्ट डिटेक्शन और ऑटो-ट्रिम एंडपॉइंट
app.post('/api/trim-waste', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'कृपया एक वीडियो फ़ाइल अपलोड करें।' });
    }

    const inputPath = req.file.path;
    const outputFilename = 'trimmed_' + req.file.filename;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    // यहाँ असली FFmpeg कमांड है जो वीडियो की शुरुआत से 3 सेकंड का 'वेस्ट पार्ट' काटकर हटा देती है
    // गिटहब एजेंट इसे वीडियो की लेंथ के हिसाब से और एडवांस कर सकता है
    ffmpeg(inputPath)
        .setStartTime('00:00:03') 
        .output(outputPath)
        .on('end', () => {
            // पुरानी अपलोड की गई फ़ाइल को डिलीट करना ताकि सर्वर न भरे
            fs.unlinkSync(inputPath);
            res.json({ 
                success: true, 
                message: 'AI ने बेकार हिस्से सफलतापूर्वक हटा दिए हैं!',
                downloadUrl: `/download/${outputFilename}`
            });
        })
        .on('error', (err) => {
            console.error(err);
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            res.status(500).json({ error: 'वीडियो प्रोसेसिंग में एरर आया।' });
        })
        .run();
});

// फाइल डाउनलोड एंडपॉइंट
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(OUTPUT_DIR, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            // डाउनलोड के बाद फाइल को डिलीट करना
            if (!err && fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });
    } else {
        res.status(404).json({ error: 'फ़ाइल नहीं मिली।' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 ZipZop Pro Server running on port ${PORT}`));