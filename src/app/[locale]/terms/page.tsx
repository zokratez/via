import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import ReactMarkdown from "react-markdown";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "es" ? "Términos de Servicio" : "Terms of Service",
  };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    redirect({ href: "/", locale: routing.defaultLocale });
  }
  setRequestLocale(locale);

  const filepath = path.join(
    process.cwd(),
    "src/content/legal",
    `terms-${locale}.md`,
  );
  const markdown = await fs.readFile(filepath, "utf8");

  return (
    <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-12 md:py-16">
      <ReactMarkdown
        components={{
          h1: (props) => (
            <h1
              className="mt-0 mb-2 text-3xl font-semibold tracking-tight"
              {...props}
            />
          ),
          h2: (props) => (
            <h2
              className="mt-10 mb-3 text-xl font-semibold tracking-tight"
              {...props}
            />
          ),
          h3: (props) => (
            <h3
              className="mt-6 mb-2 text-base font-semibold tracking-tight"
              {...props}
            />
          ),
          p: (props) => (
            <p className="mb-4 leading-relaxed" {...props} />
          ),
          ul: (props) => (
            <ul
              className="mb-4 list-disc space-y-1 pl-6"
              {...props}
            />
          ),
          ol: (props) => (
            <ol
              className="mb-4 list-decimal space-y-1 pl-6"
              {...props}
            />
          ),
          li: (props) => (
            <li className="leading-relaxed" {...props} />
          ),
          a: (props) => (
            <a
              className="underline underline-offset-2 hover:text-muted-foreground"
              {...props}
            />
          ),
          strong: (props) => (
            <strong className="font-semibold" {...props} />
          ),
          hr: (props) => (
            <hr className="my-8 border-border/60" {...props} />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </main>
  );
}
