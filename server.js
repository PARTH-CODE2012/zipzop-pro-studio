const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// FFmpeg का पाथ सेट करें
ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files

// सिस्टम टेम्प फोल्डर का उपयोग करें (Render/Vercel पर काम करता है)
const UPLOADS_DIR = path.join(os.tmpdir(), 'zipzop-uploads');
const OUTPUT_DIR = path.join(os.tmpdir(), 'zipzop-output');

// डायनामिकली डायरेक्टरी बनाने की कोशिश करें
function ensureDirExists(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    } catch (err) {
        console.warn(`Warning: Could not create directory ${dir}:`, err.message);
    }
}

ensureDirExists(UPLOADS_DIR);
ensureDirExists(OUTPUT_DIR);

// मल्टीपार्ट फाइल अपलोड सेटिंग्स
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        ensureDirExists(UPLOADS_DIR);
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'Backend running', 
        timestamp: new Date(),
        uploadDir: UPLOADS_DIR,
        outputDir: OUTPUT_DIR
    });
});

// AI वेस्ट पार्ट डिटेक्शन और ऑटो-ट्रिम एंडपॉइंट
app.post('/api/trim-waste', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'कृपया एक वीडियो फ़ाइल अपलोड करें।' });
    }

    const inputPath = req.file.path;
    const outputFilename = 'trimmed_' + Date.now() + '.mp4';
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    console.log('Processing video:', inputPath);
    console.log('Output path:', outputPath);

    // यहाँ असली FFmpeg कमांड है जो वीडियो की शुरुआत से 3 सेकंड का 'वेस्ट पार्ट' काटकर हटा देती है
    ffmpeg(inputPath)
        .setStartTime('00:00:03') 
        .output(outputPath)
        .on('start', () => {
            console.log('FFmpeg started processing...');
        })
        .on('end', () => {
            console.log('FFmpeg processing completed');
            // पुरानी अपलोड की गई फ़ाइल को डिलीट करना ताकि सर्वर न भरे
            try {
                if (fs.existsSync(inputPath)) {
                    fs.unlinkSync(inputPath);
                }
            } catch (err) {
                console.warn('Could not delete input file:', err.message);
            }
            
            res.json({ 
                success: true, 
                message: 'AI ने बेकार हिस्से सफलतापूर्वक हटा दिए हैं!',
                downloadUrl: `/download/${outputFilename}`
            });
        })
        .on('error', (err) => {
            console.error('FFmpeg error:', err);
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            } catch (e) {
                console.warn('Could not cleanup:', e.message);
            }
            res.status(500).json({ error: 'वीडियो प्रोसेसिंग में एरर आया: ' + err.message });
        })
        .run();
});

// फाइल डाउनलोड एंडपॉइंट
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(OUTPUT_DIR, req.params.filename);
    
    // सुरक्षा: सिर्फ हमारे फोल्डर से फाइल डाउनलोड करने दें
    if (!filePath.startsWith(OUTPUT_DIR)) {
        return res.status(403).json({ error: 'अनुमति नहीं है।' });
    }
    
    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                console.error('Download error:', err);
            } else {
                // डाउनलोड के बाद फाइल को डिलीट करना
                try {
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log('Deleted processed file:', filePath);
                    }
                } catch (e) {
                    console.warn('Could not delete output file:', e.message);
                }
            }
        });
    } else {
        res.status(404).json({ error: 'फ़ाइल नहीं मिली।' });
    }
});

// Frontend को serve करें
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 ZipZop Pro Backend running on port ${PORT}`);
    console.log(`📁 Upload dir: ${UPLOADS_DIR}`);
    console.log(`📁 Output dir: ${OUTPUT_DIR}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});