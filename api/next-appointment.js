const JUMP_API_BASE = 'https://app.usejump.co.uk/functions/v1/api-v1';
const SLOT_MINUTES = 15;
const CLINIC_START = { hour: 9,  minute: 0 };
const CLINIC_END   = { hour: 20, minute: 0 }; // last slot starts 19:45, ends 20:00
const CLINIC_OPEN_FROM = new Date('2026-04-10T00:00:00Z'); // diary starts from this date

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

  const apiKey = process.env.JUMP_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const result = await findNextAvailableSlot(apiKey);
    return res.status(200).json(result);
  } catch (err) {
    console.error('next-appointment error:', err);
    return res.status(500).json({ error: err.message || 'Failed to fetch availability' });
  }
}

// ── Timezone ─────────────────────────────────────────────────────────────────

function getUKOffsetHours(utcDate) {
  // Returns 1 for BST (Mar–Oct), 0 for GMT (Nov–Feb)
  const utcNoon = new Date(Date.UTC(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate(), 12));
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(utcNoon);
  const londonHour = parseInt(parts.find(p => p.type === 'hour').value);
  return londonHour - 12;
}

function londonToUTC(fridayUTCDate, hour, minute) {
  const offset = getUKOffsetHours(fridayUTCDate);
  return new Date(Date.UTC(
    fridayUTCDate.getUTCFullYear(),
    fridayUTCDate.getUTCMonth(),
    fridayUTCDate.getUTCDate(),
    hour - offset,
    minute,
  ));
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function getUpcomingFridays(count) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dayOfWeek = d.getUTCDay(); // 0=Sun … 5=Fri … 6=Sat
  const daysToFriday = dayOfWeek === 5 ? 0 : (5 - dayOfWeek + 7) % 7;
  d.setUTCDate(d.getUTCDate() + daysToFriday);

  const fridays = [];
  for (let i = 0; i < count; i++) {
    fridays.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return fridays;
}

function generateSlots(clinicStartUTC, clinicEndUTC) {
  const slots = [];
  const cursor = new Date(clinicStartUTC);
  while (cursor < clinicEndUTC) {
    const slotEnd = new Date(cursor.getTime() + SLOT_MINUTES * 60000);
    if (slotEnd <= clinicEndUTC) slots.push(new Date(cursor));
    cursor.setTime(cursor.getTime() + SLOT_MINUTES * 60000);
  }
  return slots;
}

// ── Jump API ──────────────────────────────────────────────────────────────────

async function fetchBookedAppointments(apiKey, startUTC, endUTC) {
  const params = new URLSearchParams({
    date_gte:   startUTC.toISOString(),
    date_lte:   endUTC.toISOString(),
    status_in:  'confirmed,scheduled,pending,pending_approval',
    limit:      '100',
  });

  const resp = await fetch(`${JUMP_API_BASE}/appointments?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!resp.ok) throw new Error(`Jump API returned ${resp.status}`);
  const data = await resp.json();
  return data.data || [];
}

// ── Slot finder ───────────────────────────────────────────────────────────────

async function findNextAvailableSlot(apiKey) {
  const now = new Date();
  const fridays = getUpcomingFridays(6);

  for (const friday of fridays) {
    const clinicStart = londonToUTC(friday, CLINIC_START.hour, CLINIC_START.minute);
    const clinicEnd   = londonToUTC(friday, CLINIC_END.hour,   CLINIC_END.minute);

    if (clinicEnd < now) continue; // entire day already passed
    if (friday < CLINIC_OPEN_FROM) continue; // diary not set up yet

    const booked = await fetchBookedAppointments(apiKey, clinicStart, clinicEnd);
    const slots  = generateSlots(clinicStart, clinicEnd);

    for (const slot of slots) {
      if (slot < now) continue; // past slot

      const slotEnd = new Date(slot.getTime() + SLOT_MINUTES * 60000);
      const isTaken = booked.some(appt => {
        const s = new Date(appt.start_time);
        const e = new Date(appt.end_time);
        return slot < e && slotEnd > s;
      });

      if (!isTaken) {
        return { slot: formatSlot(slot, friday) };
      }
    }
  }

  return { slot: null };
}

// ── Formatting ────────────────────────────────────────────────────────────────

function ordinal(n) {
  const v = n % 100;
  const suffixes = ['th', 'st', 'nd', 'rd'];
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

function formatSlot(slotUTC, fridayUTCDate) {
  const offset    = getUKOffsetHours(fridayUTCDate);
  const localHour = slotUTC.getUTCHours() + offset;
  const minute    = slotUTC.getUTCMinutes();
  const ampm      = localHour >= 12 ? 'pm' : 'am';
  const h         = localHour > 12 ? localHour - 12 : localHour || 12;
  const m         = minute > 0 ? `:${String(minute).padStart(2, '0')}` : '';

  const day   = fridayUTCDate.getUTCDate();
  const month = MONTHS[fridayUTCDate.getUTCMonth()];

  return `Friday ${ordinal(day)} ${month} at ${h}${m}${ampm}`;
}
