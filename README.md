# Sidram Khaata

Small ledger web app (Vite + React + Firebase Auth + Firestore) for recording people and money given, with optional interest.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and add your Firebase web app keys (do not commit `.env`).
3. In Firebase Console → Firestore → **Rules**, publish the contents of `firestore.rules` (or run `npm run deploy:firestore` to print them).
4. Enable **Authentication → Email/Password**.
5. `npm run dev`

## Scripts

| Command | Purpose |
|--------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run deploy:firestore` | Print Firestore rules to paste in Firebase Console |
