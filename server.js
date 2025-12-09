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

// Ensure data logs exist securely (though for this tool, we might just log to a file)
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware to log IP and User-Agent for every request (replaces ip.php logic partly)
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

// Replaces webhook.php
app.post('/api/webhook', (req, res) => {
    const data = req.body;

    if (!data) {
        return res.status(400).json({ error: 'No data provided' });
    }

    // Basic validation: Ensure it's an object (express.json handles JSON parsing)
    // In a real scenario, we'd use a schema validator like Joi or Zod.

    const entry = {
        timestamp: new Date().toISOString(),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        userAgent: req.get('User-Agent'),
        data: data
    };

    // Append to data.json safely
    fs.readFile(DATA_FILE, 'utf8', (err, fileData) => {
        let json = [];
        if (!err && fileData) {
            try {
                json = JSON.parse(fileData);
            } catch (e) {
                console.error('Error parsing data.json, starting fresh');
            }
        }
        json.push(entry);

        fs.writeFile(DATA_FILE, JSON.stringify(json, null, 2), (writeErr) => {
            if (writeErr) {
                console.error('Error writing to data file:', writeErr);
                return res.status(500).json({ error: 'Internal Server Error' });
            }
            res.json({ status: 'success' });
        });
    });
});

// Replaces ip.php features - simplified endpoints if needed
app.get('/api/ip', (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    res.json({ ip });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
