import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, STRIPE_CONFIG, createOrRetrieveCustomer } from "@/lib/stripe";
import { logger } from "@/lib/logger";

export async function POST() {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if already subscribed
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", user.id)
    .single();

  if (subscription?.plan === "pro" && subscription?.status === "active") {
    return NextResponse.json({ error: "Already subscribed to Pro" }, { status: 400 });
  }

  if (!user.email) {
    return NextResponse.json(
      { error: "invalid_request", message: "Account email is required to start checkout" },
      { status: 400 }
    );
  }

  try {
    // Get or create Stripe customer
    const customerId = await createOrRetrieveCustomer(
      user.id,
      user.email,
      user.user_metadata?.full_name
    );

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      allowed_payment_method_types: ["card"],
      line_items: [
        {
          price: STRIPE_CONFIG.priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/bundles?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pricing?canceled=true`,
      subscription_data: {
        metadata: {
          userId: user.id,
        },
      },
      metadata: {
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    logger.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
