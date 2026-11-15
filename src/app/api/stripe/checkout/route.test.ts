import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createClient } from "@/lib/supabase/server";
import { createOrRetrieveCustomer, stripe } from "@/lib/stripe";
import { logger } from "@/lib/logger";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: vi.fn(),
        expire: vi.fn(),
      },
    },
  },
  STRIPE_CONFIG: {
    priceId: "price_test_123",
  },
  createOrRetrieveCustomer: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function mockAuthenticatedUser({
  user,
  subscription,
}: {
  user: { id: string; email?: string | null; user_metadata?: { full_name?: string | null } };
  subscription: { plan: string; status: string } | null;
}) {
  const single = vi.fn().mockResolvedValue({ data: subscription, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  return { from };
}

describe("POST /api/stripe/checkout", () => {
  const createOrRetrieveCustomerMock = vi.mocked(createOrRetrieveCustomer);
  const checkoutSessionCreateMock = vi.mocked(stripe.checkout.sessions.create);
  const checkoutSessionExpireMock = vi.mocked(stripe.checkout.sessions.expire);
  const loggerErrorMock = vi.mocked(logger.error);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 when authenticated user has no email", async () => {
    const { from } = mockAuthenticatedUser({
      user: { id: "user_1", email: null, user_metadata: { full_name: "No Email User" } },
      subscription: null,
    });

    const response = await POST();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_request",
      message: "Account email is required to start checkout",
    });
    expect(from).toHaveBeenCalledWith("subscriptions");
    expect(createOrRetrieveCustomerMock).not.toHaveBeenCalled();
    expect(checkoutSessionCreateMock).not.toHaveBeenCalled();
  });

  it("uses allowed payment methods when creating a checkout session", async () => {
    mockAuthenticatedUser({
      user: {
        id: "user_2",
        email: "pro@example.com",
        user_metadata: { full_name: "Stripe Success User" },
      },
      subscription: null,
    });

    createOrRetrieveCustomerMock.mockResolvedValue("cus_test_123");
    checkoutSessionCreateMock.mockResolvedValue({
      id: "cs_test",
      payment_method_types: ["card"],
      url: "https://checkout.stripe.com/c/pay_test",
    } as never);

    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://checkout.stripe.com/c/pay_test",
    });
    expect(checkoutSessionCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_test_123",
        mode: "subscription",
        allowed_payment_method_types: ["card"],
      })
    );
    expect(checkoutSessionCreateMock.mock.calls[0]?.[0]).not.toHaveProperty("payment_method_types");
  });

  it("returns controlled 500 response when Stripe filters card out of the session", async () => {
    mockAuthenticatedUser({
      user: {
        id: "user_2",
        email: "pro@example.com",
        user_metadata: { full_name: "Filtered Card User" },
      },
      subscription: null,
    });

    createOrRetrieveCustomerMock.mockResolvedValue("cus_test_123");
    checkoutSessionCreateMock.mockResolvedValue({
      id: "cs_filtered",
      payment_method_types: [],
      url: "https://checkout.stripe.com/c/filtered",
    } as never);

    const expireError = new Error("Session is already expired");
    checkoutSessionExpireMock.mockRejectedValue(expireError);

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to create checkout session",
    });
    expect(loggerErrorMock).toHaveBeenCalledWith("Stripe checkout session rejected card", {
      sessionId: "cs_filtered",
      paymentMethodTypes: [],
    });
    expect(checkoutSessionExpireMock).toHaveBeenCalledWith("cs_filtered");
    expect(logger.warn).toHaveBeenCalledWith("Failed to expire rejected Stripe checkout session", {
      sessionId: "cs_filtered",
      error: expireError,
    });
  });

  it("expires a card-less session without changing the controlled 500 response", async () => {
    mockAuthenticatedUser({
      user: {
        id: "user_2",
        email: "pro@example.com",
        user_metadata: { full_name: "Expired Session User" },
      },
      subscription: null,
    });

    createOrRetrieveCustomerMock.mockResolvedValue("cus_test_123");
    checkoutSessionCreateMock.mockResolvedValue({
      id: "cs_expired",
      payment_method_types: [],
      url: "https://checkout.stripe.com/c/expired",
    } as never);
    checkoutSessionExpireMock.mockResolvedValue({ id: "cs_expired" } as never);

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to create checkout session",
    });
    expect(checkoutSessionExpireMock).toHaveBeenCalledWith("cs_expired");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("returns controlled 500 response when Stripe checkout call fails", async () => {
    mockAuthenticatedUser({
      user: {
        id: "user_2",
        email: "pro@example.com",
        user_metadata: { full_name: "Stripe Failure User" },
      },
      subscription: null,
    });

    createOrRetrieveCustomerMock.mockResolvedValue("cus_test_123");
    const stripeError = new Error("Stripe API unavailable");
    checkoutSessionCreateMock.mockRejectedValue(stripeError);

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to create checkout session",
    });
    expect(createOrRetrieveCustomerMock).toHaveBeenCalledWith(
      "user_2",
      "pro@example.com",
      "Stripe Failure User"
    );
    expect(loggerErrorMock).toHaveBeenCalledWith("Stripe checkout error:", stripeError);
  });
});
