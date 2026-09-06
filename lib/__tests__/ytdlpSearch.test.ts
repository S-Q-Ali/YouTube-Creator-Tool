import { describe, expect, it } from "vitest";
import { parseYtdlpLines } from "../ytdlpSearch";

describe("parseYtdlpLines", () => {
  it("parses a multiline --dump-json stream", () => {
    const stdout = [
      JSON.stringify({ id: "aaa111", title: "First Video", channel: "Chan A", upload_date: "20240101", thumbnail: "https://i.ytimg.com/1.jpg" }),
      JSON.stringify({ id: "bbb222", title: "Second Video" }),
      "",
    ].join("\n");
    const items = parseYtdlpLines(stdout);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      videoId: "aaa111",
      title: "First Video",
      channelTitle: "Chan A",
      publishedAt: "20240101",
      thumbnailUrl: "https://i.ytimg.com/1.jpg",
    });
    expect(items[1]).toEqual({ videoId: "bbb222", title: "Second Video" });
  });

  it("skips malformed lines and entries without an id", () => {
    const stdout = [
      JSON.stringify({ title: "no id here" }),
      "not json at all",
      JSON.stringify({ id: "ccc333", title: "Good" }),
      "{ broken",
    ].join("\n");
    const items = parseYtdlpLines(stdout);
    expect(items).toHaveLength(1);
    expect(items[0].videoId).toBe("ccc333");
  });

  it("handles empty and blank input", () => {
    expect(parseYtdlpLines("")).toHaveLength(0);
    expect(parseYtdlpLines("\n\n  \n")).toHaveLength(0);
  });

  it("normalizes CRLF line endings", () => {
    const items = parseYtdlpLines('{"id":"x1","title":"T"}\r\n{"id":"x2"}\r\n');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.videoId)).toEqual(["x1", "x2"]);
  });
});