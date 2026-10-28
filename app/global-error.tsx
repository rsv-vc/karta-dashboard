"use client";

// Last-resort error page when the root layout itself fails. It renders its own
// document without the app's stylesheet, so the brand colours are inline and it
// follows the OS light/dark preference.
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          background: "light-dark(#fbfaf6, #25241f)",
          color: "light-dark(#25241f, #f5f3ee)",
          colorScheme: "light dark",
        }}
      >
        <title>Something went wrong · Karta Lead Tracker</title>
        <main role="alert" style={{ maxWidth: 360, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 20px", opacity: 0.75, lineHeight: 1.5 }}>
            Karta could not load. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              font: "inherit",
              fontWeight: 600,
              padding: "10px 18px",
              borderRadius: 10,
              border: 0,
              cursor: "pointer",
              background: "light-dark(#25241f, #f05a28)",
              color: "light-dark(#fbfaf6, #25241f)",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
