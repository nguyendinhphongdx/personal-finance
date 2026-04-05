import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["300", "400", "500", "600", "700"],
});

const APP_NAME = "FinanceApp";
const APP_TITLE = "Quản lý Tài chính - Theo dõi Thu Chi & Nhà cho thuê";
const APP_DESCRIPTION = "Ứng dụng quản lý tài chính cá nhân thông minh. Theo dõi thu chi, quản lý nhà cho thuê, tính hóa đơn phòng tự động, thống kê lợi nhuận. Hỗ trợ nhập liệu bằng giọng nói và AI.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F59E0B" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: APP_TITLE,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [
    "quản lý tài chính",
    "thu chi cá nhân",
    "quản lý nhà cho thuê",
    "hóa đơn phòng trọ",
    "tiền điện nước",
    "cho thuê phòng",
    "finance manager",
    "personal finance",
    "rental management",
    "quản lý chi tiêu",
    "sổ thu chi",
  ],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192x192.png",
  },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: APP_NAME,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: APP_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    "google-site-verification": "",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning className={`${plusJakarta.variable} h-full antialiased`}>
      <head>
        <link rel="canonical" href="https://financeapp.vn" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: APP_NAME,
              description: APP_DESCRIPTION,
              applicationCategory: "FinanceApplication",
              operatingSystem: "All",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "VND",
              },
              featureList: [
                "Quản lý thu chi cá nhân",
                "Quản lý nhà cho thuê",
                "Tính hóa đơn phòng tự động",
                "Thống kê lợi nhuận",
                "Nhập liệu bằng giọng nói",
                "Hỗ trợ AI phân tích giao dịch",
                "PWA - cài đặt trên điện thoại",
              ],
              inLanguage: "vi",
            }),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
