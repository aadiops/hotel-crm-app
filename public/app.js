const state = {
  user: null,
  dashboard: null,
  guests: [],
  rooms: [],
  bookings: [],
  invoices: []
};

const loginScreen = document.getElementById('loginScreen');
const appScreen = document.getElementById('appScreen');
const userBadge = document.getElementById('userBadge');

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString()}`;

const showApp = () => {
  loginScreen.classList.add('hidden');
  loginScreen.classList.remove('active');
  appScreen.classList.remove('hidden');
  appScreen.classList.add('active');
};

const showLogin = () => {
  appScreen.classList.add('hidden');
  appScreen.classList.remove('active');
  loginScreen.classList.remove('hidden');
  loginScreen.classList.add('active');
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Request failed');
  }

  return response.json();
}

async function loadCurrentUser() {
  try {
    const payload = await fetchJson('/api/auth/me');
    state.user = payload.user;
    userBadge.textContent = state.user.name;
    showApp();
    await loadAllData();
  } catch (error) {
    state.user = null;
    showLogin();
  }
}

async function loadAllData() {
  try {
    const [dashboard, guests, rooms, bookings, invoices] = await Promise.all([
      fetchJson('/api/dashboard'),
      fetchJson('/api/guests'),
      fetchJson('/api/rooms'),
      fetchJson('/api/bookings'),
      fetchJson('/api/invoices')
    ]);

    state.dashboard = dashboard;
    state.guests = guests.guests;
    state.rooms = rooms.rooms;
    state.bookings = bookings.bookings;
    state.invoices = invoices.invoices;

    renderDashboard();
    renderGuestList();
    renderRoomList();
    renderBookingList();
    renderInvoiceList();
    renderSelectors();
  } catch (error) {
    console.error(error);
  }
}

function renderDashboard() {
  const { totals, recentBookings, roomStatus } = state.dashboard || {
    totals: { guests: 0, rooms: 0, bookings: 0, occupancy: 0, revenue: 0 },
    recentBookings: [],
    roomStatus: []
  };

  document.getElementById('occupancyStat').textContent = `${totals.occupancy}%`;
  document.getElementById('revenueStat').textContent = formatCurrency(totals.revenue);
  document.getElementById('bookingsStat').textContent = totals.bookings;
  document.getElementById('guestsStat').textContent = totals.guests;

  const roomStatusList = document.getElementById('roomStatusList');
  roomStatusList.innerHTML = roomStatus.length
    ? roomStatus
        .map(
          (room) => `
            <div class="stack-item">
              <div class="meta">
                <strong>Room ${room.number}</strong>
                <small>${room.type}</small>
              </div>
              <span class="badge ${room.status.toLowerCase()}">${room.status}</span>
            </div>
          `
        )
        .join('')
    : '<div class="empty-state">No rooms yet.</div>';

  const recentBookingsList = document.getElementById('recentBookings');
  recentBookingsList.innerHTML = recentBookings.length
    ? recentBookings
        .map(
          (booking) => `
            <div class="stack-item">
              <div class="meta">
                <strong>${booking.guest_name || 'Guest'}</strong>
                <small>${booking.room_number ? `Room ${booking.room_number}` : 'No room'} · ${booking.check_in} to ${booking.check_out}</small>
              </div>
              <strong>${formatCurrency(booking.total || 0)}</strong>
            </div>
          `
        )
        .join('')
    : '<div class="empty-state">No bookings yet.</div>';
}

function renderGuestList() {
  const guestList = document.getElementById('guestList');
  guestList.innerHTML = state.guests.length
    ? state.guests
        .map(
          (guest) => `
            <div class="list-item">
              <div class="meta">
                <strong>${guest.name}</strong>
                <small>${guest.email}</small>
                <small>${guest.phone}</small>
              </div>
              <div class="inline-actions">
                <span class="badge ${guest.type.toLowerCase()}">${guest.type}</span>
                <button class="delete-btn" data-type="guest" data-id="${guest.id}">Delete</button>
              </div>
            </div>
          `
        )
        .join('')
    : '<div class="empty-state">No guests recorded yet.</div>';
}

function renderRoomList() {
  const roomList = document.getElementById('roomList');
  roomList.innerHTML = state.rooms.length
    ? state.rooms
        .map(
          (room) => `
            <div class="list-item">
              <div class="meta">
                <strong>Room ${room.number}</strong>
                <small>${room.type} · ${formatCurrency(room.price)}/night</small>
              </div>
              <div class="inline-actions">
                <span class="badge ${room.status.toLowerCase()}">${room.status}</span>
                <button class="delete-btn" data-type="room" data-id="${room.id}">Delete</button>
              </div>
            </div>
          `
        )
        .join('')
    : '<div class="empty-state">No rooms added yet.</div>';
}

function renderBookingList() {
  const bookingList = document.getElementById('bookingList');
  bookingList.innerHTML = state.bookings.length
    ? state.bookings
        .map(
          (booking) => `
            <div class="list-item">
              <div class="meta">
                <strong>${booking.guest_name || 'Unknown guest'}</strong>
                <small>${booking.room_number ? `Room ${booking.room_number}` : 'No room'} · ${booking.check_in} to ${booking.check_out}</small>
              </div>
              <div class="inline-actions">
                <strong>${formatCurrency(booking.total || 0)}</strong>
                <button class="delete-btn" data-type="booking" data-id="${booking.id}">Delete</button>
              </div>
            </div>
          `
        )
        .join('')
    : '<div class="empty-state">No bookings scheduled.</div>';
}

function renderInvoiceList() {
  const invoiceList = document.getElementById('invoiceList');
  invoiceList.innerHTML = state.invoices.length
    ? state.invoices
        .map(
          (invoice) => `
            <div class="list-item">
              <div class="meta">
                <strong>${invoice.guest_name}</strong>
                <small>Invoice #${invoice.id.slice(0, 8)}</small>
              </div>
              <div class="inline-actions">
                <strong>${formatCurrency(invoice.amount)}</strong>
                <span class="badge ${invoice.status.toLowerCase()}">${invoice.status}</span>
                <button class="action-btn" data-type="mark-paid" data-id="${invoice.id}">Mark Paid</button>
                <button class="delete-btn" data-type="invoice" data-id="${invoice.id}">Delete</button>
              </div>
            </div>
          `
        )
        .join('')
    : '<div class="empty-state">No invoices created.</div>';
}

function renderSelectors() {
  const guestSelect = document.getElementById('bookingGuest');
  const roomSelect = document.getElementById('bookingRoom');

  guestSelect.innerHTML = state.guests.length
    ? state.guests.map((guest) => `<option value="${guest.id}">${guest.name}</option>`).join('')
    : '<option value="">No guests available</option>';

  roomSelect.innerHTML = state.rooms.length
    ? state.rooms.map((room) => `<option value="${room.id}">Room ${room.number} · ${formatCurrency(room.price)}</option>`).join('')
    : '<option value="">No rooms available</option>';
}

async function loginUser(event) {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  try {
    const payload = await fetchJson('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    state.user = payload.user;
    userBadge.textContent = state.user.name;
    showApp();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
}

async function logoutUser() {
  try {
    await fetchJson('/api/auth/logout', { method: 'POST' });
    state.user = null;
    showLogin();
  } catch (error) {
    console.error(error);
  }
}

async function createGuest(event) {
  event.preventDefault();

  const payload = {
    name: document.getElementById('guestName').value.trim(),
    email: document.getElementById('guestEmail').value.trim(),
    phone: document.getElementById('guestPhone').value.trim(),
    type: document.getElementById('guestType').value
  };

  try {
    await fetchJson('/api/guests', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    event.target.reset();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
}

async function createRoom(event) {
  event.preventDefault();

  const payload = {
    number: document.getElementById('roomNumber').value.trim(),
    type: document.getElementById('roomType').value,
    price: document.getElementById('roomPrice').value,
    status: document.getElementById('roomStatus').value
  };

  try {
    await fetchJson('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    event.target.reset();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
}

async function createBooking(event) {
  event.preventDefault();

  const payload = {
    guestId: document.getElementById('bookingGuest').value,
    roomId: document.getElementById('bookingRoom').value,
    checkIn: document.getElementById('checkIn').value,
    checkOut: document.getElementById('checkOut').value
  };

  try {
    await fetchJson('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    event.target.reset();
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
}

async function handleDelete(type, id) {
  try {
    if (type === 'guest') await fetchJson(`/api/guests/${id}`, { method: 'DELETE' });
    if (type === 'room') await fetchJson(`/api/rooms/${id}`, { method: 'DELETE' });
    if (type === 'booking') await fetchJson(`/api/bookings/${id}`, { method: 'DELETE' });
    if (type === 'invoice') await fetchJson(`/api/invoices/${id}`, { method: 'DELETE' });

    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
}

async function markInvoicePaid(id) {
  try {
    await fetchJson(`/api/invoices/${id}/pay`, { method: 'POST' });
    await loadAllData();
  } catch (error) {
    alert(error.message);
  }
}

function bindEvents() {
  document.getElementById('loginForm').addEventListener('submit', loginUser);
  document.getElementById('logoutBtn').addEventListener('click', logoutUser);
  document.getElementById('guestForm').addEventListener('submit', createGuest);
  document.getElementById('roomForm').addEventListener('submit', createRoom);
  document.getElementById('bookingForm').addEventListener('submit', createBooking);

  document.querySelectorAll('.nav-btn').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.id === 'logoutBtn') return;
      document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((panel) => panel.classList.remove('active'));

      button.classList.add('active');
      const target = document.getElementById(button.dataset.panel);
      if (target) target.classList.add('active');
    });
  });

  document.addEventListener('click', async (event) => {
    const el = event.target.closest('.delete-btn');
    if (el) {
      await handleDelete(el.dataset.type, el.dataset.id);
      return;
    }

    const markBtn = event.target.closest('.action-btn');
    if (markBtn && markBtn.dataset.type === 'mark-paid') {
      await markInvoicePaid(markBtn.dataset.id);
    }
  });
}

bindEvents();
loadCurrentUser();
