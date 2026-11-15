import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";
import { POST } from "./route";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  STRIPE_API_VERSION: "2026-10-28.endive",
  stripe: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    subscriptions: {
      retrieve: vi.fn(),
    },
  },
}));

function createWebhookEventsTableMock({
  insertResult,
  selectResult,
  updateResults,
}: {
  insertResult: { error: { code?: string; message: string } | null };
  selectResult?: { data: Record<string, unknown> | null; error: { message: string } | null };
  updateResults?: Array<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
}) {
  const insert = vi.fn().mockResolvedValue(insertResult);

  const selectBuilder = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(selectResult ?? { data: null, error: null }),
  };
  const select = vi.fn().mockReturnValue(selectBuilder);

  const updateQueue = [...(updateResults ?? [])];
  const updateBuilder = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(() =>
      Promise.resolve(updateQueue.shift() ?? { data: null, error: null })
    ),
  };
  const update = vi.fn().mockReturnValue(updateBuilder);

  const deleteBuilder = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ error: null }),
  };
  const del = vi.fn().mockReturnValue(deleteBuilder);

  return {
    insert,
    select,
    selectBuilder,
    update,
    updateBuilder,
    del,
    deleteBuilder,
  };
}

function createSubscriptionsTableMock(updateResult: { error: { message: string } | null } = { error: null }) {
  const updateBuilder = {
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockResolvedValue(updateResult),
  };
  const update = vi.fn().mockReturnValue(updateBuilder);
  return { update, updateBuilder };
}

function mockAdminClient(
  createAdminClientMock: ReturnType<typeof vi.mocked<typeof createAdminClient>>,
  eventsTable: ReturnType<typeof createWebhookEventsTableMock>,
  subscriptionsTable?: ReturnType<typeof createSubscriptionsTableMock>
) {
  createAdminClientMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "stripe_webhook_events") {
        return {
          insert: eventsTable.insert,
          select: eventsTable.select,
          update: eventsTable.update,
          delete: eventsTable.del,
        };
      }

      if (table === "subscriptions" && subscriptionsTable) {
        return { update: subscriptionsTable.update };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as ReturnType<typeof createAdminClient>);
}

// Endive-shaped subscription: the billing period lives on the item only.
const PERIOD_END_SECONDS = 1790350444;
const PERIOD_END_ISO = new Date(PERIOD_END_SECONDS * 1000).toISOString();

function endiveSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    status: "active",
    items: { data: [{ id: "si_1", current_period_end: PERIOD_END_SECONDS }] },
    ...overrides,
  };
}

