const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const { v4: uuidv4 } = require('uuid');

// FFmpeg का पाथ सेट करें
ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(express.static('.')); // Serve static files

// In-memory user database (Replace with real DB in production)
const users = new Map();
const paymentRequests = new Map();

// सिस्टम टेम्प फोल्डर का उपयोग करें (Render/Vercel पर काम करता है)
const UPLOADS_DIR = path.join(os.tmpdir(), 'zipzop-uploads');
const OUTPUT_DIR = path.join(os.tmpdir(), 'zipzop-output');
const SUBTITLES_DIR = path.join(os.tmpdir(), 'zipzop-subtitles');
const PAYMENT_DIR = path.join(os.tmpdir(), 'zipzop-payments');

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
ensureDirExists(SUBTITLES_DIR);
ensureDirExists(PAYMENT_DIR);

// प्रीमियम लिमिट्स
const LIMITS = {
    free: {
        maxVideoSize: 100 * 1024 * 1024,  // 100MB
        maxDuration: 300,  // 5 minutes
        maxCaptions: 5,
        maxTrimsPerDay: 10
    },
    premium: {
        maxVideoSize: 500 * 1024 * 1024,  // 500MB
        maxDuration: null,  // unlimited
        maxCaptions: null,  // unlimited
        maxTrimsPerDay: null  // unlimited
    }
};

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
const paymentUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            ensureDirExists(PAYMENT_DIR);
            cb(null, PAYMENT_DIR);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + '_' + uuidv4() + path.extname(file.originalname));
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB for screenshots
});

// Caption Styles डेटा
const captionStyles = {
    neon: {
        color: '0x00FF00@1',  // Bright green
        bordercolor: '0xFF00FF@1',  // Magenta
        borderw: 3,
        fontsize: 32,
        fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    },
    boldyellow: {
        color: '0xFFFF00@1',  // Yellow
        bordercolor: '0x000000@1',  // Black
        borderw: 2,
        fontsize: 40,
        fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    },
    whiteborder: {
        color: '0xFFFFFF@1',  // White
        bordercolor: '0x000000@1',  // Black
        borderw: 3,
        fontsize: 36,
        fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    },
    classic: {
        color: '0xFFFFFF@1',  // White
        bordercolor: '0x000000@1',  // Black
        borderw: 1,
        fontsize: 28,
        fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    },
    cyberpunk: {
        color: '0xFF00FF@1',  // Magenta
        bordercolor: '0x00FFFF@1',  // Cyan
        borderw: 2,
        fontsize: 35,
        fontfile: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
    }
};

// ===================== AUTHENTICATION APIs =====================

// Signup
app.post('/api/auth/signup', (req, res) => {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
        return res.status(400).json({ error: 'कृपया सभी फील्ड भरें।' });
    }

    if (users.has(email)) {
        return res.status(400).json({ error: 'यह email पहले से registered है।' });
    }

    const userId = uuidv4();
    users.set(email, {
        userId,
        email,
        password, // In production, use bcrypt!
        username,
        isPremium: false,
        premiumExpiry: null,
        createdAt: new Date(),
        trims: 0,
        trimsLastReset: new Date()
    });

    res.json({
        success: true,
        message: 'Signup successful! अब login करें।',
        userId,
        email
    });
});

// Login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email और Password दोनों जरूरी हैं।' });
    }

    const user = users.get(email);
    if (!user || user.password !== password) {
        return res.status(401).json({ error: 'Email या Password गलत है।' });
    }

    res.json({
        success: true,
        message: 'Login successful!',
        userId: user.userId,
        email: user.email,
        username: user.username,
        isPremium: user.isPremium,
        premiumExpiry: user.premiumExpiry
    });
});

// Get user profile
app.get('/api/auth/profile/:userId', (req, res) => {
    const { userId } = req.params;
    let user = null;

    for (let [, userData] of users) {
        if (userData.userId === userId) {
            user = userData;
            break;
        }
    }

    if (!user) {
        return res.status(404).json({ error: 'User नहीं मिला।' });
    }

    res.json({
        success: true,
        profile: {
            userId: user.userId,
            email: user.email,
            username: user.username,
            isPremium: user.isPremium,
            premiumExpiry: user.premiumExpiry,
            trims: user.trims,
            createdAt: user.createdAt
        }
    });
});

// ===================== PREMIUM & PAYMENT APIs =====================

