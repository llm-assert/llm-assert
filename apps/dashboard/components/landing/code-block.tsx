import { codeToHtml } from "shiki";

// Security note: dangerouslySetInnerHTML is safe here because shiki only
// processes static code strings we control — no user input reaches this path.
export async function CodeBlock({
  code,
  lang = "typescript",
  label,
}: {
  code: string;
  lang?: string;
  label: string;
}) {
  const html = await codeToHtml(code, {
    lang,
    theme: "github-dark",
  });

  return (
    <figure>
      <figcaption className="sr-only">{label}</figcaption>
      <div
        className="overflow-x-auto rounded-lg border bg-zinc-950 p-4 text-sm font-mono"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
