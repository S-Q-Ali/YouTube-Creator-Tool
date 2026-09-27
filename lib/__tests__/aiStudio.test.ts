import { describe, expect, it } from "vitest";
import { hashInputs } from "../aiCache";
import { parseSubtitleText } from "../transcript";
import { computeOptimizeScore, scoreDescription, scoreTag, scoreTitle } from "../aiStudio";

describe("aiCache", () => {
  it("hashes action + inputs deterministically", () => {
    expect(hashInputs("titles", "abc")).toBe(hashInputs("titles", "abc"));
    expect(hashInputs("titles", "abc")).not.toBe(hashInputs("titles", "abd"));
    expect(hashInputs("titles", "abc")).not.toBe(hashInputs("tags", "abc"));
  });
});

describe("transcript parser", () => {
  it("strips VTT framing and timestamps", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.200
Welcome back

00:00:02.200 --> 00:00:05.500
Welcome back to the channel
Today we break it down`;
    expect(parseSubtitleText(vtt)).toBe("Welcome back to the channel Today we break it down");
  });

  it("drops HTML tags and repeated auto-caption rolls", () => {
    const raw = "00:00:01.000 --> 00:00:03.000\n<v Rob>Hello world</v>\n\n00:00:03.000 --> 00:00:05.000\nHello world\n\n00:00:05.000 --> 00:00:07.000\nNext idea";
    expect(parseSubtitleText(raw)).toBe("Hello world Next idea");
  });

  it("returns empty string for empty input", () => {
    expect(parseSubtitleText("")).toBe(""); // undefined? no — "" stays ""
    expect(parseSubtitleText("WEBVTT\n\nKind: captions\nLanguage: en\n")).toBe("");
  });
});

describe("aiStudio scoring", () => {
  it("scores titles by keyword, length and punch", () => {
    expect(scoreTitle("")).toBe(0);
    const short = scoreTitle("How I built it", "building");
    const optimized = scoreTitle("The Ultimate Beginner Guide to Building a Faceless Channel in 2026", "faceless");
    expect(optimized).toBeGreaterThan(short);
    expect(optimized).toBeGreaterThanOrEqual(70);
  });

  it("rewards keyword presence in descriptions and penalizes walls of text", () => {
    const withKw = scoreDescription("Cook at home fast. Cooking ideas for beginners. ".repeat(12), "cooking");
    const keywordMiss = scoreDescription("Cook at home fast. Cooking ideas for beginners. ".repeat(12), "gardening");
    expect(withKw).toBeGreaterThan(keywordMiss);
    const huge = scoreDescription(Array.from({ length: 400 }, () => "word").join(" "), "cooking");
    expect(huge).toBeLessThan(withKw);
  });

  it("scores tags by specificity and keyword match", () => {
    const relevant = scoreTag("grow tomatoes", "tomatoes");
    const generic = scoreTag("video", "tomatoes");
    expect(relevant).toBeGreaterThan(generic);
  });

  it("computes an optimize score with zero tags lowest", () => {
    const full = computeOptimizeScore({ title: "How to Grow Tomatoes at Home: The Complete Beginner Guide", description: "A practical tomato growing guide. ".repeat(20), tags: ["tomatoes", "gardening", "growing tomatoes"] });
    const bare = computeOptimizeScore({ title: "", description: "", tags: [] });
    expect(full.score).toBeGreaterThan(bare.score);
    expect(full.score).toBeLessThanOrEqual(100);
    expect(bare.score).toBe(0);
  });
});