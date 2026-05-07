"use client";

import { usePathname } from "next/navigation";

export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (/^\/(es|en)(\/(auth|privacy|terms)(\/.*)?)?\/?$/.test(pathname)) return null;
  return <>{children}</>;
}
