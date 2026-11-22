/**
 * Concurrency / load test against a RUNNING server (local or live).
 *   API_URL=http://localhost:5000/api USERS=25 npm run test:concurrency
 *
 * N different customers try to hold the SAME seat at the same instant.
 * Expected: exactly 1 x 201 (winner) and N-1 x 409 SEAT_UNAVAILABLE.
 */
const API = process.env.API_URL || 'http://localhost:5000/api';
const USERS = Number(process.env.USERS || 20);

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

async function tokenFor(i) {
  const email = `loadtest${i}@ticketflow.com`;
  const password = 'LoadTest@123';
  let r = await call('POST', '/auth/login', { email, password });
  if (r.status !== 200) r = await call('POST', '/auth/register', { name: `Load Tester ${i}`, email, password, role: 'CUSTOMER' });
  if (!r.body?.data?.token) throw new Error(`Could not get token for ${email}: ${JSON.stringify(r.body)}`);
  return r.body.data.token;
}

(async () => {
  console.log(`Target: ${API} | concurrent customers: ${USERS}`);
  // Log in one by one (the auth endpoint is rate limited), then attack all at once.
  const tokens = [];
  for (let i = 0; i < USERS; i += 1) tokens.push(await tokenFor(i));

  const list = await call('GET', '/events?limit=1');
  const event = list.body.data.items[0];
  if (!event) throw new Error('No events found. Run `npm run seed` first.');
  const detail = await call('GET', `/events/${event._id}`);
  const seat = detail.body.data.seats.find((s) => s.status === 'AVAILABLE');
  if (!seat) throw new Error('No available seat on the first event');
  console.log(`Event: "${event.title}" | Seat under attack: ${seat.label}`);

  const started = Date.now();
  const results = await Promise.all(tokens.map((t) => call('POST', '/bookings/hold', { eventId: event._id, seats: [seat.label] }, t)));
  const ms = Date.now() - started;

  const winners = results.filter((r) => r.status === 201);
  const conflicts = results.filter((r) => r.status === 409);
  const other = results.filter((r) => ![201, 409].includes(r.status));
  console.log(`Done in ${ms} ms -> 201: ${winners.length} | 409: ${conflicts.length} | other: ${other.length}`);
  if (other.length) console.log('Other responses:', other.map((o) => `${o.status} ${o.body?.error?.code}`).join(', '));

  // Clean up: release the winner's hold so the seat is free again.
  const winIdx = results.findIndex((r) => r.status === 201);
  if (winIdx >= 0) await call('POST', `/bookings/${results[winIdx].body.data._id}/cancel`, null, tokens[winIdx]);

  if (winners.length === 1) {
    console.log('PASS: exactly one customer got the seat. No double booking.');
    process.exit(0);
  }
  console.error('FAIL: expected exactly one winner');
  process.exit(1);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
