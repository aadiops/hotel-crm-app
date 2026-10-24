const STORAGE_KEY = "hotel-crm-state-v1";

const defaultState = {
  guests: [
    { id: generateId(), name: "Ava Thompson", email: "ava@example.com", phone: "555-1010", type: "VIP" },
    { id: generateId(), name: "Noah Brown", email: "noah@example.com", phone: "555-2020", type: "Corporate" },
    { id: generateId(), name: "Mia Davis", email: "mia@example.com", phone: "555-3030", type: "Travel" }
  ],
  rooms: [
    { id: generateId(), number: "101", type: "Standard", price: 120, status: "Available" },
    { id: generateId(), number: "202", type: "Deluxe", price: 180, status: "Occupied" },
    { id: generateId(), number: "305", type: "Suite", price: 260, status: "Available" }
  ],
  bookings: [
    { id: generateId(), guestId: null, roomId: null, checkIn: "2026-10-26", checkOut: "2026-10-29" }
  ],
  invoices: [
    { id: generateId(), bookingId: null, guestName: "Ava Thompson", amount: 360, status: "Paid" }
  ]
};

let state = loadState();

function generateId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return structuredClone(defaultState);
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      guests: parsed.guests || [],
      rooms: parsed.rooms || [],
      bookings: parsed.bookings || [],
      invoices: parsed.invoices || []
    };
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function diffDays(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
}

function formatCurrency(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function getGuestById(id) {
  return state.guests.find((guest) => guest.id === id);
}

function getRoomById(id) {
  return state.rooms.find((room) => room.id === id);
}

function getRoomBookingTotal(booking) {
  const room = getRoomById(booking.roomId);
  if (!room) return 0;
  return room.price * diffDays(booking.checkIn, booking.checkOut);
}

function buildInvoiceFromBooking(booking) {
  const guest = getGuestById(booking.guestId);
  const room = getRoomById(booking.roomId);
  const total = getRoomBookingTotal(booking);

  return {
    id: generateId(),
    bookingId: booking.id,
    guestName: guest ? guest.name : "Unknown Guest",
    amount: total,
    status: "Unpaid"
  };
}

function renderDashboard() {
  const totalRevenue = state.invoices
    .filter((invoice) => invoice.status === "Paid")
    .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  const occupiedRooms = state.rooms.filter((room) => room.status === "Occupied").length;
  const occupancy = state.rooms.length ? Math.round((occupiedRooms / state.rooms.length) * 100) : 0;

  document.getElementById("occupancyStat").textContent = `${occupancy}%`;
  document.getElementById("revenueStat").textContent = formatCurrency(totalRevenue);
  document.getElementById("bookingsStat").textContent = String(state.bookings.length);
  document.getElementById("guestsStat").textContent = String(state.guests.length);

  const roomStatusList = document.getElementById("roomStatusList");
  roomStatusList.innerHTML = state.rooms.length
    ? state.rooms.map((room) => `
      <div class="stack-item">
        <div class="meta">
          <strong>Room ${room.number}</strong>
          <small>${room.type}</small>
        </div>
        <span class="badge ${room.status.toLowerCase()}">${room.status}</span>
      </div>
    `).join("")
    : '<div class="empty-state">No rooms added yet.</div>';

  const recentBookings = [...state.bookings].slice(-3).reverse();
  const recentBookingsHTML = recentBookings.length
    ? recentBookings.map((booking) => {
        const guest = getGuestById(booking.guestId);
        const room = getRoomById(booking.roomId);

        return `
          <div class="stack-item">
            <div class="meta">
              <strong>${guest ? guest.name : "Unknown Guest"}</strong>
              <small>${room ? `Room ${room.number}` : "No room"} · ${booking.checkIn} to ${booking.checkOut}</small>
            </div>
            <strong>${formatCurrency(getRoomBookingTotal(booking))}</strong>
          </div>
        `;
      }).join("")
    : '<div class="empty-state">No recent bookings.</div>';

  document.getElementById("recentBookings").innerHTML = recentBookingsHTML;
}

function renderGuests() {
  const guestList = document.getElementById("guestList");
  guestList.innerHTML = state.guests.length
    ? state.guests.map((guest) => `
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
    `).join("")
    : '<div class="empty-state">No guests recorded yet.</div>';
}

function renderRooms() {
  const roomList = document.getElementById("roomList");
  roomList.innerHTML = state.rooms.length
    ? state.rooms.map((room) => `
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
    `).join("")
    : '<div class="empty-state">No rooms added yet.</div>';
}

function renderBookings() {
  const bookingList = document.getElementById("bookingList");
  bookingList.innerHTML = state.bookings.length
    ? state.bookings.map((booking) => {
        const guest = getGuestById(booking.guestId);
        const room = getRoomById(booking.roomId);
        const total = getRoomBookingTotal(booking);

        return `
          <div class="list-item">
            <div class="meta">
              <strong>${guest ? guest.name : "Unknown guest"}</strong>
              <small>${room ? `Room ${room.number}` : "No room"} · ${booking.checkIn} to ${booking.checkOut}</small>
            </div>
            <div class="inline-actions">
              <strong>${formatCurrency(total)}</strong>
              <button class="action-btn" data-type="invoice" data-booking-id="${booking.id}">Invoice</button>
              <button class="delete-btn" data-type="booking" data-id="${booking.id}">Delete</button>
            </div>
          </div>
        `;
      }).join("")
    : '<div class="empty-state">No bookings scheduled.</div>';
}

function renderInvoices() {
  const invoiceList = document.getElementById("invoiceList");
  invoiceList.innerHTML = state.invoices.length
    ? state.invoices.map((invoice) => `
      <div class="list-item">
        <div class="meta">
          <strong>${invoice.guestName}</strong>
          <small>Invoice #${invoice.id.slice(0, 8)}</small>
        </div>
        <div class="inline-actions">
          <strong>${formatCurrency(invoice.amount)}</strong>
          <span class="badge ${invoice.status.toLowerCase()}">${invoice.status}</span>
          <button class="action-btn" data-type="mark-paid" data-id="${invoice.id}">Mark Paid</button>
          <button class="delete-btn" data-type="invoice" data-id="${invoice.id}">Delete</button>
        </div>
      </div>
    `).join("")
    : '<div class="empty-state">No invoices created.</div>';
}

function renderSelectors() {
  const guestSelect = document.getElementById("bookingGuest");
  const roomSelect = document.getElementById("bookingRoom");

  guestSelect.innerHTML = state.guests.length
    ? state.guests.map((guest) => `<option value="${guest.id}">${guest.name}</option>`).join("")
    : '<option value="">No guests available</option>';

  roomSelect.innerHTML = state.rooms.length
    ? state.rooms.map((room) => `<option value="${room.id}">Room ${room.number} · ${formatCurrency(room.price)}</option>`).join("")
    : '<option value="">No rooms available</option>';
}

function syncBookingState() {
  state.bookings = state.bookings.filter((booking) => {
    const hasGuest = state.guests.some((guest) => guest.id === booking.guestId);
    const hasRoom = state.rooms.some((room) => room.id === booking.roomId);
    return hasGuest && hasRoom;
  });

  state.invoices = state.invoices.filter((invoice) => {
    const linkedBooking = state.bookings.some((booking) => booking.id === invoice.bookingId);
    return linkedBooking || !invoice.bookingId;
  });
}

function handleDelete(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const { type, id } = target.dataset;
  if (!type || !id) return;

  if (type === "guest") {
    state.guests = state.guests.filter((guest) => guest.id !== id);
  }

  if (type === "room") {
    state.rooms = state.rooms.filter((room) => room.id !== id);
    state.bookings = state.bookings.filter((booking) => booking.roomId !== id);
  }

  if (type === "booking") {
    state.bookings = state.bookings.filter((booking) => booking.id !== id);
    state.invoices = state.invoices.filter((invoice) => invoice.bookingId !== id);
  }

  if (type === "invoice") {
    state.invoices = state.invoices.filter((invoice) => invoice.id !== id);
  }

  syncBookingState();
  renderAll();
}

function handleAction(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const { type, id, bookingId } = target.dataset;
  if (!type) return;

  if (type === "mark-paid") {
    const invoice = state.invoices.find((item) => item.id === id);
    if (invoice) {
      invoice.status = "Paid";
    }
  }

  if (type === "invoice") {
    const booking = state.bookings.find((item) => item.id === bookingId);
    if (!booking) return;
    const invoice = buildInvoiceFromBooking(booking);
    state.invoices.push(invoice);
  }

  renderAll();
}

function renderAll() {
  renderDashboard();
  renderGuests();
  renderRooms();
  renderBookings();
  renderInvoices();
  renderSelectors();
  saveState();
}

function initNavigation() {
  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((panel) => panel.classList.remove("active"));

      button.classList.add("active");
      const target = document.getElementById(button.dataset.panel);
      target.classList.add("active");
    });
  });
}

