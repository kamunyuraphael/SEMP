// releaseNotes.ts
// A small, hand-maintained list of "what's new" entries. Delivered to
// each user as a one-time "info" alert the first time they log in
// after an entry is added — reuses the existing alert pipeline
// (pushAlert -> persisted Alert doc + live Socket.io toast) rather
// than building a separate notification system.
//
// To ship a new entry: add an object with a new, stable `id` (never
// reuse or reorder existing ids — a user's seenReleaseNoteIds is
// matched against these exactly) and a short, user-facing `message`.
// New accounts are marked as having "seen" every entry that exists at
// registration time, so this is for existing users only.

export interface ReleaseNote {
  id: string;
  message: string;
}

export const RELEASE_NOTES: ReleaseNote[] = [
  { id: "2026-08-budgeting", message: "New: Set a monthly budget and get notified before you go over it." },
  { id: "2026-08-comparison", message: "New: See how this week/month compares to the last one, right on your Dashboard." },
  { id: "2026-08-weekly-digest", message: "New: Turn on the weekly email digest in Settings for a summary of your usage." },
  { id: "2026-08-forecast-chart", message: "New: The Predictions page now shows an actual-vs-predicted trend with a confidence band." },
  { id: "2026-08-device-detail", message: "New: Click into any device on the Devices page for its own usage trend and anomaly history." },
  { id: "2026-08-room-grouping", message: "New: Group your devices by room, not just category, from the Devices page." },
  { id: "2026-08-alert-actions", message: "New: Anomaly alerts now include a one-click button to turn off the affected device." },
  { id: "2026-08-onboarding", message: "New: First-time setup now walks you through adding your first device." },
  { id: "2026-08-install-app", message: "New: You can now install SEMP to your home screen for faster access." },
];
