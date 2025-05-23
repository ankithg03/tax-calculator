import type { Metadata } from "next";
import { Inter, Maven_Pro, Quicksand } from "next/font/google";
import "./globals.css";
import Navigation from "@/components/Navigation";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mavenPro = Maven_Pro({ 
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-maven-pro"
});
const quicksand = Quicksand({ 
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins"
});

export const metadata: Metadata = {
  title: "Income Tax Calculator FY 2025-26",
  description: "Calculate your income tax for FY 2025-26 with both old and new regime options",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${mavenPro.variable} ${quicksand.variable} font-sans`}>
        <Navigation />
        {children}
      </body>
    </html>
  );
}
