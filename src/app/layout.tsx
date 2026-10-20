import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, DM_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import "./globals.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2e6" },
    { media: "(prefers-color-scheme: dark)", color: "#121c16" },
  ],
};

// Sets the theme before the first paint: the stored choice (setup → Darstellung), else the system's.
const THEME_SCRIPT = `(function(){try{var m=matchMedia('(prefers-color-scheme: dark)');function a(){var t=localStorage.getItem('dom_theme');var d=t==='dark'||(t!=='light'&&m.matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}a();m.addEventListener('change',a)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" suppressHydrationWarning className={`${bricolage.variable} ${dmMono.variable} antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
