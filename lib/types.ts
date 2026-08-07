export interface VideoInfo {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSeconds: number;
  thumbnailUrl: string;
  tags: string[];
  categoryId: string;
  defaultLanguage: string;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  lastFetched: number;
}

export interface ChannelInfo {
  channelId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  customUrl: string;
  country: string;
  publishedAt: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  channelTags: string[];
  topicCategories: string[];
  lastFetched: number;
}

export interface KeywordRow {
  term: string;
  displayTerm: string;
  score: number;
  demandScore: number;
  competitionScore: number;
  competitionLabel: "Low" | "Medium" | "High";
  source: string;
  language: string;
  country: string;
  firstSeen: number;
  lastChecked: number;
}

export interface KeywordSnapshotRow {
  term: string;
  ts: number;
  demandScore: number | null;
  competitionScore: number | null;
  score: number | null;
}

export interface VideoSnapshotRow {
  videoId: string;
  ts: number;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
}

export interface ChannelSnapshotRow {
  channelId: string;
  ts: number;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

export interface TrackedItem {
  kind: "video" | "channel" | "keyword";
  refId: string;
  label: string;
  addedAt: number;
}

export interface RankingRow {
  term: string;
  videoId: string;
  position: number | null;
  ts: number;
}

export interface ScoredVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
}
