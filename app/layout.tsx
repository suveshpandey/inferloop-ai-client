import type { Metadata } from "next";
import { IBM_Plex_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";

// Inline pre-paint script: reads the stored theme from localStorage and
// applies the `dark` class to <html> before the first render. This avoids
// a flash of the wrong theme between the document loading and React hydrating
// the ThemeProvider. Kept tiny on purpose — runs synchronously before paint.
const THEME_INIT_SCRIPT = `
(function(){try{
  var t = localStorage.getItem('inferloop.theme') || 'dark';
  if (t === 'dark') document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}catch(_){document.documentElement.classList.add('dark');}})();
`;

// IBM Plex Sans is the body font — humanist sans with an engineering
// character that pairs naturally with Geist Mono. Needs explicit weights
// declared (it's not a variable font on Google's CDN). 400 covers body,
// 500 covers medium emphasis, 600 covers headings/buttons.
const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InferLoop AI",
  description: "Multi-agent code analysis — analyze, critique, improve, evaluate.",
  icons: {
    icon: [
      { url: "/inferloop-ai-favicon.png", type: "image/png" },
    ],
    shortcut: "/inferloop-ai-favicon.png",
    apple:    "/inferloop-ai-favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <SidebarProvider>
              <Header />
              <main className="flex-1">{children}</main>
              <Toaster />
            </SidebarProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
