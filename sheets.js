// =====================================================
// api/sheets.js  –  Vercel Serverless Function
// Proxies Google Sheets CSV → avoids CORS issues
// Endpoint: GET /api/sheets
// =====================================================

const SHEET_ID  = '1vo2anZD6TpFUecCXxQOsAd2AoopzSksWgS7MqWLvjI4';
const SHEET_TAB = 'PISA 2029';

export default async function handler(req, res) {
  // ─── CORS headers ─────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ─── Build Google Sheets CSV URL ────────────────
    const csvUrl = [
      'https://docs.google.com/spreadsheets/d',
      SHEET_ID,
      `gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_TAB)}`
    ].join('/');

    // ─── Fetch from Google ───────────────────────────
    const upstream = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'PISA2029-Vercel/1.0',
        'Accept':     'text/csv,text/plain,*/*',
      },
      // Abort after 10 s
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      throw new Error(
        `Google Sheets returned HTTP ${upstream.status}. ` +
        `ตรวจสอบว่า Spreadsheet เปิดเป็น Public (Anyone with link)`
      );
    }

    const csv = await upstream.text();

    // ─── Cache: Disable all caching for real-time sync ──
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(csv);

  } catch (err) {
    console.error('[/api/sheets]', err.message);
    return res.status(502).json({
      error:   'upstream_error',
      message: err.message,
    });
  }
}
