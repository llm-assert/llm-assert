export function DetailSection({
  label,
  headingLevel = "dt",
  children,
}: {
  label: string;
  headingLevel?: "dt" | "h3" | "h4";
  children: React.ReactNode;
}) {
  const Label = headingLevel as React.ElementType;
  const Content = headingLevel === "dt" ? "dd" : "div";

  return (
    <div>
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </Label>
      <Content className="whitespace-pre-wrap break-words">{children}</Content>
    </div>
  );
}