// Get user limits
app.get('/api/limits/:userId', (req, res) => {
    const { userId } = req.params;
    let user = null;

    for (let [, userData] of users) {
        if (userData.userId === userId) {
            user = userData;
            break;
        }
    }

    if (!user) {
        return res.status(404).json({ error: 'User नहीं मिला।' });
    }

    const limits = user.isPremium ? LIMITS.premium : LIMITS.free;

    res.json({
        success: true,
        isPremium: user.isPremium,
        limits: limits,
        used: {
            trims: user.trims
        }
    });
});

// Create payment request
app.post('/api/payment/create', (req, res) => {
    const { userId, amount, utrNumber } = req.body;

    if (!userId || !amount || !utrNumber) {
        return res.status(400).json({ error: 'सभी फील्ड भरें।' });
    }

    let user = null;
    for (let [, userData] of users) {
        if (userData.userId === userId) {
            user = userData;
            break;
        }
    }

    if (!user) {
        return res.status(404).json({ error: 'User नहीं मिला।' });
    }

    const paymentId = uuidv4();
    paymentRequests.set(paymentId, {
        paymentId,
        userId,
        email: user.email,
        amount,
        utrNumber,
        status: 'pending',  // pending, verified, rejected
        screenshot: null,
        createdAt: new Date(),
        verifiedAt: null
    });

    res.json({
        success: true,
        message: 'Payment request created! कृपया रसीद अपलोड करें।',
        paymentId
    });
});

// Upload payment screenshot
app.post('/api/payment/upload-screenshot/:paymentId', paymentUpload.single('screenshot'), (req, res) => {
    const { paymentId } = req.params;

    if (!req.file) {
        return res.status(400).json({ error: 'कृपया screenshot अपलोड करें।' });
    }

    const payment = paymentRequests.get(paymentId);
    if (!payment) {
        return res.status(404).json({ error: 'Payment request नहीं मिली।' });
    }

    payment.screenshot = req.file.filename;
    payment.status = 'verified';  // Auto-verify for demo

    // Mark user as premium
    let user = null;
    for (let [, userData] of users) {
        if (userData.userId === payment.userId) {
            user = userData;
            break;
        }
    }

    if (user) {
        user.isPremium = true;
        user.premiumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        payment.verifiedAt = new Date();
    }

    res.json({
        success: true,
        message: 'Payment verified! 🎉 आप अब Premium user हैं!',
        isPremium: true,
        premiumExpiry: user.premiumExpiry
    });
});

// Get payment status
app.get('/api/payment/status/:paymentId', (req, res) => {
    const { paymentId } = req.params;
    const payment = paymentRequests.get(paymentId);

    if (!payment) {
        return res.status(404).json({ error: 'Payment नहीं मिली।' });
    }

    res.json({
        success: true,
        payment: {
            paymentId: payment.paymentId,
            status: payment.status,
            amount: payment.amount,
            createdAt: payment.createdAt,
            verifiedAt: payment.verifiedAt
        }
    });
});

// ===================== VIDEO PROCESSING APIs =====================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'Backend running', 
        timestamp: new Date(),
        uploadDir: UPLOADS_DIR,
        outputDir: OUTPUT_DIR
    });
});

// Get available caption styles
app.get('/api/caption-styles', (req, res) => {
    res.json({ 
        styles: Object.keys(captionStyles),
        descriptions: {
            neon: 'Bright Green with Magenta Border',
            boldyellow: 'Bold Yellow with Black Border',
            whiteborder: 'White with Thick Black Border',
            classic: 'Classic White with Black Border',
            cyberpunk: 'Magenta with Cyan Border'
        }
    });
});

// समय को सेकंड में कन्वर्ट करें
function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
}

// Trim video
app.post('/api/trim-waste', upload.single('video'), (req, res) => {
    const { userId, startTime = '00:00:00', duration = null } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: 'कृपया एक वीडियो फ़ाइल अपलोड करें।' });
    }

    // Check limits
    let user = null;
    for (let [, userData] of users) {
        if (userData.userId === userId) {
            user = userData;
            break;
        }
    }

    if (user) {
        const limits = user.isPremium ? LIMITS.premium : LIMITS.free;
        if (limits.maxDuration && duration > limits.maxDuration) {
            return res.status(403).json({ 
                error: `आपकी limit है ${limits.maxDuration} seconds। Premium upgrade करें!`,
                isPremium: false
            });
        }
        user.trims++;
    }

    const inputPath = req.file.path;
    const outputFilename = 'trimmed_' + Date.now() + '.mp4';
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    console.log('Processing video:', inputPath);
    console.log('Start time:', startTime);
    console.log('Duration:', duration);

    let ffmpegCmd = ffmpeg(inputPath).setStartTime(startTime);
    if (duration && duration > 0) {
        ffmpegCmd = ffmpegCmd.duration(duration);
    }

    ffmpegCmd
        .output(outputPath)
        .on('start', () => console.log('FFmpeg started processing trim...'))
        .on('end', () => {
            console.log('FFmpeg processing completed');
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            } catch (err) {
                console.warn('Could not delete input file:', err.message);
            }
            res.json({ 
                success: true, 
                message: 'वीडियो सफलतापूर्वक ट्रिम कर दिया गया है!',
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
            res.status(500).json({ error: 'वीडियो प्रोसेसिंग में एरर: ' + err.message });
        })
        .run();
});

