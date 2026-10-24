# Hotel CRM App

A full-stack hotel CRM built with Node.js, Express, and SQLite. It includes an admin login, dashboard, guest management, room inventory, booking management, invoice tracking, and persistent data storage.

## Features

- Secure admin login with password hashing
- Dashboard overview with occupancy and revenue metrics
- Guest management
- Room inventory with status tracking
- Booking creation and scheduling
- Invoice lifecycle and payment updates
- SQLite database persistence
- Responsive browser interface

## Default admin account

- Email: `admin@hotelcrm.com`
- Password: `admin123`

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
npm start
```

3. Open in your browser:

```text
http://localhost:3000
```

## Project structure

- `server.js` — Express server and API routes
- `public/index.html` — single-page app shell
- `public/app.js` — front-end logic
- `public/styles.css` — styling
- `hotel.db` — SQLite database created automatically on first run

## Notes

This version is designed as a working real-world hotel CRM MVP for local/demo use.
