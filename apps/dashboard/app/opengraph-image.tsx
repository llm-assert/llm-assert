import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "LLMAssert — LLM-Powered Assertions for Playwright";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  const geistSemiBold = await readFile(
    join(process.cwd(), "public/fonts/Geist-SemiBold.ttf"),
  );
  const geistMono = await readFile(
    join(process.cwd(), "public/fonts/GeistMono-Medium.ttf"),
  );

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background:
          "linear-gradient(135deg, #09090b 0%, #18181b 50%, #09090b 100%)",
        padding: "60px 80px",
        fontFamily: "Geist",
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          background: "linear-gradient(90deg, #3b82f6, #8b5cf6, #3b82f6)",
        }}
      />

      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <span
          style={{
            fontSize: "64px",
            fontWeight: 600,
            color: "#fafafa",
            letterSpacing: "-0.02em",
          }}
        >
          LLMAssert
        </span>
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: "28px",
          color: "#a1a1aa",
          marginBottom: "48px",
          textAlign: "center",
        }}
      >
        LLM-Powered Assertions for Playwright
      </div>

      {/* Code snippet */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          background: "#1c1c1e",
          border: "1px solid #27272a",
          borderRadius: "12px",
          padding: "24px 32px",
          width: "720px",
          fontFamily: "GeistMono",
        }}
      >
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#3f3f46",
            }}
          />
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#3f3f46",
            }}
          />
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#3f3f46",
            }}
          />
        </div>
        <div
          style={{
            fontSize: "20px",
            lineHeight: 1.6,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>
            <span style={{ color: "#c084fc" }}>expect</span>
            <span style={{ color: "#a1a1aa" }}>(response).</span>
            <span style={{ color: "#60a5fa" }}>toBeGroundedIn</span>
            <span style={{ color: "#a1a1aa" }}>(context)</span>
          </span>
          <span>
            <span style={{ color: "#c084fc" }}>expect</span>
            <span style={{ color: "#a1a1aa" }}>(output).</span>
            <span style={{ color: "#60a5fa" }}>toBeFreeOfPII</span>
            <span style={{ color: "#a1a1aa" }}>()</span>
          </span>
          <span>
            <span style={{ color: "#c084fc" }}>expect</span>
            <span style={{ color: "#a1a1aa" }}>(reply).</span>
            <span style={{ color: "#60a5fa" }}>toMatchTone</span>
            <span style={{ color: "#a1a1aa" }}>(</span>
            <span style={{ color: "#4ade80" }}>&quot;professional&quot;</span>
            <span style={{ color: "#a1a1aa" }}>)</span>
          </span>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Geist",
          data: geistSemiBold,
          style: "normal",
          weight: 600,
        },
        {
          name: "GeistMono",
          data: geistMono,
          style: "normal",
          weight: 500,
        },
      ],
    },
  );
}
