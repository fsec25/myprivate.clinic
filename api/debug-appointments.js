const JUMP_API_BASE = 'https://app.usejump.co.uk/functions/v1/api-v1';

export default async function handler(req, res) {
  const apiKey = process.env.JUMP_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key' });

  // Fetch all appointments for Friday 3rd April (UTC range covers full day London time)
  const params = new URLSearchParams({
    date_gte: '2026-04-03T00:00:00Z',
    date_lte: '2026-04-03T23:59:59Z',
    limit: '100',
  });

  const resp = await fetch(`${JUMP_API_BASE}/appointments?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  const data = await resp.json();
  return res.status(200).json(data);
}
