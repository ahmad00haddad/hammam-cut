import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, busyRanges, slotFits, slotsForDay, stepMin, isDayOff, parseLimitError } from "@/lib/slots";

describe("slots (20 min + 5 buffer)", () => {
  const s = DEFAULT_STATE;
  it("uses a 25 minute grid from 12:00", () => {
    const slots = slotsForDay("2030-01-02", s);
    expect(stepMin(s)).toBe(25);
    expect(slots).toHaveLength(24);
    expect(slots[1]!.getTime() - slots[0]!.getTime()).toBe(25 * 60000);
  });
  it("party of 3 needs 3 free steps", () => {
    const slots = slotsForDay("2030-01-02", s);
    const busy = busyRanges({ ...s, busy: [[slots[2]!.toISOString(), new Date(slots[2]!.getTime() + 25 * 60000).toISOString()]] });
    expect(slotFits(slots[0]!, 1, s, busy)).toBe(true);
    expect(slotFits(slots[0]!, 3, s, busy)).toBe(false);
    expect(slotFits(slots[3]!, 3, s, busy)).toBe(true);
  });
  it("rejects a party that runs past closing", () => {
    const slots = slotsForDay("2030-01-02", s);
    expect(slotFits(slots.at(-1)!, 2, s, [])).toBe(false);
    expect(slotFits(slots.at(-1)!, 1, s, [])).toBe(true);
  });
  it("monday is off by default", () => {
    expect(isDayOff("2030-01-07", s)).toBe(true);
    expect(isDayOff("2030-01-08", s)).toBe(false);
  });
  it("parses limit error", () => {
    expect(parseLimitError("limit reached 2030-01-02T07:00:00Z")?.toISOString()).toBe("2030-01-02T07:00:00.000Z");
  });
});
