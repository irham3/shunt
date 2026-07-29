import { describe, expect, test, vi } from "vitest";

vi.mock("./signer", () => ({
  signTxXdr: vi.fn(),
}));

vi.mock("./stellar", () => ({
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
}));

import { buildSep24Memo, isSep24TerminalStatus, isSep24WithdrawReady } from "./anchor";

describe("SEP-24 withdrawal helpers", () => {
  test("builds text memos by default", () => {
    expect(buildSep24Memo({ withdrawMemo: "shunt-demo", withdrawMemoType: "text" })).toEqual({
      type: "text",
      value: "shunt-demo",
    });
  });

  test("builds id memos when the anchor requests an id memo", () => {
    expect(buildSep24Memo({ withdrawMemo: "123456", withdrawMemoType: "id" })).toEqual({
      type: "id",
      value: "123456",
    });
  });

  test("treats pending_user_transfer_start as ready for wallet payment", () => {
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
