# 🎮 ZipZop Pro Video Studio

AI-powered video editor with waste part detection, cinematic color grading, and relighting controls. Perfect for gaming content creators!

## ✨ Features

- 🤖 **AI Waste Detection**: Automatically detects and removes inactive/silent parts from videos
- 🎨 **Color Grading Presets**: GTA V, Cyberpunk, HDR, and Raw modes
- 💡 **Relighting Controls**: Adjust brightness, contrast, and saturation in real-time
- 📱 **Mobile PWA**: Works offline and installs like a native app
- ⚡ **Fast Processing**: FFmpeg-powered video trimming
- 🌐 **Cross-platform**: Works on desktop, tablet, and mobile browsers

## 🚀 Quick Start

### Local Development

```bash
# Clone the repository
git clone https://github.com/PARTH-CODE2012/zipzop-pro-studio.git
cd zipzop-pro-studio

# Install dependencies
npm install

# Make sure FFmpeg is installed
# Windows: choco install ffmpeg
# Mac: brew install ffmpeg
# Linux: sudo apt-get install ffmpeg

# Start the backend server
npm start

# Open in browser
# http://localhost:5000
```

### Deploy to Render (Backend)

1. Push code to GitHub
2. Go to https://render.com and sign up
3. Click "New +" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Deploy!
7. Copy the Render URL and update in `index.html`:
   ```javascript
   const BACKEND_URL = 'https://your-render-url.onrender.com';
   ```

### Deploy to Vercel (Frontend)

1. Go to https://vercel.com and sign up
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Deploy!
5. Your frontend will be live at `https://your-project.vercel.app`

## 📁 Project Structure

```
zipzop-pro-studio/
├── server.js          # Express backend with FFmpeg integration
├── index.html         # Frontend UI (single file)
├── package.json       # Dependencies and scripts
├── vercel.json        # Vercel deployment config
├── manifest.json      # PWA manifest
├── sw.js              # Service Worker for offline support
├── .gitignore         # Git ignore rules
└── README.md          # This file

# Auto-created directories:
uploads/              # Temporary video uploads
output/               # Processed videos
```

## 🔧 Configuration

### Update Backend URL

In `index.html`, find this line and update:

```javascript
const BACKEND_URL = 'https://your-render-backend.onrender.com';
```

## 📞 API Endpoints

### Health Check
```
GET /api/health
Response: { status: 'Backend running', timestamp: '...' }
```

### Trim Video (AI Processing)
```
POST /api/trim-waste
Content-Type: multipart/form-data
Body: { video: <video-file> }

Response: {
  success: true,
  message: 'AI ने बेकार हिस्से सफलतापूर्वक हटा दिए हैं!',
  downloadUrl: '/download/trimmed_filename.mp4'
}
```

### Download Processed Video
```
GET /download/:filename
Response: File stream (MP4)
```

## 🎬 Usage

1. **Upload Video**: Click "Choose File" to upload a gaming video
2. **AI Processing**: Click "🤖 Detect & Delete Waste Parts"
3. **Watch Progress**: See the progress bar as AI analyzes
4. **Download**: Once complete, click "📥 Download AI Processed Video"
5. **Color Grading**: Apply presets or manually adjust brightness/contrast/saturation
6. **Play**: Use the built-in player with live filter effects

## 📱 Mobile Installation

### iOS (iPhone/iPad)
1. Open in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Tap "Add"

### Android (Chrome)
1. Open in Chrome
2. Tap the menu (⋮)
3. Select "Install app"
4. Tap "Install"

## 🔐 Privacy

- Videos are processed on the server and deleted immediately after download
- No data is stored or transmitted to third parties
- All processing is done server-side

## 🛠️ Tech Stack

- **Backend**: Node.js + Express.js
- **Video Processing**: FFmpeg
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **PWA**: Service Worker + Web App Manifest
- **Deployment**: Render (Backend) + Vercel (Frontend)

## 📝 License

MIT License - Feel free to use and modify!

## 👨‍💻 Author

**PARTH-CODE2012**
- GitHub: [@PARTH-CODE2012](https://github.com/PARTH-CODE2012)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Issues

If you find any bugs, please create an issue on GitHub.

## 📚 Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Express.js Guide](https://expressjs.com/)
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Render Deployment](https://render.com/docs)
- [Vercel Deployment](https://vercel.com/docs)

---

**Made with ❤️ for gaming content creators**