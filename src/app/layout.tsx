import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, DM_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });
// Only for the flower's thought bubble on the Beet.
const caveat = Caveat({ subsets: ["latin"], weight: ["600"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "Date-O-Mat",
  description: "Damit aus „wir sollten mal wieder …“ ein echtes Date wird.",
  applicationName: "Date-O-Mat",
  appleWebApp: { capable: true, title: "Date-O-Mat", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // An installed app does not pinch-zoom; form fields are 16px+, so iOS never zooms into them either.
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Android: shrink the layout when the keyboard opens, so bottom sheets stay visible.
  interactiveWidget: "resizes-content",
  // The whole app is dark (Garten).
  themeColor: "#111a14",
  colorScheme: "dark",
};


export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" data-theme="dark" className={`${bricolage.variable} ${dmMono.variable} ${caveat.variable} antialiased`}>
      <body className="min-h-dvh">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