// Add captions
app.post('/api/add-captions', upload.single('video'), (req, res) => {
    const { userId, captions = '[]', captionStyle = 'classic' } = req.body;

    if (!req.file) {
        return res.status(400).json({ error: 'कृपया एक वीडियो फ़ाइल अपलोड करें।' });
    }

    const parsedCaptions = JSON.parse(captions);
    const inputPath = req.file.path;
    const outputFilename = 'captioned_' + Date.now() + '.mp4';
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    console.log('Adding captions to video:', inputPath);
    console.log('Caption style:', captionStyle);
    console.log('Number of captions:', parsedCaptions.length);

    if (parsedCaptions.length === 0) {
        return res.status(400).json({ error: 'कृपया कम से कम एक कैप्शन जोड़ें।' });
    }

    parsedCaptions.forEach((caption, index) => {
        const captionFile = path.join(SUBTITLES_DIR, `caption_${index}.txt`);
        fs.writeFileSync(captionFile, caption.text);
    });

    const style = captionStyles[captionStyle] || captionStyles.classic;
    const fontfile = style.fontfile || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
    const fontsize = style.fontsize;
    const borderw = style.borderw;
    const color = style.color;
    const bordercolor = style.bordercolor;

    let filterComplex = '[0:v]';
    parsedCaptions.forEach((caption, index) => {
        const startSecs = timeToSeconds(caption.startTime);
        const endSecs = timeToSeconds(caption.endTime);
        filterComplex += `drawtext=textfile='${path.join(SUBTITLES_DIR, `caption_${index}.txt`)}':x=(w-text_w)/2:y=h-80:fontfile='${fontfile}':fontsize=${fontsize}:fontcolor=${color}:bordercolor=${bordercolor}:borderw=${borderw}:enable='between(t\,${startSecs}\,${endSecs})'`;
        if (index < parsedCaptions.length - 1) filterComplex += ',';
    });
    filterComplex += '[out]';

    ffmpeg(inputPath)
        .complexFilter(filterComplex, 'out')
        .output(outputPath)
        .outputOptions(['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac'])
        .on('start', () => console.log('FFmpeg caption processing started...'))
        .on('end', () => {
            console.log('Caption processing completed');
            parsedCaptions.forEach((_, index) => {
                try {
                    const captionFile = path.join(SUBTITLES_DIR, `caption_${index}.txt`);
                    if (fs.existsSync(captionFile)) fs.unlinkSync(captionFile);
                } catch (err) {
                    console.warn('Could not delete caption file:', err.message);
                }
            });
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            } catch (err) {
                console.warn('Could not delete input file:', err.message);
            }
            res.json({ 
                success: true, 
                message: 'कैप्शन सफलतापूर्वक जोड़ दिए गए हैं!',
                downloadUrl: `/download/${outputFilename}`
            });
        })
        .on('error', (err) => {
            console.error('FFmpeg caption error:', err);
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            } catch (e) {
                console.warn('Could not cleanup:', e.message);
            }
            res.status(500).json({ error: 'कैप्शन प्रोसेसिंग में एरर: ' + err.message });
        })
        .run();
});

// Download file
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(OUTPUT_DIR, req.params.filename);
    if (!filePath.startsWith(OUTPUT_DIR)) {
        return res.status(403).json({ error: 'अनुमति नह��ं है।' });
    }
    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (err) {
                console.error('Download error:', err);
            } else {
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                    console.log('Deleted processed file:', filePath);
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
    console.log(`👥 Auth system: Ready`);
    console.log(`💳 Premium system: Ready`);
    console.log(`🎬 Video processing: Ready`);
});
