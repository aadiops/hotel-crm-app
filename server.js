const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const db = new Database(path.join(__dirname, 'hotel.db'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'hotel-crm-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin'
  );

  CREATE TABLE IF NOT EXISTS guests (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Regular'
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Available'
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    guest_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    check_in TEXT NOT NULL,
    check_out TEXT NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL,
    guest_name TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'Unpaid',
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS staff (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL DEFAULT 'Operations'
  );

  CREATE TABLE IF NOT EXISTS housekeeping_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    room_id TEXT,
    assignee TEXT,
    priority TEXT NOT NULL DEFAULT 'Normal',
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS maintenance_tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    room_id TEXT,
    assignee TEXT,
    priority TEXT NOT NULL DEFAULT 'Normal',
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL
  );
`);

const defaultStaff = [
  ['staff-front-office', 'Aisha Rahman', 'Front Office Manager', 'Front Office'],
  ['staff-housekeeping', 'Carlos Mendes', 'Housekeeping Supervisor', 'Housekeeping'],
  ['staff-maintenance', 'Noah Patel', 'Maintenance Lead', 'Engineering'],
  ['staff-concierge', 'Leila Hassan', 'Guest Relations Lead', 'Guest Services']
];

const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@hotelcrm.com');
if (!existingAdmin) {
  const adminId = `user-${Date.now()}`;
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)'
  ).run(
    adminId,
    'admin@hotelcrm.com',
    bcrypt.hashSync('admin123', 10),
    'Admin User',
    'admin'
  );
}

const existingStaffCount = db.prepare('SELECT COUNT(*) AS count FROM staff').get().count;
if (existingStaffCount === 0) {
  const insertStaff = db.prepare('INSERT INTO staff (id, name, role, department) VALUES (?, ?, ?, ?)');
  defaultStaff.forEach(([id, name, role, department]) => insertStaff.run(id, name, role, department));
}

const existingHousekeepingCount = db.prepare('SELECT COUNT(*) AS count FROM housekeeping_tasks').get().count;
if (existingHousekeepingCount === 0) {
  const insertTask = db.prepare('INSERT INTO housekeeping_tasks (id, title, room_id, assignee, priority, status) VALUES (?, ?, ?, ?, ?, ?)');
  insertTask.run('hk-101', 'Refresh Deluxe suite linens', null, 'Carlos Mendes', 'High', 'Pending');
  insertTask.run('hk-102', 'Turnover 204 after checkout', null, 'Aisha Rahman', 'Normal', 'In Progress');
  insertTask.run('hk-103', 'Inspect VIP amenities and minibar', null, 'Carlos Mendes', 'High', 'Pending');
}

const existingMaintenanceCount = db.prepare('SELECT COUNT(*) AS count FROM maintenance_tasks').get().count;
if (existingMaintenanceCount === 0) {
  const insertTask = db.prepare('INSERT INTO maintenance_tasks (id, title, room_id, assignee, priority, status) VALUES (?, ?, ?, ?, ?, ?)');
  insertTask.run('mt-101', 'Air conditioning check in suite 305', null, 'Noah Patel', 'High', 'Open');
  insertTask.run('mt-102', 'Lighting issue in corridor 2', null, 'Noah Patel', 'Normal', 'In Progress');
  insertTask.run('mt-103', 'Bathroom drain inspection for Family room 118', null, 'Noah Patel', 'Urgent', 'Open');
}

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function diffDays(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Hotel CRM API is running' });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  req.session.userId = user.id;
  req.session.userName = user.name;
  req.session.userRole = user.role;

  return res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: 'Session invalid' });
  }

  return res.json({ user });
});

app.get('/api/dashboard', requireAuth, (req, res) => {
  const totalGuests = db.prepare('SELECT COUNT(*) AS count FROM guests').get().count;
  const totalRooms = db.prepare('SELECT COUNT(*) AS count FROM rooms').get().count;
  const totalBookings = db.prepare('SELECT COUNT(*) AS count FROM bookings').get().count;
  const occupiedRooms = db.prepare('SELECT COUNT(*) AS count FROM rooms WHERE status = ?').get('Occupied').count;
  const revenue = db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE status = ?').get('Paid').total;

  const recentBookings = db.prepare(`
    SELECT b.*, g.name AS guest_name, r.number AS room_number, r.price AS room_price
    FROM bookings b
    LEFT JOIN guests g ON g.id = b.guest_id
    LEFT JOIN rooms r ON r.id = b.room_id
    ORDER BY b.check_in DESC
    LIMIT 5
  `).all();

  const roomStatus = db.prepare('SELECT * FROM rooms ORDER BY number ASC').all();
  const roomTypeBreakdown = db.prepare('SELECT type, COUNT(*) AS count FROM rooms GROUP BY type ORDER BY count DESC').all();
  const housekeepingSummary = db.prepare('SELECT status, COUNT(*) AS count FROM housekeeping_tasks GROUP BY status ORDER BY status').all();
  const maintenanceSummary = db.prepare('SELECT status, COUNT(*) AS count FROM maintenance_tasks GROUP BY status ORDER BY status').all();

  res.json({
    totals: {
      guests: totalGuests,
      rooms: totalRooms,
      bookings: totalBookings,
      occupancy: totalRooms ? Math.round((occupiedRooms / totalRooms) * 100) : 0,
      revenue
    },
    recentBookings,
    roomStatus,
    roomTypeBreakdown,
    serviceSummary: {
      housekeeping: housekeepingSummary,
      maintenance: maintenanceSummary
    }
  });
});

app.get('/api/guests', requireAuth, (req, res) => {
  const guests = db.prepare('SELECT * FROM guests ORDER BY name ASC').all();
  res.json({ guests });
});

app.post('/api/guests', requireAuth, (req, res) => {
  const { name, email, phone, type } = req.body;
  if (!name || !email || !phone) {
    return res.status(400).json({ message: 'Name, email and phone are required' });
  }

  const guest = {
    id: generateId('guest'),
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    type: type || 'Regular'
  };

  db.prepare('INSERT INTO guests (id, name, email, phone, type) VALUES (?, ?, ?, ?, ?)').run(
    guest.id,
    guest.name,
    guest.email,
    guest.phone,
    guest.type
  );

  res.status(201).json({ guest });
});

app.delete('/api/guests/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM guests WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/rooms', requireAuth, (req, res) => {
  const rooms = db.prepare('SELECT * FROM rooms ORDER BY CAST(number AS INTEGER) ASC, number ASC').all();
  res.json({ rooms });
});

app.post('/api/rooms', requireAuth, (req, res) => {
  const { number, type, price, status } = req.body;
  if (!number || !type || !price) {
    return res.status(400).json({ message: 'Room number, type and price are required' });
  }

  const room = {
    id: generateId('room'),
    number: number.trim(),
    type,
    price: Number(price),
    status: status || 'Available'
  };

  try {
    db.prepare('INSERT INTO rooms (id, number, type, price, status) VALUES (?, ?, ?, ?, ?)').run(
      room.id,
      room.number,
      room.type,
      room.price,
      room.status
    );
    res.status(201).json({ room });
  } catch (error) {
    return res.status(409).json({ message: 'Room number already exists' });
  }
});

app.delete('/api/rooms/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/bookings', requireAuth, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, g.name AS guest_name, r.number AS room_number, r.type AS room_type, r.price AS room_price
    FROM bookings b
    LEFT JOIN guests g ON g.id = b.guest_id
    LEFT JOIN rooms r ON r.id = b.room_id
    ORDER BY b.check_in DESC
  `).all();

  res.json({ bookings });
});

