import { describe, expect, it } from "vitest";
import { csvCell, csvRow } from "@/lib/csv";
import { bookingIcsUrl } from "@/lib/calendar";

describe("csv export safety", () => {
  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell("@SUM(A1)")).toBe('"\'@SUM(A1)"');
    expect(csvCell("+cmd|' /C calc'!A0")).toBe('"\'+cmd|\' /C calc\'!A0"');
    expect(csvCell("-2+3")).toBe('"\'-2+3"');
  });
  it("keeps normal text and phone numbers untouched", () => {
    expect(csvCell("علي")).toBe('"علي"');
    expect(csvCell("+962 79 123 4567")).toBe('"+962 79 123 4567"');
    expect(csvCell("0791234567")).toBe('"0791234567"');
    expect(csvCell(null)).toBe('""');
  });
  it("escapes quotes and joins a row", () => {
    expect(csvRow(['a"b', 3, "ok"])).toBe('"a""b","3","ok"');
  });
});

describe("calendar file", () => {
  it("builds an ics blob url", async () => {
    const url = bookingIcsUrl(new Date("2030-01-02T16:00:00Z"), 40, { name: "صالون H&M", lat: 32.5, lng: 35.9 });
    expect(url.startsWith("blob:")).toBe(true);
    const text = await (await fetch(url)).text();
    expect(text).toContain("DTSTART:20300102T160000Z");
    expect(text).toContain("DTEND:20300102T164000Z");
    expect(text).toContain("BEGIN:VALARM");
  });
});
