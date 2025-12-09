# 🩸 BloodHound

**Advanced Location Tracking & Device Intelligence Platform**

BloodHound is a sophisticated penetration testing tool designed for information gathering and geolocation tracking. Built on Node.js with a modern web interface, it captures precise GPS coordinates, device fingerprints, and network intelligence from target devices.

---

## ⚡ Key Features

- **High-Accuracy GPS Tracking** - Captures exact latitude/longitude coordinates
- **Device Fingerprinting** - Collects OS, browser, screen resolution, and hardware details
- **IP Geolocation** - Fallback location tracking via IP when GPS is unavailable
- **Real-Time Dashboard** -UI with live data visualization
- **Secure Data Storage** - JSON-based logging with timestamp and session tracking
- **HTTPS Deployment** - Automatic Cloudflare Tunnel integration for secure public access

---

## 🛠 Technology Stack

- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript (HTML5 Geolocation API, Fetch API)
- **Deployment**: Cloudflare Tunnel (automatic HTTPS)
- **Template System**: Customizable HTML/CSS templates

---

## 📦 Installation

### Prerequisites
```bash
# Debian/Ubuntu/Kali
sudo apt-get install -y nodejs npm git wget

# Verify installation
node --version
npm --version
```

### Setup
```bash
git clone <repository-url>
cd hound-main
bash bloodhound.sh
```

The script will:
1. Install Node.js dependencies automatically
2. Start the tracking server (port 3333/8080)
3. Launch the admin dashboard (port 8081)
4. Generate a public Cloudflare tunnel link

---

## 🚀 Usage

### Running BloodHound
```bash
bash bloodhound.sh
```

**Options:**
- **Y** (Default): Use Cloudflare Tunnel for public HTTPS link
- **N**: Run on localhost:8080 for local testing

### Accessing the Dashboard
Open `http://localhost:8081` in your browser to view captured data in real-time.

### Customizing Templates
Edit files in `template/` directory:
- `template/index.html` - Main page structure
- `template/style.css` - Custom styling
- `template/script.js` - UI interactions

Templates are automatically rebuilt on each run.

---

## 📊 Data Captured

| Category | Details |
|----------|---------|
| **Location** | Latitude, Longitude, Accuracy (meters) |
| **Network** | IP Address, ISP, City, Country |
| **Device** | Platform, OS, Screen Resolution, CPU Cores |
| **Browser** | User-Agent, Language, Cookies Status |

---

## ⚠️ Legal Disclaimer

**BloodHound is intended for authorized penetration testing and security research only.**

- Only use on systems you own or have explicit permission to test
- Unauthorized tracking is illegal in most jurisdictions
- The authors are not responsible for misuse or illegal activities
- Always comply with local laws and regulations

---

## 👨‍💻 Author

**Kevil Ravat**

---

## 📝 License

This project is provided for educational and authorized security testing purposes. See LICENSE file for details.

---

## 🔄 Version

**BloodHound v3.0** - Advanced Tracking System
