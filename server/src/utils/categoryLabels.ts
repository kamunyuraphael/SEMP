// categoryLabels.ts — display labels for device categories, used when
// rendering the weekly digest email/PDF. Mirrors the label set in
// app/src/utils/categoryColors.ts so the digest matches what the
// dashboard shows; kept as a separate small copy since the server and
// client are independently deployable and don't share a module graph.

export const CATEGORY_LABELS: Record<string, string> = {
  kitchen: "Kitchen",
  laundry: "Laundry",
  lighting: "Lighting",
  entertainment: "Entertainment",
  HVAC: "HVAC",
  computing: "Computing",
};
