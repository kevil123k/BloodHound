const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve build files from 'public' directory

// Session management
const SESSIONS_DIR = path.join(__dirname, 'sessions');
const SESSION_FILE_PATH = path.join(__dirname, '.current_session');

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Get or create current session file
function getCurrentSessionFile() {
    try {
        if (fs.existsSync(SESSION_FILE_PATH)) {
            return fs.readFileSync(SESSION_FILE_PATH, 'utf8').trim();
        }
    } catch (e) {
        console.error('Error reading current session file:', e);
    }

    // Create new session file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionFileName = `BloodHound-${timestamp}.json`;
    const sessionFilePath = path.join(SESSIONS_DIR, sessionFileName);

    // Initialize empty array
    fs.writeFileSync(sessionFilePath, '[]', 'utf8');

    // Save current session reference
    fs.writeFileSync(SESSION_FILE_PATH, sessionFileName, 'utf8');

    console.log(`Created new session: ${sessionFileName}`);
    return sessionFileName;
}

// Initialize session on startup
let currentSessionFile = getCurrentSessionFile();
console.log(`Current session: ${currentSessionFile}`);

// Middleware to log IP and User-Agent for every request
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.get('User-Agent');
    console.log(`[${new Date().toISOString()}] Request from ${ip} - ${userAgent}`);
    next();
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Replaces webhook.php - now writes to session files
app.post('/api/webhook', (req, res) => {
    const data = req.body;

    if (!data) {
        return res.status(400).json({ error: 'No data provided' });
    }

    const sessionFilePath = path.join(SESSIONS_DIR, currentSessionFile);

    const entry = {
        timestamp: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.get('User-Agent'),
        data: data
    };

    // Append to current session file
    fs.readFile(sessionFilePath, 'utf8', (err, fileData) => {
        let json = [];
        if (!err && fileData) {
            try {
                json = JSON.parse(fileData);
            } catch (e) {
                console.error('Error parsing session file, starting fresh');
            }
        }
        json.push(entry);

        fs.writeFile(sessionFilePath, JSON.stringify(json, null, 2), (writeErr) => {
            if (writeErr) {
                console.error('Error writing to session file:', writeErr);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            console.log(`[DATA] ${data.type} - saved to ${currentSessionFile}`);
            res.json({ status: 'success' });
        });
    });
});

// Get list of all session files
app.get('/api/sessions', (req, res) => {
    fs.readdir(SESSIONS_DIR, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Error reading sessions directory' });
        }

        const sessionFiles = files
            .filter(f => f.startsWith('BloodHound-') && f.endsWith('.json'))
            .map(filename => {
                const filepath = path.join(SESSIONS_DIR, filename);
                const stats = fs.statSync(filepath);
                return {
                    filename,
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    isCurrent: filename === currentSessionFile
                };
            })
            .sort((a, b) => b.created - a.created); // Newest first

        res.json(sessionFiles);
    });
});

// Get data from a specific session file
app.get('/api/session/:filename', (req, res) => {
    const filename = req.params.filename;

    // Security: ensure filename doesn't contain path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const sessionFilePath = path.join(SESSIONS_DIR, filename);

    fs.readFile(sessionFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).json({ error: 'Session not found' });
        }
        try {
            const json = JSON.parse(data);
            res.json(json);
        } catch (e) {
            res.status(500).json({ error: 'Error parsing session data' });
        }
    });
});

// Get current session data (for live view)
app.get('/api/live', (req, res) => {
    const sessionFilePath = path.join(SESSIONS_DIR, currentSessionFile);

    fs.readFile(sessionFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.json([]);
        }
        try {
            const json = JSON.parse(data);
            res.json(json);
        } catch (e) {
            res.status(500).json({ error: 'Error parsing session data' });
        }
    });
});

// Replaces ip.php features - simplified endpoints if needed
app.get('/api/ip', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.json({ ip });
});

// Create new session (for manual reset)
app.post('/api/sessions/new', (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sessionFileName = `BloodHound-${timestamp}.json`;
    const sessionFilePath = path.join(SESSIONS_DIR, sessionFileName);

    // Initialize empty array
    fs.writeFileSync(sessionFilePath, '[]', 'utf8');

    // Update current session reference
    currentSessionFile = sessionFileName;
    fs.writeFileSync(SESSION_FILE_PATH, sessionFileName, 'utf8');

    console.log(`Created new session: ${sessionFileName}`);
    res.json({ session: sessionFileName, message: 'New session created' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Session: ${currentSessionFile}`);
});
