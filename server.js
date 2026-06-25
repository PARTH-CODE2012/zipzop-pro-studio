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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.use(express.static('.')); // Serve static files

// सिस्टम टेम्प फोल्डर का उपयोग करें (Render/Vercel पर काम करता है)
const UPLOADS_DIR = path.join(os.tmpdir(), 'zipzop-uploads');
const OUTPUT_DIR = path.join(os.tmpdir(), 'zipzop-output');
const SUBTITLES_DIR = path.join(os.tmpdir(), 'zipzop-subtitles');

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

// समय को सेकंड में कन्वर्ट करें (HH:MM:SS.SSS फॉर्मेट से)
function timeToSeconds(timeStr) {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
}

// कस्टम ट्रिमिंग एंडपॉइंट (बिना कोई 3-सेकंड की सीमा के)
app.post('/api/trim-waste', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'कृपया एक वीडियो फ़ाइल अपलोड करें।' });
    }

    const inputPath = req.file.path;
    const startTime = req.body.startTime || '00:00:00';  // शुरुआत का समय
    const duration = req.body.duration ? parseInt(req.body.duration) : null;  // अवधि (सेकंड में)
    const outputFilename = 'trimmed_' + Date.now() + '.mp4';
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    console.log('Processing video:', inputPath);
    console.log('Start time:', startTime);
    console.log('Duration:', duration);
    console.log('Output path:', outputPath);

    let ffmpegCmd = ffmpeg(inputPath)
        .setStartTime(startTime);

    // अगर duration दिया गया है, तो उसे लागू करें
    if (duration && duration > 0) {
        ffmpegCmd = ffmpegCmd.duration(duration);
    }

    ffmpegCmd
        .output(outputPath)
        .on('start', () => {
            console.log('FFmpeg started processing trim...');
        })
        .on('end', () => {
            console.log('FFmpeg processing completed');
            // पुरानी अपलोड की गई फ़ाइल को डिलीट करना
            try {
                if (fs.existsSync(inputPath)) {
                    fs.unlinkSync(inputPath);
                }
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
            res.status(500).json({ error: 'वीडियो प्रोसेसिंग में एरर आया: ' + err.message });
        })
        .run();
});

// Captions के साथ वीडियो प्रोसेस करने के लिए एंडपॉइंट
app.post('/api/add-captions', upload.single('video'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'कृपया एक वीडियो फ़ाइल अपलोड करें।' });
    }

    const inputPath = req.file.path;
    const captions = JSON.parse(req.body.captions || '[]');
    const captionStyle = req.body.captionStyle || 'classic';
    const outputFilename = 'captioned_' + Date.now() + '.mp4';
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    console.log('Adding captions to video:', inputPath);
    console.log('Caption style:', captionStyle);
    console.log('Number of captions:', captions.length);

    if (captions.length === 0) {
        return res.status(400).json({ error: 'कृपया कम से कम एक कैप्शन जोड़ें।' });
    }

    // Caption text फाइलें बनाएं
    captions.forEach((caption, index) => {
        const captionFile = path.join(SUBTITLES_DIR, `caption_${index}.txt`);
        fs.writeFileSync(captionFile, caption.text);
    });

    const style = captionStyles[captionStyle] || captionStyles.classic;
    const fontfile = style.fontfile || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
    const fontsize = style.fontsize;
    const borderw = style.borderw;
    const color = style.color;
    const bordercolor = style.bordercolor;

    // सभी drawtext filters बनाएं
    let filterComplex = '[0:v]';
    captions.forEach((caption, index) => {
        const startSecs = timeToSeconds(caption.startTime);
        const endSecs = timeToSeconds(caption.endTime);
        
        filterComplex += `drawtext=textfile='${path.join(SUBTITLES_DIR, `caption_${index}.txt`)}':x=(w-text_w)/2:y=h-80:fontfile='${fontfile}':fontsize=${fontsize}:fontcolor=${color}:bordercolor=${bordercolor}:borderw=${borderw}:enable='between(t\,${startSecs}\,${endSecs})'`;
        
        if (index < captions.length - 1) {
            filterComplex += ',';
        }
    });
    filterComplex += '[out]';

    console.log('Filter complex created with', captions.length, 'captions');

    ffmpeg(inputPath)
        .complexFilter(filterComplex, 'out')
        .output(outputPath)
        .outputOptions(['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-c:a', 'aac'])
        .on('start', () => {
            console.log('FFmpeg caption processing started...');
        })
        .on('end', () => {
            console.log('Caption processing completed');
            
            // Cleanup caption files
            captions.forEach((_, index) => {
                try {
                    const captionFile = path.join(SUBTITLES_DIR, `caption_${index}.txt`);
                    if (fs.existsSync(captionFile)) {
                        fs.unlinkSync(captionFile);
                    }
                } catch (err) {
                    console.warn('Could not delete caption file:', err.message);
                }
            });

            // Delete input file
            try {
                if (fs.existsSync(inputPath)) {
                    fs.unlinkSync(inputPath);
                }
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
            
            // Cleanup
            try {
                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            } catch (e) {
                console.warn('Could not cleanup:', e.message);
            }
            
            res.status(500).json({ error: 'कैप्शन प्रोसेसिंग में एरर: ' + err.message });
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
    console.log(`📁 Subtitles dir: ${SUBTITLES_DIR}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});