function initGuestForm() {
  const form = document.getElementById("guestForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const guest = {
      id: generateId(),
      name: document.getElementById("guestName").value.trim(),
      email: document.getElementById("guestEmail").value.trim(),
      phone: document.getElementById("guestPhone").value.trim(),
      type: document.getElementById("guestType").value
    };

    if (!guest.name || !guest.email || !guest.phone) return;
    state.guests.push(guest);
    form.reset();
    renderAll();
  });
}

function initRoomForm() {
  const form = document.getElementById("roomForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const room = {
      id: generateId(),
      number: document.getElementById("roomNumber").value.trim(),
      type: document.getElementById("roomType").value,
      price: Number(document.getElementById("roomPrice").value),
      status: document.getElementById("roomStatus").value
    };

    if (!room.number || !room.price) return;
    state.rooms.push(room);
    form.reset();
    renderAll();
  });
}

function initBookingForm() {
  const form = document.getElementById("bookingForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!state.guests.length || !state.rooms.length) {
      alert("Add at least one guest and one room before creating a booking.");
      return;
    }

    const guestId = document.getElementById("bookingGuest").value;
    const roomId = document.getElementById("bookingRoom").value;
    const checkIn = document.getElementById("checkIn").value;
    const checkOut = document.getElementById("checkOut").value;

    if (!guestId || !roomId || !checkIn || !checkOut) return;

    const booking = {
      id: generateId(),
      guestId,
      roomId,
      checkIn,
      checkOut
    };

    state.bookings.push(booking);
    const room = getRoomById(roomId);
    if (room) room.status = "Occupied";

    state.invoices.push(buildInvoiceFromBooking(booking));
    form.reset();
    renderAll();
  });
}

function initGlobalEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    if (target.matches(".delete-btn")) {
      handleDelete(event);
      return;
    }

    if (target.matches(".action-btn")) {
      handleAction(event);
    }
  });
}

function init() {
  initNavigation();
  initGuestForm();
  initRoomForm();
  initBookingForm();
  initGlobalEvents();
  renderAll();
}

init();
