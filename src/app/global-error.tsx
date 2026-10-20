"use client";

// Last resort when even the root layout fails: no app styles available, so inline only.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#eef2e6",
          color: "#163a22",
        }}
      >
        <title>Date-O-Mat</title>
        <p style={{ fontSize: 48, margin: 0 }}>🙈</p>
        <h1 style={{ margin: 0 }}>Hoppla!</h1>
        <p style={{ margin: 0, fontWeight: 600 }}>Der Date-O-Mat hakt gerade. Versuch es gleich nochmal.</p>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            font: "inherit",
            fontWeight: 700,
            padding: "14px 24px",
            border: "0",
            borderRadius: 999,
            background: "#163a22",
            color: "#ffffff",
          }}
        >
          Nochmal versuchen
        </button>
      </body>
    </html>
  );
}
