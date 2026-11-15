import Stripe from "stripe";

let stripeClient: Stripe | null = null;

/**
 * The Stripe API version every outbound request is made under.
 *
 * `satisfies Stripe.LatestApiVersion` is a deliberate tripwire: an SDK release
 * that moves the SDK's latest version fails typecheck here instead of
 * silently changing response shapes on the billing path. Adopting a new
 * version is a reviewed change — diff the release's breaking changes against
 * `src/app/api/webhooks/stripe/route.ts`, then re-create the webhook endpoint
 * on the same version after the code deploys (its `api_version` is create-only
 * and independent of this constant; the route warns on every event where the
 * two differ).
 */
export const STRIPE_API_VERSION = "2026-10-28.endive" satisfies Stripe.LatestApiVersion;

export function getStripe(): Stripe {
  if (!stripeClient) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return stripeClient;
}

// Legacy export for backwards compatibility
export const stripe = {
  get customers() {
    return getStripe().customers;
  },
  get checkout() {
    return getStripe().checkout;
  },
  get billingPortal() {
    return getStripe().billingPortal;
  },
  get subscriptions() {
    return getStripe().subscriptions;
  },
  get webhooks() {
    return getStripe().webhooks;
  },
};

export const STRIPE_CONFIG = {
  priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ?? "",
  productName: "Unicon Pro",
  price: 29,
  currency: "usd",
  interval: "year" as const,
};

export async function createOrRetrieveCustomer(
  userId: string,
  email: string,
  name?: string | null
): Promise<string> {
  const client = getStripe();
  
  // Search for existing customer by email
  const existingCustomers = await client.customers.list({
    email,
    limit: 1,
  });

  const existingCustomer = existingCustomers.data[0];
  if (existingCustomer) {
    // Update metadata if needed
    if (existingCustomer.metadata?.userId !== userId) {
      await client.customers.update(existingCustomer.id, {
        metadata: { userId },
      });
    }
    return existingCustomer.id;
  }

  // Create new customer with idempotency key to prevent duplicates
  // from concurrent requests for the same user
  const customerParams: Stripe.CustomerCreateParams = {
    email,
    metadata: { userId },
  };

  if (name) {
    customerParams.name = name;
  }

  const customer = await client.customers.create(customerParams, {
    idempotencyKey: `create-customer-${userId}`,
  });

  return customer.id;
}
