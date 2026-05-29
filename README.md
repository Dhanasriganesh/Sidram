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
| `npm run cap:sync` | Build web app and copy into iOS/Android projects |
| `npm run cap:ios` | Open Xcode to run on iPhone (requires macOS) |
| `npm run cap:android` | Open Android Studio |

## iPhone contact import

Safari on iPhone does not allow websites to open the contact book by default. Contact import works in these cases:

1. **Sidram iOS app (recommended)** — On a Mac, run `npm run cap:ios`, connect your iPhone, and run from Xcode. The app uses the native contact picker (same **Import from phone contacts** button).
2. **Safari experimental flag** — Settings → Safari → Advanced → Feature Flags → enable **Contact Picker API**, then use the site in Safari.
3. **Android** — Chrome over HTTPS (unchanged).

After code changes, run `npm run cap:sync` before rebuilding the mobile app.
