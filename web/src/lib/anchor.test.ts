import { describe, expect, test } from "vitest";
import { buildSep24Memo, isSep24TerminalStatus, isSep24WithdrawReady } from "./anchor";

describe("SEP-24 withdrawal helpers", () => {
  test("builds text memos by default", () => {
    const memo = buildSep24Memo({ withdrawMemo: "shunt-demo", withdrawMemoType: "text" });

    expect(memo?.type).toBe("text");
    expect(memo?.value?.toString()).toBe("shunt-demo");
  });

  test("builds id memos when the anchor requests an id memo", () => {
    const memo = buildSep24Memo({ withdrawMemo: "123456", withdrawMemoType: "id" });

    expect(memo?.type).toBe("id");
    expect(memo?.value?.toString()).toBe("123456");
  });

  test("treats pending_user_transfer_start as ready for the wallet payment", () => {
    expect(isSep24WithdrawReady("pending_user_transfer_start")).toBe(true);
    expect(isSep24WithdrawReady("pending_anchor")).toBe(false);
  });

  test("identifies terminal SEP-24 statuses", () => {
    expect(isSep24TerminalStatus("completed")).toBe(true);
    expect(isSep24TerminalStatus("expired")).toBe(true);
    expect(isSep24TerminalStatus("error")).toBe(true);
    expect(isSep24TerminalStatus("pending_user_transfer_start")).toBe(false);
  });
});
