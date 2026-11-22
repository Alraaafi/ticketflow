/**
 * Seeds demo users + Bangladesh-flavoured demo events.
 *   npm run seed            -> creates demo data only if it does not exist yet
 *   npm run seed -- --reset -> wipes ALL TicketFlow collections first
 */
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const buildContainer = require('../src/container');
const { connectDB, disconnectDB } = require('../src/config/db');
const { User } = require('../src/models/User');
const { Event } = require('../src/models/Event');
const { Seat } = require('../src/models/Seat');
const { Booking } = require('../src/models/Booking');
const { Payment } = require('../src/models/Payment');
const { Notification } = require('../src/models/Notification');

const DEMO = {
  organizer: { name: 'Demo Organizer', email: 'organizer@ticketflow.com', password: 'Organizer@123', role: 'ORGANIZER', phone: '01711000000' },
  organizer2: { name: 'Second Organizer', email: 'organizer2@ticketflow.com', password: 'Organizer@123', role: 'ORGANIZER' },
  customer: { name: 'Demo Customer', email: 'customer@ticketflow.com', password: 'Customer@123', role: 'CUSTOMER', phone: '01811000000' },
  customer2: { name: 'Second Customer', email: 'customer2@ticketflow.com', password: 'Customer@123', role: 'CUSTOMER' },
};

