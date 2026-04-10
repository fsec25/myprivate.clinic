// /api/scan.js — Dynamic QR code scan tracker
// Usage: /api/scan?c=campaign-slug
// Logs the scan to Supabase, then redirects to the campaign's destination URL.

const SUPABASE_URL = 'https://lbggerkztgeyydkyrgje.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxiZ2dlcmt6dGdleXlka3lyZ2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTM1NjAsImV4cCI6MjA5MDg2OTU2MH0.EtwwMJ7YPItswlqzxxstOXvVPz6XdcbEtBSCPZXg4cM';

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...(options.headers || {}),
    },
  });
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export default async function handler(req, res) {
  const campaign = req.query.c || '';

  if (!campaign) {
    return res.status(400).send('Missing campaign code (c= parameter)');
  }

  // 1. Look up the campaign's destination URL
  let destination = 'https://myprivateclinic.vercel.app';
  try {
    const rows = await supabaseFetch(
      `/qr_codes?slug=eq.${encodeURIComponent(campaign)}&select=destination_url&limit=1`,
      { method: 'GET' }
    );
    if (rows && rows.length > 0) {
      destination = rows[0].destination_url;
    }
  } catch (e) {
    console.error('QR lookup error:', e.message);
  }

  // 2. Log the scan (fire-and-forget — don't block redirect on DB write)
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    null;

  supabaseFetch('/qr_scans', {
    method: 'POST',
    body: JSON.stringify({
      campaign_slug: campaign,
      ip: ip,
      user_agent: req.headers['user-agent'] || null,
      referrer: req.headers['referer'] || null,
    }),
  }).catch(e => console.error('QR scan log error:', e.message));

  // 3. Redirect
  res.setHeader('Cache-Control', 'no-store');
  res.redirect(302, destination);
}