app.post('/api/bookings', requireAuth, (req, res) => {
  const { guestId, roomId, checkIn, checkOut } = req.body;
  if (!guestId || !roomId || !checkIn || !checkOut) {
    return res.status(400).json({ message: 'Guest, room, check-in and check-out dates are required' });
  }

  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId);
  const guest = db.prepare('SELECT * FROM guests WHERE id = ?').get(guestId);

  if (!room || !guest) {
    return res.status(404).json({ message: 'Guest or room not found' });
  }

  const total = room.price * diffDays(checkIn, checkOut);
  const bookingId = generateId('booking');

  db.prepare('INSERT INTO bookings (id, guest_id, room_id, check_in, check_out, total) VALUES (?, ?, ?, ?, ?, ?)').run(
    bookingId,
    guestId,
    roomId,
    checkIn,
    checkOut,
    total
  );

  db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run('Occupied', roomId);

  db.prepare('INSERT INTO invoices (id, booking_id, guest_name, amount, status) VALUES (?, ?, ?, ?, ?)').run(
    generateId('invoice'),
    bookingId,
    guest.name,
    total,
    'Unpaid'
  );

  const booking = db.prepare(`
    SELECT b.*, g.name AS guest_name, r.number AS room_number, r.type AS room_type, r.price AS room_price
    FROM bookings b
    LEFT JOIN guests g ON g.id = b.guest_id
    LEFT JOIN rooms r ON r.id = b.room_id
    WHERE b.id = ?
  `).get(bookingId);

  res.status(201).json({ booking });
});

