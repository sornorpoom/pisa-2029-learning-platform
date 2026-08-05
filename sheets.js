// =====================================================
// api/sheets.js  –  Vercel Serverless Function (CommonJS)
// Proxies Google Sheets → ผ่าน CORS
// Endpoint: GET /api/sheets
// =====================================================

const SHEET_ID  = '1vo2anZD6TpFUecCXxQOsAd2AoopzSksWgS7MqWLvjI4';
const SHEET_TAB = 'PISA 2029';

module.exports = async function handler(req, res) {
  // ─── CORS headers ─────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ─── ปิดแคชทั้งหมด – Real-time เสมอ ──────────────
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma',  'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  try {
    // ── Timestamp cache buster ──
    const ts     = Date.now();
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
                   `?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}&_t=${ts}`;

    const ctrl     = new AbortController();
    const timeoutId = setTimeout(() => ctrl.abort(), 12000);

    const upstream = await fetch(csvUrl, {
      signal: ctrl.signal,
      headers: {
        'User-Agent':      'PISA2029-Vercel/2.0',
        'Accept':          'text/csv,text/plain,*/*',
        'Cache-Control':   'no-cache',
        'Pragma':          'no-cache',
      },
    });

    clearTimeout(timeoutId);

    if (!upstream.ok) {
      return res.status(502).json({
        error:   'google_error',
        status:  upstream.status,
        message: `Google Sheets ตอบ HTTP ${upstream.status} – ตรวจสอบ Share เป็น Public`,
      });
    }

    const csv = await upstream.text();
    return res.status(200).send(csv);

  } catch (err) {
    console.error('[/api/sheets]', err.message);
    return res.status(502).json({ error: 'upstream_error', message: err.message });
  }
};
