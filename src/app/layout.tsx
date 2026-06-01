// v1.0
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skyla - Flight Search",
  description: "Find the best flights with flexible date search and price calendars",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "rgba(10,10,15,0.8)",
          backdropFilter: "blur(20px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>
            <span className="gold-gradient">Skyla</span>
          </span>
          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginLeft: 4 }}>
            Flight Search
          </span>
        </nav>
        {children}
      </body>
    </html>
  );
}