app.delete('/api/bookings/:id', requireAuth, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (booking) {
    db.prepare('DELETE FROM invoices WHERE booking_id = ?').run(booking.id);
    db.prepare('DELETE FROM bookings WHERE id = ?').run(booking.id);
    const remaining = db.prepare('SELECT COUNT(*) AS count FROM bookings WHERE room_id = ?').get(booking.room_id).count;
    db.prepare('UPDATE rooms SET status = ? WHERE id = ?').run(remaining > 0 ? 'Occupied' : 'Available', booking.room_id);
  }
  res.json({ ok: true });
});

app.get('/api/invoices', requireAuth, (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices ORDER BY rowid DESC').all();
  res.json({ invoices });
});

app.post('/api/invoices/:id/pay', requireAuth, (req, res) => {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!invoice) {
    return res.status(404).json({ message: 'Invoice not found' });
  }

  db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run('Paid', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/invoices/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/staff', requireAuth, (req, res) => {
  const staff = db.prepare('SELECT * FROM staff ORDER BY department ASC, name ASC').all();
  res.json({ staff });
});

app.post('/api/staff', requireAuth, (req, res) => {
  const { name, role, department } = req.body;
  if (!name || !role) {
    return res.status(400).json({ message: 'Name and role are required' });
  }

  const member = {
    id: generateId('staff'),
    name: name.trim(),
    role: role.trim(),
    department: department || 'Operations'
  };

  db.prepare('INSERT INTO staff (id, name, role, department) VALUES (?, ?, ?, ?)').run(
    member.id,
    member.name,
    member.role,
    member.department
  );

  res.status(201).json({ staff: member });
});

app.get('/api/housekeeping', requireAuth, (req, res) => {
  const tasks = db.prepare(`
    SELECT h.*, r.number AS room_number
    FROM housekeeping_tasks h
    LEFT JOIN rooms r ON r.id = h.room_id
    ORDER BY CASE h.status
      WHEN 'Pending' THEN 1
      WHEN 'In Progress' THEN 2
      WHEN 'Done' THEN 3
      ELSE 4
    END, h.created_at DESC
  `).all();
  res.json({ housekeeping: tasks });
});

app.post('/api/housekeeping', requireAuth, (req, res) => {
  const { title, roomId, assignee, priority, status } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Task title is required' });
  }

  const task = {
    id: generateId('housekeeping'),
    title: title.trim(),
    roomId: roomId || null,
    assignee: assignee || 'Unassigned',
    priority: priority || 'Normal',
    status: status || 'Pending'
  };

  db.prepare('INSERT INTO housekeeping_tasks (id, title, room_id, assignee, priority, status) VALUES (?, ?, ?, ?, ?, ?)').run(
    task.id,
    task.title,
    task.roomId,
    task.assignee,
    task.priority,
    task.status
  );

  res.status(201).json({ housekeeping: task });
});

app.post('/api/housekeeping/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const valid = ['Pending', 'In Progress', 'Done'];
  if (!status || !valid.includes(status)) {
    return res.status(400).json({ message: 'Invalid housekeeping status' });
  }

  db.prepare('UPDATE housekeeping_tasks SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.get('/api/maintenance', requireAuth, (req, res) => {
  const tasks = db.prepare(`
    SELECT m.*, r.number AS room_number
    FROM maintenance_tasks m
    LEFT JOIN rooms r ON r.id = m.room_id
    ORDER BY CASE m.status
      WHEN 'Open' THEN 1
      WHEN 'In Progress' THEN 2
      WHEN 'Resolved' THEN 3
      ELSE 4
    END, m.created_at DESC
  `).all();
  res.json({ maintenance: tasks });
});

app.post('/api/maintenance', requireAuth, (req, res) => {
  const { title, roomId, assignee, priority, status } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Task title is required' });
  }

  const task = {
    id: generateId('maintenance'),
    title: title.trim(),
    roomId: roomId || null,
    assignee: assignee || 'Unassigned',
    priority: priority || 'Normal',
    status: status || 'Open'
  };

  db.prepare('INSERT INTO maintenance_tasks (id, title, room_id, assignee, priority, status) VALUES (?, ?, ?, ?, ?, ?)').run(
    task.id,
    task.title,
    task.roomId,
    task.assignee,
    task.priority,
    task.status
  );

  res.status(201).json({ maintenance: task });
});

app.post('/api/maintenance/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const valid = ['Open', 'In Progress', 'Resolved'];
  if (!status || !valid.includes(status)) {
    return res.status(400).json({ message: 'Invalid maintenance status' });
  }

  db.prepare('UPDATE maintenance_tasks SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Hotel CRM server running on http://localhost:${port}`);
});

