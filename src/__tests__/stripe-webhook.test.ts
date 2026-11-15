import { describe, expect, it } from "vitest";
import {
  getEndpointApiVersionDrift,
  getSubscriptionPeriodEnd,
  mapStripeSubscriptionStatus,
} from "@/lib/stripe-webhook";

describe("mapStripeSubscriptionStatus", () => {
  it("maps active and trialing to active", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("active");
  });

  it("maps billing-problem states to past_due", () => {
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("paused")).toBe("past_due");
  });

  it("maps terminal states to canceled", () => {
    expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
    expect(mapStripeSubscriptionStatus("incomplete_expired")).toBe("canceled");
  });

  it("should hold an unrecognised status at past_due instead of granting or revoking", () => {
    expect(mapStripeSubscriptionStatus("some_future_status")).toBe("past_due");
  });
});

describe("getSubscriptionPeriodEnd", () => {
  it("should read the period end from the subscription item, not the subscription", () => {
    const subscription = {
      current_period_end: 1,
      items: { data: [{ current_period_end: 1790350444 }] },
    } as never;

    expect(getSubscriptionPeriodEnd(subscription)).toBe(1790350444);
  });

  it("should return the latest item period end when a subscription has several items", () => {
    const subscription = {
      items: {
        data: [
          { current_period_end: 1790350444 },
          { current_period_end: 1795000000 },
          { current_period_end: 1780000000 },
        ],
      },
    } as never;

    expect(getSubscriptionPeriodEnd(subscription)).toBe(1795000000);
  });

  it("should return null when no item carries a period end", () => {
    expect(getSubscriptionPeriodEnd({ items: { data: [] } } as never)).toBeNull();
    expect(getSubscriptionPeriodEnd({ items: { data: [{}] } } as never)).toBeNull();
    expect(getSubscriptionPeriodEnd({} as never)).toBeNull();
  });
});

describe("getEndpointApiVersionDrift", () => {
  it("should report the event whose payload was rendered under another version", () => {
    expect(
      getEndpointApiVersionDrift(
        { id: "evt_1", type: "customer.subscription.updated", api_version: "2025-12-15.clover" },
        "2026-10-28.endive"
      )
    ).toEqual({
      eventId: "evt_1",
      eventType: "customer.subscription.updated",
      endpointApiVersion: "2025-12-15.clover",
      sdkApiVersion: "2026-10-28.endive",
    });
  });

  it("should treat a missing api_version as drift rather than a match", () => {
    expect(
      getEndpointApiVersionDrift(
        { id: "evt_2", type: "checkout.session.completed", api_version: null },
        "2026-10-28.endive"
      )
    ).toMatchObject({ endpointApiVersion: null });
  });

  it("should return null when the endpoint and SDK versions agree", () => {
    expect(
      getEndpointApiVersionDrift(
        { id: "evt_3", type: "checkout.session.completed", api_version: "2026-10-28.endive" },
        "2026-10-28.endive"
      )
    ).toBeNull();
  });
});
