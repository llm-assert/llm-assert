import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      nav={{
        title: "LLMAssert",
        url: "https://llmassert.com",
      }}
      links={[
        {
          text: "Dashboard",
          url: "https://llmassert.com",
          external: true,
        },
        {
          text: "GitHub",
          url: "https://github.com/llm-assert/llm-assert",
          external: true,
        },
        {
          text: "npm",
          url: "https://www.npmjs.com/package/@llmassert/playwright",
          external: true,
        },
      ]}
      sidebar={{ defaultOpenLevel: 1 }}
    >
      {children}
    </DocsLayout>
  );
}
