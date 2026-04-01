import Stripe from "stripe";
import { serverEnv } from "@/lib/env.server";

export const stripe = serverEnv.STRIPE_SECRET_KEY
  ? new Stripe(serverEnv.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia" as Stripe.LatestApiVersion,
    })
  : undefined;

