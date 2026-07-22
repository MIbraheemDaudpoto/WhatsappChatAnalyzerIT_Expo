# WhatsApp Chat Analyzer + Contact & Feedback

This project analyzes exported WhatsApp chats in the browser and now includes a **Contact & Feedback** feature with a lightweight modular Express backend and SQLite persistence.

## Features

- Existing WhatsApp chat analytics workflow remains client-side.
- New bottom-page Contact & Feedback section:
  - Required: name, email, message
  - Optional: subject, send-me-a-copy
  - Cloudflare Turnstile verification
  - Character counter, loading state, success/error toasts
  - Metadata capture (timezone, browser, OS, device, screen, language, referrer, URL, user-agent)
- Backend API with validation, sanitization, rate limiting, SQLite storage, and email notifications.
- Admin endpoint to retrieve submissions (API-key protected).

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env template and configure values:

```bash
cp .env.example .env
```

3. Update `.env`:

- `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_TO`
- `ADMIN_API_KEY`
- `TURNSTILE_SECRET_KEY`
- `TURNSTILE_SITE_KEY` (for your records) and `VITE_TURNSTILE_SITE_KEY` (frontend)
- Optional: `SMTP_HOST`, `SMTP_PORT`, `CONTACT_DB_PATH`, `PORT`, `FRONTEND_ORIGIN`

4. Run app and API together:

```bash
npm run dev
```

- Frontend runs on `http://localhost:3000`
- Express API runs on `http://localhost:8787`
- Vite proxies `/api/*` to backend.

## SQLite initialization

No manual migration command is required. On server startup, the backend creates `contact_submissions` table automatically (default DB path: `./data/contact-feedback.db`).

## API

### `POST /api/contact`

Accepts:

- `name`, `email`, `subject`, `message`, `sendCopy`, `turnstileToken`, `metadata`

Behavior:

- Validates and sanitizes payload
- Verifies Turnstile token
- Applies rate limiting
- Saves record in SQLite
- Sends notification email via Nodemailer
- Optionally sends copy to visitor

### `GET /api/contact`

Returns submissions newest-first.

Auth:

- Header: `x-api-key: <ADMIN_API_KEY>`
- or query: `?apiKey=<ADMIN_API_KEY>`

Example:

```bash
curl "http://localhost:8787/api/contact?apiKey=YOUR_ADMIN_API_KEY"
```

## Cloudflare Turnstile setup

1. Create a Turnstile site in Cloudflare dashboard.
2. Add site key to `VITE_TURNSTILE_SITE_KEY`.
3. Add secret key to `TURNSTILE_SECRET_KEY`.

## Email (Nodemailer) notes

Configure SMTP through:

- `SMTP_HOST`
- `SMTP_PORT`
- `EMAIL_USER`
- `EMAIL_PASS`
- `EMAIL_TO`

If SMTP is not configured, submissions are still stored but email delivery is skipped.

## Security & privacy

- Server-side validation and sanitization for all inputs
- Rate limiting on contact submissions
- Turnstile verification for spam reduction
- API key protection for admin endpoint
- No hardcoded secrets
- Privacy note is shown in UI, explaining what metadata is collected and why

