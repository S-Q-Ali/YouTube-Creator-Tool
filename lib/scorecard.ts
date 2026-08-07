export interface SeoCheck {
  id: string;
  label: string;
  passed: boolean;
  score: number; // 0-100 for this check
  weight: number; // within its section
  detail: string;
}

export interface SeoResult {
  total: number; // 0-100
  actionablePct: number; // 0-100
  performancePct: number; // 0-100
  checks: SeoCheck[];
}

export interface SeoInput {
  title: string;
  description: string;
  tags: string[];
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  publishedAt: string;
  focusKeyword?: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function containsKeyword(haystack: string, keyword: string): boolean {
  const h = norm(haystack);
  const k = norm(keyword);
  if (!k) return false;
  return h.includes(k) || k.split(" ").filter(Boolean).some((w) => h.includes(w));
}

function scoreChar(n: number, good: number, perfect: number): number {
  // linear ramp from 0 (at good/5) to 100 (at perfect)
  if (n >= perfect) return 100;
  if (n <= good / 5) return 0;
  return clamp(Math.round((n / perfect) * 100), 0, 100);
}

/**
 * vidIQ-style score: 50% "actionable" (title/description/tags/keyword placement)
 * + 50% "performance" (engagement + growth velocity). Fully transparent.
 */
export function computeSeoScore(input: SeoInput): SeoResult {
  const { title, description, tags, viewCount, likeCount, commentCount, publishedAt } = input;
  const kw = input.focusKeyword;
  const titleLen = title.trim().length;
  const descLen = description.trim().length;
  const tagCount = tags.length;

  const checks: SeoCheck[] = [];

  const titleScore = titleLen >= 20 && titleLen <= 60 ? 100 : scoreChar(titleLen, 20, 40);
  checks.push({
    id: "titleLength",
    label: "Title length (20–60 chars)",
    passed: titleLen >= 20 && titleLen <= 60,
    score: titleScore,
    weight: 12,
    detail: `${titleLen} chars`,
  });

  const descScore = descLen >= 300 ? 100 : scoreChar(descLen, 100, 300);
  checks.push({
    id: "descriptionLength",
    label: "Description ≥ 300 chars",
    passed: descLen >= 300,
    score: descScore,
    weight: 12,
    detail: `${descLen} chars`,
  });

  const tagScore = tagCount >= 5 ? 100 : scoreChar(tagCount, 2, 5);
  checks.push({
    id: "tagCount",
    label: "At least 5 tags",
    passed: tagCount >= 5,
    score: tagScore,
    weight: 12,
    detail: `${tagCount} tags`,
  });

  const kwTitle = kw ? containsKeyword(title, kw) : null;
  const kwDesc = kw ? containsKeyword(description, kw) : null;
  const kwTags = kw ? tags.some((t) => norm(t).includes(norm(kw))) : null;

  if (kw) {
    checks.push({
      id: "keywordTitle",
      label: `Keyword in title`,
      passed: !!kwTitle,
      score: kwTitle ? 100 : 0,
      weight: 10,
      detail: kwTitle ? `"${kw}" found in title` : `"${kw}" not in title`,
    });
    checks.push({
      id: "keywordDescription",
      label: `Keyword in description`,
      passed: !!kwDesc,
      score: kwDesc ? 100 : 0,
      weight: 8,
      detail: kwDesc ? `"${kw}" found in description` : `"${kw}" not in description`,
    });
    checks.push({
      id: "keywordTags",
      label: `Keyword in tags`,
      passed: !!kwTags,
      score: kwTags ? 100 : 0,
      weight: 8,
      detail: kwTags ? `"${kw}" present in a tag` : `"${kw}" not in tags`,
    });
    const triple = kwTitle && kwDesc && kwTags;
    checks.push({
      id: "tripleKeyword",
      label: "Triple keyword (title + desc + tags)",
      passed: !!triple,
      score: triple ? 100 : 0,
      weight: 8,
      detail: triple ? "Keyword used in all three" : "Use the keyword in title, description, and tags",
    });
  }

  const engagement = (() => {
    const likes = (likeCount ?? 0) / Math.max(1, viewCount);
    const comments = (commentCount ?? 0) / Math.max(1, viewCount);
    const likePct = Math.min(100, (likes / 0.05) * 100);
    const commentPct = Math.min(100, (comments / 0.01) * 100);
    return Math.round(likePct * 0.6 + commentPct * 0.4);
  })();
  checks.push({
    id: "engagement",
    label: "Engagement (likes & comments / views)",
    passed: engagement >= 50,
    score: engagement,
    weight: 30,
    detail: `${((likeCount ?? 0) / Math.max(1, viewCount) * 100).toFixed(2)}% likes, ${((commentCount ?? 0) / Math.max(1, viewCount) * 100).toFixed(2)}% comments`,
  });

  const ageDays = publishedAt
    ? Math.max(1, (Date.now() - new Date(publishedAt).getTime()) / 86_400_000)
    : 1;
  const viewsPerDay = viewCount / ageDays;
  const velocity = Math.min(100, (viewsPerDay / 5000) * 100);
  checks.push({
    id: "velocity",
    label: "Growth velocity (views/day)",
    passed: velocity >= 50,
    score: Math.round(velocity),
    weight: 30,
    detail: `${viewsPerDay >= 1000 ? (viewsPerDay / 1000).toFixed(1) + "K" : Math.round(viewsPerDay)} views/day since publish`,
  });

  const actionableChecks = checks.filter((c) => ["titleLength", "descriptionLength", "tagCount", "keywordTitle", "keywordDescription", "keywordTags", "tripleKeyword"].includes(c.id));
  const performanceChecks = checks.filter((c) => ["engagement", "velocity"].includes(c.id));

  const sectionPct = (section: SeoCheck[]) => {
    const totalW = section.reduce((a, c) => a + c.weight, 0);
    if (totalW === 0) return 0;
    return section.reduce((a, c) => a + c.score * c.weight, 0) / totalW;
  };

  const actionablePct = sectionPct(actionableChecks);
  const performancePct = sectionPct(performanceChecks);
  const total = Math.round((actionablePct + performancePct) / 2);

  return { total, actionablePct: Math.round(actionablePct), performancePct: Math.round(performancePct), checks };
}

/** vidIQ-style letter grade for a 0-100 score. */
export function scoreLabel(score: number): "A" | "B" | "C" | "D" | "E" | "F" {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 55) return "D";
  if (score >= 40) return "E";
  return "F";
}

/** Split a SeoResult's checks back into the two 50/50 sections. */
export function seoCheckSections(checks: SeoCheck[]): { actionable: SeoCheck[]; performance: SeoCheck[] } {
  const actionableIds = ["titleLength", "descriptionLength", "tagCount", "keywordTitle", "keywordDescription", "keywordTags", "tripleKeyword"];
  return {
    actionable: checks.filter((c) => actionableIds.includes(c.id)),
    performance: checks.filter((c) => !actionableIds.includes(c.id)),
  };
}

/** Simple heuristic overall SEO for a channel page (tags + description presence). */
export function computeChannelSeoScore(channel: {
  title: string;
  description: string;
  channelTags: string[];
  subscriberCount: number;
}): SeoResult {
  return computeSeoScore({
    title: channel.title,
    description: channel.description,
    tags: channel.channelTags,
    viewCount: Math.max(1, channel.subscriberCount),
    likeCount: null,
    commentCount: null,
    publishedAt: "",
  });
}
