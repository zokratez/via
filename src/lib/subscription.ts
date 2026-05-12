/**
 * Single source of truth for "is this user a paid subscriber?"
 *
 * Returns true when profiles.subscription_tier grants paid-tier access:
 *   - 'pro'             — normal active subscriber
 *   - 'trialing'        — inside the Stripe 7-day reverse-trial window
 *   - 'past_due_grace'  — short grace window after a failed payment
 *
 * Returns false for 'free', null, undefined, or any unknown value.
 *
 * Do not introduce ad-hoc checks against stripe_price_id or against
 * tier literals elsewhere — extend ACTIVE_TIERS instead. The DB CHECK
 * constraint in supabase/migrations/0004_subscription_tier_extended.sql
 * enforces the same set of legal values at write time.
 */

export const ACTIVE_TIERS = ["pro", "trialing", "past_due_grace"] as const;
export type ActiveTier = (typeof ACTIVE_TIERS)[number];

export function isActiveSubscriber(
  tier: string | null | undefined,
): boolean {
  if (!tier) return false;
  return (ACTIVE_TIERS as readonly string[]).includes(tier);
}
