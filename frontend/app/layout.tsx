import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CircleGA — Genetic Algorithm Circle Detector",
  description: "Detección de círculos mediante algoritmos genéticos (Ayala-Ramírez et al., 2006)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
