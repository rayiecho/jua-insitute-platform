# Mobile (Expo)

Phase 2 lesson screen: markdown lesson content + a native code editor (per
Section 2 of the spec — Monaco is web-only, mobile uses a plain text
component) synced to the same `student_assignments_progress` table the web
app and agent worker use, plus the same grading flow.

No live tutoring session UI here yet (Section 5 Phase 1 build sequence has
LiveKit clients for both web and mobile, but the mobile LiveKit integration
hasn't been built — only the self-paced lesson view has parity with web so far).

## Setup

```bash
cp .env.example .env.local
```

Edit `.env.local` and set `EXPO_PUBLIC_API_BASE_URL` to your dev machine's
**LAN IP** (not `localhost`) and the port `apps/web`'s dev server is running
on. Find it with `ipconfig` (look at the Wi-Fi adapter you're actually
connected through) — it changes if you switch networks.

```bash
npm install
npm start
```

Scan the QR code with Expo Go on a phone **on the same network** as the dev
machine. If nothing loads, check:

- Windows may prompt "Allow this app through the firewall?" the first time a
  device connects to the dev server — allow it (scoped to Private networks).
- The phone and the dev machine must be on the same WiFi/hotspot — a mobile
  hotspot on the *dev machine* only helps if the phone joins that same hotspot,
  not if they're on two separate networks.
