import { NextResponse, type NextRequest } from "next/server";
import { trackServerEvent } from "@/lib/analytics/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null): string {
  if (!value) return "/es/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/es/dashboard";
  if (!/^\/(es|en)(\/|$)/.test(value)) return "/es/dashboard";
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const source = searchParams.get("source");
  const plan = searchParams.get("plan");
  const locale = next.startsWith("/en/") || next === "/en" ? "en" : "es";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (source === "signup") {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await trackServerEvent({
          eventName: "signup_completed",
          locale,
          userId: user?.id ?? null,
          props: {
            method: "google",
            plan: plan === "monthly" || plan === "annual" ? plan : null,
          },
        });
      }
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/es/auth/sign-in", origin));
}
