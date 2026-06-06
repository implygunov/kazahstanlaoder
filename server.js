
const http = require('http');

const PORT     = process.env.PORT || 3000;
const STALE_MS = 8000;          // через сколько без heartbeat игрок «оффлайн»
const MAX_BODY = 64 * 1024;     // защита от слишком больших тел

// ник -> { cosmetics: {...}, ts: <мс> }
const players = new Map();

function prune(now) {
    for (const [name, entry] of players) {
        if (now - entry.ts > STALE_MS) players.delete(name);
    }
}

function snapshot() {
    const out = {};
    for (const [name, entry] of players) out[name] = entry.cosmetics;
    return out;
}

function sendJson(res, code, obj) {
    const body = JSON.stringify(obj);
    res.writeHead(code, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok — RelevantFree cosmetics relay, online=' + players.size);
        return;
    }

    if (req.method === 'POST' && req.url === '/cosmetics/heartbeat') {
        let raw = '';
        let aborted = false;
        req.on('data', chunk => {
            raw += chunk;
            if (raw.length > MAX_BODY) {
                aborted = true;
                res.writeHead(413).end();
                req.destroy();
            }
        });
        req.on('end', () => {
            if (aborted) return;
            const now = Date.now();
            try {
                const data = JSON.parse(raw);
                const name = typeof data.player === 'string' ? data.player.trim() : '';
                if (name && data.cosmetics && typeof data.cosmetics === 'object') {
                    players.set(name, { cosmetics: data.cosmetics, ts: now });
                }
            } catch (_) { /* кривое тело — игнор, но всё равно отдадим список */ }

            prune(now);
            sendJson(res, 200, { players: snapshot() });
        });
        return;
    }

    res.writeHead(404).end();
});

server.listen(PORT, () => {
    console.log('Cosmetics relay listening on :' + PORT);
});
