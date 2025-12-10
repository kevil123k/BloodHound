const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 8081;

// Detect which port the main server is running on
function detectMainServerPort() {
    try {
        if (fs.existsSync('.server_port')) {
            const port = fs.readFileSync('.server_port', 'utf8').trim();
            console.log(`Main server port detected: ${port}`);
            return port;
        }
    } catch (e) {
        console.error('Error reading .server_port:', e.message);
    }

    console.log('Main server port not detected, defaulting to 3333');
    return '3333';
}

const MAIN_SERVER_PORT = detectMainServerPort();

app.use(cors());
app.use(express.json());

// Manual proxy for API requests
app.use('/api', async (req, res) => {
    // When Express matches /api, req.url is the remaining path after /api
    // So /api/sessions becomes req.url = /sessions
    // We need to reconstruct the full /api path
    const targetUrl = `http://localhost:${MAIN_SERVER_PORT}/api${req.url}`;

    console.log(`[PROXY] ${req.method} ${req.originalUrl} -> ${targetUrl}`);

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(targetUrl, {
            method: req.method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
        });

        const data = await response.text();
        res.status(response.status).send(data);
    } catch (err) {
        console.error('Proxy error:', err.message);
        res.status(500).json({
            error: 'Failed to connect to main server',
            details: err.message,
            port: MAIN_SERVER_PORT
        });
    }
});

// Serve static dashboard files
app.use(express.static('dashboard'));

// Serve dashboard index
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Dashboard running on http://localhost:${PORT}`);
    console.log(`Proxying API requests to http://localhost:${MAIN_SERVER_PORT}`);
});
