import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const response = intlMiddleware(request) ?? NextResponse.next();
  return updateSession(request, response);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
