const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 8081;

app.use(cors());
app.use(express.static('dashboard')); // Serve static files from 'dashboard' directory

// Data file path - same as main server
const DATA_FILE = path.join(__dirname, 'data.json');

// API to get logs
app.get('/api/logs', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            // If file doesn't exist yet, return empty array
            return res.json([]);
        }
        try {
            const json = JSON.parse(data);
            // Reverse to show newest first
            res.json(json.reverse());
        } catch (e) {
            res.status(500).json({ error: 'Error parsing data' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Dashboard running on http://localhost:${PORT}`);
});
