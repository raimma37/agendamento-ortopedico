import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Agendamento Ortopédico — Especialidade em Joelho",
  description:
    "Sistema de agendamento por ordem de chegada e cotas de atendimento para consultório ortopédico.",
  other: {
    "darkreader-lock": "true",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#12102b",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.className}>
      <body className="min-h-screen bg-[#12102b] text-[#f1f0ff] antialiased overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