const days = (n) => new Date(Date.now() + n * 864e5);
const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=70`;

const events = (orgId) => [
  {
    title: 'Bangla Rock Night 2026', type: 'CONCERT',
    description: 'An open-air night of Bangla rock and fusion with the country\'s favourite bands. Gates open at 5 PM.',
    venue: { name: 'Army Stadium', address: 'Banani', city: 'Dhaka' }, startsAt: days(20), imageUrl: img('photo-1501281668745-f7f57925c3b4'),
    layout: { rows: 10, seatsPerRow: 16 },
    categories: [
      { name: 'VIP', price: 5000, color: '#f59e0b', rowFrom: 'A', rowTo: 'B' },
      { name: 'Gold', price: 2500, color: '#8b5cf6', rowFrom: 'C', rowTo: 'F' },
      { name: 'General', price: 1000, color: '#10b981', rowFrom: 'G', rowTo: 'J' },
    ],
    pricing: { strategy: 'EARLY_BIRD', earlyBirdDiscountPercent: 20, earlyBirdEndsAt: days(7) },
  },
  {
    title: "Dhaka → Cox's Bazar AC Sleeper Coach", type: 'TRANSPORT',
    description: 'Overnight Scania AC sleeper. Departs Sayedabad 10:30 PM, arrives Cox\'s Bazar ~7:00 AM. Water + blanket included.',
    venue: { name: 'Sayedabad Bus Terminal', address: 'Jatrabari', city: 'Dhaka' }, startsAt: days(3), imageUrl: img('photo-1544620347-c4fd4a3d5957'),
    layout: { rows: 10, seatsPerRow: 4 },
    categories: [
      { name: 'Front', price: 2200, color: '#0ea5e9', rowFrom: 'A', rowTo: 'C' },
      { name: 'Standard', price: 1800, color: '#10b981', rowFrom: 'D', rowTo: 'J' },
    ],
    pricing: { strategy: 'BASE' },
  },
  {
    title: 'Sreemangal Tea Resort: Weekend Rooms', type: 'ROOM',
    description: 'Cottages surrounded by tea gardens. Each "seat" is one room for the weekend (2 nights, breakfast included).',
    venue: { name: 'Green Leaf Tea Resort', address: 'Sreemangal', city: 'Sylhet' }, startsAt: days(12), imageUrl: img('photo-1566073771259-6a8506099945'),
    layout: { rows: 3, seatsPerRow: 8 },
    categories: [
      { name: 'Suite', price: 12000, color: '#f43f5e', rowFrom: 'A', rowTo: 'A' },
      { name: 'Deluxe', price: 8000, color: '#8b5cf6', rowFrom: 'B', rowTo: 'C' },
    ],
    pricing: { strategy: 'EARLY_BIRD', earlyBirdDiscountPercent: 15, earlyBirdEndsAt: days(5) },
  },
  {
    title: 'T20 Cricket Final: Dhaka vs Chattogram', type: 'SPORTS',
    description: 'The big final under lights. Bring your flags!',
    venue: { name: 'Sher-e-Bangla National Stadium', address: 'Mirpur', city: 'Dhaka' }, startsAt: days(30), imageUrl: img('photo-1531415074968-036ba1b575da'),
    layout: { rows: 12, seatsPerRow: 20 },
    categories: [
      { name: 'Grand Stand', price: 3000, color: '#f59e0b', rowFrom: 'A', rowTo: 'C' },
      { name: 'Club House', price: 1500, color: '#0ea5e9', rowFrom: 'D', rowTo: 'H' },
      { name: 'Gallery', price: 500, color: '#10b981', rowFrom: 'I', rowTo: 'L' },
    ],
    pricing: { strategy: 'BASE' },
  },
  {
    title: 'Chattogram → Dhaka Intercity Express', type: 'TRANSPORT',
    description: 'Non-stop intercity train, AC chair coach. Departs 7:00 AM from Chattogram Railway Station.',
    venue: { name: 'Chattogram Railway Station', address: 'Station Road', city: 'Chattogram' }, startsAt: days(6), imageUrl: img('photo-1474487548417-781cb71495f3'),
    layout: { rows: 12, seatsPerRow: 5 },
    categories: [
      { name: 'AC Snigdha', price: 1100, color: '#8b5cf6', rowFrom: 'A', rowTo: 'D' },
      { name: 'S-Chair', price: 650, color: '#10b981', rowFrom: 'E', rowTo: 'L' },
    ],
    pricing: { strategy: 'BASE' },
  },
  {
    title: 'Dhaka Tech Summit 2026', type: 'CONFERENCE',
    description: 'A day of talks on AI, fintech and startups in Bangladesh. Lunch and networking included.',
    venue: { name: 'International Convention City Bashundhara', address: 'Kuril', city: 'Dhaka' }, startsAt: days(25), imageUrl: img('photo-1540575467063-178a50c2df87'),
    layout: { rows: 8, seatsPerRow: 12 },
    categories: [
      { name: 'Front Row', price: 3500, color: '#f43f5e', rowFrom: 'A', rowTo: 'B' },
      { name: 'Standard', price: 1500, color: '#0ea5e9', rowFrom: 'C', rowTo: 'H' },
    ],
    pricing: { strategy: 'EARLY_BIRD', earlyBirdDiscountPercent: 30, earlyBirdEndsAt: days(10) },
  },
  {
    title: 'Rajshahi Theatre Festival: Opening Night', type: 'THEATRE',
    description: 'Classic and new Bangla plays by local troupes.',
    venue: { name: 'Rajshahi Shilpakala Academy', address: 'Shaheb Bazar', city: 'Rajshahi' }, startsAt: days(15), imageUrl: img('photo-1503095396549-807759245b35'),
    layout: { rows: 8, seatsPerRow: 14 },
    categories: [
      { name: 'Premium', price: 800, color: '#f59e0b', rowFrom: 'A', rowTo: 'C' },
      { name: 'Regular', price: 400, color: '#10b981', rowFrom: 'D', rowTo: 'H' },
    ],
    pricing: { strategy: 'BASE' },
  },
].map((e) => ({ ...e, organizer: orgId }));

async function upsertUser(u) {
  const passwordHash = await bcrypt.hash(u.password, 10);
  return User.findOneAndUpdate(
    { email: u.email },
    { $set: { name: u.name, role: u.role, phone: u.phone, passwordHash } },
    { upsert: true, returnDocument: 'after' },
  );
}

async function main() {
  const reset = process.argv.includes('--reset');
  const { eventService } = buildContainer();
  await connectDB();

  if (reset) {
    await Promise.all([User, Event, Seat, Booking, Payment, Notification].map((M) => M.deleteMany({})));
    console.log('All TicketFlow collections cleared');
  }
  await Promise.all([User, Event, Seat, Booking, Payment, Notification].map((M) => M.syncIndexes()));

  const users = {};
  for (const [key, u] of Object.entries(DEMO)) users[key] = await upsertUser(u);
  console.log('Demo users ready');

  const existing = await Event.countDocuments({ organizer: users.organizer._id });
  if (existing === 0) {
    for (const e of events(users.organizer._id)) {
      await eventService.create({ id: String(users.organizer._id) }, e);
      console.log(`  + ${e.title}`);
    }
  } else {
    console.log(`Organizer already has ${existing} events, skipping (use --reset to recreate)`);
  }

  console.log('\nDemo credentials');
  Object.values(DEMO).forEach((u) => console.log(`  ${u.role.padEnd(9)} ${u.email} / ${u.password}`));
  await disconnectDB();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
