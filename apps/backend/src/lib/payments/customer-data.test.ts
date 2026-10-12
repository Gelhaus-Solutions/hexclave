import type { PrismaClientTransaction } from "@/prisma-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getItemQuantitiesForCustomer, getItemQuantityForCustomer, getOwnedProductsForCustomer, getSubscriptionMapForCustomer } from "./customer-data";

// The reads never touch Prisma; they take it only for signature parity with the legacy readers.
const prisma = {} as PrismaClientTransaction;
const customer = { prisma, tenancyId: "tenancy-id", customerType: "user", customerId: "customer-id" } as const;

function respondWith(body: unknown) {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("HEXCLAVE_BULLDOZER_SERVER_SECRET", "test-secret");
  vi.stubEnv("HEXCLAVE_BULLDOZER_SERVER_URL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("customer reads on a deployment without a bulldozer server", () => {
  it("answer empty without asking the ledger", async () => {
    vi.stubEnv("HEXCLAVE_BULLDOZER_SERVER_DISABLED", "true");
    const fetchMock = respondWith({});

    await expect(getOwnedProductsForCustomer(customer)).resolves.toEqual({});
    await expect(getItemQuantitiesForCustomer(customer)).resolves.toEqual({});
    await expect(getItemQuantityForCustomer({ ...customer, itemId: "seats" })).resolves.toBe(0);
    await expect(getSubscriptionMapForCustomer(customer)).resolves.toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("read the ledger when it is deployed", async () => {
    vi.stubEnv("HEXCLAVE_BULLDOZER_SERVER_DISABLED", "false");
    const fetchMock = respondWith({
      ownedProducts: { pro: { quantity: 1 } },
      itemQuantities: { seats: 3 },
      subscriptions: { "sub-id": { id: "sub-id" } },
    });

    await expect(getOwnedProductsForCustomer(customer)).resolves.toEqual({ pro: { quantity: 1 } });
    await expect(getItemQuantityForCustomer({ ...customer, itemId: "seats" })).resolves.toBe(3);
    await expect(getSubscriptionMapForCustomer(customer)).resolves.toEqual({ "sub-id": { id: "sub-id" } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
