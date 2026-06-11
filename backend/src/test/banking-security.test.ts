import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAccountFindMany,
  mockAccountFindFirst,
  mockAccountUpdate,
  mockTxCreate,
  mockAuditCreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockAccountFindMany: vi.fn(),
  mockAccountFindFirst: vi.fn(),
  mockAccountUpdate: vi.fn(),
  mockTxCreate: vi.fn(),
  mockAuditCreate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    bankAccount: {
      findMany: mockAccountFindMany,
      findFirst: mockAccountFindFirst,
      update: mockAccountUpdate,
    },
    auditLog: { create: mockAuditCreate },
    $transaction: mockTransaction,
  },
}));

vi.mock("../services/nordigen.service.js", () => ({
  getRequisitionStatus: vi.fn(),
  getAccountDetails: vi.fn(),
  maskIban: (iban: string) => iban,
}));

import { importTransactions } from "../services/bank.service.js";
import { handleCallback } from "../services/banking.service.js";
import * as nordigen from "../services/nordigen.service.js";

describe("importTransactions — exact IBAN matching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // $transaction(fn, opts) → execute fn with a tx mock
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        transaction: { create: mockTxCreate },
        bankAccount: { update: mockAccountUpdate },
      })
    );
  });

  it("links transaction on exact IBAN match (case/whitespace-insensitive)", async () => {
    mockAccountFindMany.mockResolvedValue([{ id: 7, iban: "DE89370400440532013000" }]);

    await importTransactions(1, [
      { date: "2026-01-15", description: "Miete", amount: 500, iban: "de89 3704 0044 0532 0130 00" },
    ]);

    expect(mockTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bankAccountId: 7 }),
    });
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { balance: { increment: 500 } },
    });
  });

  it("does NOT link on empty IBAN (regression: contains-match credited arbitrary account)", async () => {
    mockAccountFindMany.mockResolvedValue([{ id: 7, iban: "DE89370400440532013000" }]);

    await importTransactions(1, [
      { date: "2026-01-15", description: "Miete", amount: 500, iban: "" },
    ]);

    expect(mockTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bankAccountId: undefined }),
    });
    expect(mockAccountUpdate).not.toHaveBeenCalled();
  });

  it("does NOT link on partial IBAN substring", async () => {
    mockAccountFindMany.mockResolvedValue([{ id: 7, iban: "DE89370400440532013000" }]);

    await importTransactions(1, [
      { date: "2026-01-15", description: "Miete", amount: 500, iban: "DE89" },
    ]);

    expect(mockTxCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bankAccountId: undefined }),
    });
    expect(mockAccountUpdate).not.toHaveBeenCalled();
  });

  it("writes an audit log entry for the import", async () => {
    mockAccountFindMany.mockResolvedValue([]);

    await importTransactions(1, [
      { date: "2026-01-15", description: "Miete", amount: 500, iban: "" },
    ]);

    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "BANK_CSV_IMPORT", companyId: 1 }),
    });
  });
});

describe("handleCallback — IBAN mismatch must not link a fallback account", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets status=error and redirects with iban_mismatch when no Nordigen account matches", async () => {
    mockAccountFindFirst.mockResolvedValue({
      id: 3,
      companyId: 1,
      iban: "DE89370400440532013000",
      requisitionId: "req-1",
    });
    vi.mocked(nordigen.getRequisitionStatus).mockResolvedValue({
      id: "req-1",
      link: "",
      status: "LN",
      accounts: ["acc-a", "acc-b"],
    });
    vi.mocked(nordigen.getAccountDetails).mockResolvedValue({
      iban: "DE00000000000000000000",
      currency: "EUR",
    });

    const redirect = await handleCallback("req-1");

    expect(redirect).toContain("error=iban_mismatch");
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { status: "error" },
    });
    // Must never link a non-matching account
    expect(mockAccountUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ nordigenAccountId: expect.any(String) }),
      })
    );
  });

  it("links the account whose IBAN matches", async () => {
    mockAccountFindFirst.mockResolvedValue({
      id: 3,
      companyId: 1,
      iban: "DE89370400440532013000",
      requisitionId: "req-1",
    });
    vi.mocked(nordigen.getRequisitionStatus).mockResolvedValue({
      id: "req-1",
      link: "",
      status: "LN",
      accounts: ["acc-a", "acc-b"],
    });
    vi.mocked(nordigen.getAccountDetails)
      .mockResolvedValueOnce({ iban: "DE00000000000000000000", currency: "EUR" })
      .mockResolvedValueOnce({ iban: "DE89370400440532013000", currency: "EUR" });

    const redirect = await handleCallback("req-1");

    expect(redirect).toContain("status=linked");
    expect(mockAccountUpdate).toHaveBeenCalledWith({
      where: { id: 3 },
      data: expect.objectContaining({ status: "connected", nordigenAccountId: "acc-b" }),
    });
  });
});
