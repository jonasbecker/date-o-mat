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
          background: "#fff6ec",
          color: "#2a1b3d",
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
            borderRadius: 18,
            border: "2.5px solid #2a1b3d",
            boxShadow: "3px 3px 0 #2a1b3d",
            background: "#ff4f8b",
            color: "#2a1b3d",
          }}
        >
          Nochmal versuchen
        </button>
      </body>
    </html>
  );
}