describe("POST /api/webhooks/stripe", () => {
  const headersMock = vi.mocked(headers);
  const createAdminClientMock = vi.mocked(createAdminClient);
  const constructEventMock = vi.mocked(stripe.webhooks.constructEvent);
  const retrieveSubscriptionMock = vi.mocked(stripe.subscriptions.retrieve);
  const originalWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    if (originalWebhookSecret === undefined) {
      delete process.env.STRIPE_WEBHOOK_SECRET;
    } else {
      process.env.STRIPE_WEBHOOK_SECRET = originalWebhookSecret;
    }
  });

  it("returns 503 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const response = await POST(
      new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "Stripe webhook is not configured",
    });
    expect(headersMock).not.toHaveBeenCalled();
  });

  it("continues normal validation flow when webhook secret is configured", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    headersMock.mockResolvedValue(new Headers());

    const response = await POST(
      new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "No signature" });
    expect(headersMock).toHaveBeenCalledTimes(1);
  });

  it("processes event and marks it as processed when claim succeeds", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    headersMock.mockResolvedValue(new Headers({ "stripe-signature": "sig" }));
    constructEventMock.mockReturnValue({
      id: "evt_1",
      type: "invoice.created",
    } as never);

    const eventsTable = createWebhookEventsTableMock({
      insertResult: { error: null },
      updateResults: [{ data: { event_id: "evt_1" }, error: null }],
    });

    createAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "stripe_webhook_events") {
          return {
            insert: eventsTable.insert,
            select: eventsTable.select,
            update: eventsTable.update,
            delete: eventsTable.del,
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(eventsTable.insert).toHaveBeenCalledTimes(1);
    expect(eventsTable.update).toHaveBeenCalledTimes(1);
  });

  it("skips duplicate event when existing record is already processed", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    headersMock.mockResolvedValue(new Headers({ "stripe-signature": "sig" }));
    constructEventMock.mockReturnValue({
      id: "evt_dup",
      type: "invoice.created",
    } as never);

    const eventsTable = createWebhookEventsTableMock({
      insertResult: { error: { code: "23505", message: "duplicate key value" } },
      selectResult: {
        data: {
          status: "processed",
          processed_at: new Date().toISOString(),
          last_attempt_at: new Date().toISOString(),
        },
        error: null,
      },
    });

    createAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "stripe_webhook_events") {
          return {
            insert: eventsTable.insert,
            select: eventsTable.select,
            update: eventsTable.update,
            delete: eventsTable.del,
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as unknown as ReturnType<typeof createAdminClient>);

    const response = await POST(
      new Request("https://example.com/api/webhooks/stripe", {
        method: "POST",
        body: "{}",
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, skipped: true });
    expect(eventsTable.select).toHaveBeenCalledTimes(1);
    expect(eventsTable.update).not.toHaveBeenCalled();
  });

  describe("subscription period end", () => {
    it("should activate the user from the item period end on checkout.session.completed", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      headersMock.mockResolvedValue(new Headers({ "stripe-signature": "sig" }));
      constructEventMock.mockReturnValue({
        id: "evt_checkout",
        type: "checkout.session.completed",
        api_version: "2026-10-28.endive",
        data: {
          object: { metadata: { userId: "user_1" }, subscription: "sub_1", customer: "cus_1" },
        },
      } as never);
      retrieveSubscriptionMock.mockResolvedValue(endiveSubscription() as never);

      const eventsTable = createWebhookEventsTableMock({
        insertResult: { error: null },
        updateResults: [{ data: { event_id: "evt_checkout" }, error: null }],
      });
      const subscriptionsTable = createSubscriptionsTableMock();
      mockAdminClient(createAdminClientMock, eventsTable, subscriptionsTable);

      const response = await POST(
        new Request("https://example.com/api/webhooks/stripe", { method: "POST", body: "{}" })
      );

      expect(response.status).toBe(200);
      expect(retrieveSubscriptionMock).toHaveBeenCalledWith("sub_1");
      expect(subscriptionsTable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "active",
          plan: "pro",
          provider_subscription_id: "sub_1",
          provider_customer_id: "cus_1",
          current_period_end: PERIOD_END_ISO,
        })
      );
      expect(subscriptionsTable.updateBuilder.eq).toHaveBeenCalledWith("user_id", "user_1");
      expect(subscriptionsTable.updateBuilder.or).toHaveBeenCalledWith(
        `current_period_end.is.null,current_period_end.lt.${PERIOD_END_ISO}`
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it("should update status and period end from the item on customer.subscription.updated", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      headersMock.mockResolvedValue(new Headers({ "stripe-signature": "sig" }));
      constructEventMock.mockReturnValue({
        id: "evt_updated",
        type: "customer.subscription.updated",
        api_version: "2026-10-28.endive",
        data: { object: endiveSubscription({ status: "past_due" }) },
      } as never);

      const eventsTable = createWebhookEventsTableMock({
        insertResult: { error: null },
        updateResults: [{ data: { event_id: "evt_updated" }, error: null }],
      });
      const subscriptionsTable = createSubscriptionsTableMock();
      mockAdminClient(createAdminClientMock, eventsTable, subscriptionsTable);

      const response = await POST(
        new Request("https://example.com/api/webhooks/stripe", { method: "POST", body: "{}" })
      );

      expect(response.status).toBe(200);
      expect(retrieveSubscriptionMock).not.toHaveBeenCalled();
      expect(subscriptionsTable.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "past_due", current_period_end: PERIOD_END_ISO })
      );
      expect(subscriptionsTable.updateBuilder.eq).toHaveBeenCalledWith(
        "provider_subscription_id",
        "sub_1"
      );
    });

    it("should fail the event and release the claim when no item carries a period end", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      headersMock.mockResolvedValue(new Headers({ "stripe-signature": "sig" }));
      constructEventMock.mockReturnValue({
        id: "evt_no_period",
        type: "customer.subscription.updated",
        api_version: "2026-10-28.endive",
        data: { object: endiveSubscription({ items: { data: [] } }) },
      } as never);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const eventsTable = createWebhookEventsTableMock({ insertResult: { error: null } });
      const subscriptionsTable = createSubscriptionsTableMock();
      mockAdminClient(createAdminClientMock, eventsTable, subscriptionsTable);

      const response = await POST(
        new Request("https://example.com/api/webhooks/stripe", { method: "POST", body: "{}" })
      );

      expect(response.status).toBe(500);
      expect(subscriptionsTable.update).not.toHaveBeenCalled();
      expect(eventsTable.del).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Webhook handler error:",
        expect.objectContaining({ message: expect.stringContaining("no item period end") })
      );
      errorSpy.mockRestore();
    });
  });

  describe("webhook endpoint API version drift", () => {
    it("should warn with the event and both versions when the endpoint renders another version", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      headersMock.mockResolvedValue(new Headers({ "stripe-signature": "sig" }));
      constructEventMock.mockReturnValue({
        id: "evt_drift",
        type: "customer.subscription.updated",
        api_version: "2025-12-15.clover",
        data: { object: endiveSubscription() },
      } as never);

      const eventsTable = createWebhookEventsTableMock({
        insertResult: { error: null },
        updateResults: [{ data: { event_id: "evt_drift" }, error: null }],
      });
      const subscriptionsTable = createSubscriptionsTableMock();
      mockAdminClient(createAdminClientMock, eventsTable, subscriptionsTable);

      const response = await POST(
        new Request("https://example.com/api/webhooks/stripe", { method: "POST", body: "{}" })
      );

      expect(response.status).toBe(200);
      expect(warnSpy).toHaveBeenCalledWith(
        "Stripe webhook endpoint API version differs from the SDK pin",
        {
          eventId: "evt_drift",
          eventType: "customer.subscription.updated",
          endpointApiVersion: "2025-12-15.clover",
          sdkApiVersion: "2026-10-28.endive",
        }
      );
      expect(subscriptionsTable.update).toHaveBeenCalledTimes(1);
    });

    it("should stay silent when the endpoint version matches the SDK pin", async () => {
      process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
      headersMock.mockResolvedValue(new Headers({ "stripe-signature": "sig" }));
      constructEventMock.mockReturnValue({
        id: "evt_match",
        type: "invoice.created",
        api_version: "2026-10-28.endive",
      } as never);

      const eventsTable = createWebhookEventsTableMock({
        insertResult: { error: null },
        updateResults: [{ data: { event_id: "evt_match" }, error: null }],
      });
      mockAdminClient(createAdminClientMock, eventsTable);

      const response = await POST(
        new Request("https://example.com/api/webhooks/stripe", { method: "POST", body: "{}" })
      );

      expect(response.status).toBe(200);
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});
