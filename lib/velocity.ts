/**
 * Lifetime velocity: views per hour since publish.
 *
 * Distinct from lib/vphEngine.computeVph, which is a 24h delta over our own
 * hourly snapshots and therefore only exists for videos on the watchlist.
 * The grids show this one instead because it is derivable for every video.
 */

export const VPH_SPIKE_THRESHOLD = 500;

export interface VelocityResult {
  /** Views per hour since publish. */
  vph: number | null;
  /** The same rate per day, derived from the displayed hourly rate. */
  vphDay: number | null;
  /** Age in hours, floored at 1. Zero when the age is unknown. */
  ageHours: number;
  basis: "lifetime" | "none";
}

export interface VelocityInput {
  viewCount: number | null | undefined;
  publishedAt: string | null | undefined;
  now?: number;
}

const HOUR_MS = 3_600_000;
/** Below an hour of age the division explodes, so treat it as exactly one hour. */
const MIN_AGE_MS = HOUR_MS;

export function computeVelocity(input: VelocityInput): VelocityResult {
  const now = input.now ?? Date.now();
  const views =
    typeof input.viewCount === "number" && Number.isFinite(input.viewCount) ? input.viewCount : null;
  const published = input.publishedAt ? Date.parse(input.publishedAt) : Number.NaN;

  if (views == null || views < 0 || !Number.isFinite(published)) {
    return { vph: null, vphDay: null, ageHours: 0, basis: "none" };
  }

  const ageHours = Math.max(now - published, MIN_AGE_MS) / HOUR_MS;
  const vph = round1(views / ageHours);
  return { vph, vphDay: round1(vph * 24), ageHours, basis: "lifetime" };
}

export function isSpike(vph: number | null | undefined): boolean {
  return vph != null && vph >= VPH_SPIKE_THRESHOLD;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
