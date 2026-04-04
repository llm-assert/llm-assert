"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  console.error("[global-error]", error);

  return (
    <html lang="en">
      <body>
        <title>Error - LLMAssert</title>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "system-ui, sans-serif",
            gap: "16px",
            padding: "16px",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ color: "#666", fontSize: "14px", margin: 0 }}>
            An unexpected error occurred. Please try again.
          </p>
          <button
            type="button"
            onClick={unstable_retry}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              fontWeight: 500,
              borderRadius: "6px",
              border: "1px solid #ccc",
              backgroundColor: "#fff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
