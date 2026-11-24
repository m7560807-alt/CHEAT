# CHEAT — Shared Notepad

CHEAT is a deliberately minimal real-time shared notepad. Anyone who knows a workspace ID can open the same document and edit it. There are no accounts or visible collaboration controls; Firebase Anonymous Authentication runs quietly in the background.

## Important note about editing

The app uses Yjs updates stored as individual Firebase Realtime Database records. Yjs merges concurrent edits, which is safer than repeatedly replacing the whole document. The editor itself is a plain full-screen textarea.

Workspace IDs are access keys, not private invitations. Anyone who knows or guesses an ID can read and edit that workspace. Do not use this app for passwords, personal information, or confidential content. Use long, hard-to-guess IDs.

## Requirements

- Node.js 20 or newer
- A Firebase project
- Firebase Realtime Database
- Firebase Anonymous Authentication enabled

## 1. Install dependencies

```bash
npm install
```

## 2. Create and configure Firebase

1. Open https://console.firebase.google.com/ and create a Firebase project.
2. Add a Web App to the project.
3. Copy its web app configuration values.
4. In **Authentication → Sign-in method**, enable **Anonymous**.
5. In **Build → Realtime Database**, create a database.
6. Copy the database URL shown in Firebase.
7. In the project root, copy `.env.example` to `.env`.
8. Fill in the values:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Do not add a Firebase Admin SDK service-account key to this frontend project.

## 3. Apply Realtime Database rules

In Firebase Console → Realtime Database → Rules, paste the contents of `database.rules.json` and publish them.

These rules require an authenticated Firebase user and allow authenticated users to read/write update records for valid room IDs. Since the app uses anonymous authentication, visitors are authenticated automatically.

For a public app, consider adding App Check, abuse controls, quotas, and a retention/cleanup strategy before broad release. The update log grows as people edit.

## 4. Run locally

```bash
npm run dev
```

Open the local URL printed by Vite. Open a second browser or private window, enter the same workspace ID, and test editing from both sessions.

## 5. Production build

```bash
npm run build
npm run preview
```

The production output is created in `dist/`.

## 6. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Add all `VITE_FIREBASE_*` values from your `.env` file under **Project Settings → Environment Variables**.
4. Use the default Vite settings:
   - Build command: `npm run build`
   - Output directory: `dist`
   - Install command: `npm install`
5. Deploy.

`vercel.json` includes an SPA rewrite so direct links such as `/room/MANOJ123` resolve to the React app.

## Routes

- `/` — Join a workspace
- `/room/WORKSPACE_ID` — Open a shared notepad

## Current scope

- Plain text only
- Same ID opens the same shared document
- Multiple people can edit
- Real-time Yjs synchronization
- Updates persist in Firebase
- No visible user list, chat, toolbar, or formatting controls

## Limitations to understand

- A workspace ID is a bearer-style access key. It is not a user identity or permission system.
- Anyone with the ID can edit. There is no owner-only mode.
- The Firebase update log is append-only in this starter. For long-running/high-traffic use, add server-side compaction and old-update cleanup.
- Firebase usage is subject to your project's plan limits and quotas.
- Offline edits are not queued by this starter; an active internet connection is required for collaboration and saving.
