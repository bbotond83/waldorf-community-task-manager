import { describe, expect, it, test, beforeEach } from "vitest";
import nativeTest, * as adapter from "./support/node-test-adapter";

describe("native domain scheduling compatibility", () => {
  it("uses real runner APIs rather than replacing assertions", () => {
    expect(nativeTest).toBe(test);
    expect(adapter.it).toBe(it);
    expect(adapter.describe).toBe(describe);
    expect(adapter.beforeEach).toBe(beforeEach);
  });
  it("awaits async callbacks", async () => {
    const callback = async () => {
      await Promise.resolve();
      return "completed";
    };
    expect(await callback()).toBe("completed");
  });
  it("preserves thrown assertion failures", () => {
    expect(() => expect("actual").toBe("incorrect")).toThrow();
  });
});
