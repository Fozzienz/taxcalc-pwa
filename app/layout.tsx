import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ViewportLock } from "@/components/ViewportLock";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TaxTrack — Australian Tax & EOFY Calculator",
  description:
    "A private Australian end-of-financial-year organiser for working-from-home hours, receipts, and deduction totals before you lodge in ATO myTax. Records are encrypted on this device before they are stored.",
  applicationName: "TaxTrack",
  appleWebApp: {
    capable: true,
    title: "TaxTrack",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#070c18",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('taxtrack_theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';var s=localStorage.getItem('taxtrack_text_scale');document.documentElement.style.fontSize=s==='small'?'14px':s==='large'?'18px':'16px';}catch(e){document.documentElement.classList.add('dark');}})();`,
          }}
        />
      </head>
      <body className={`${inter.className} min-h-full bg-ink font-sans text-paper antialiased`}>
        <ViewportLock />
        {children}
      </body>
    </html>
  );
}
