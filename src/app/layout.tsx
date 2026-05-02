import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from '@/lib/theme-context'

export const metadata: Metadata = {
  title: 'CustodiaApp',
  description: 'Gestión de custodia compartida de menores',
  manifest: '/manifest.json?v=4',
  icons: {
    icon: [
      { url: '/icons/icon-192.png?v=4', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png?v=4', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png?v=4', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/icons/icon-192.png?v=4'],
  },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CustodiaApp' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f6fb' },
    { media: '(prefers-color-scheme: dark)', color: '#0d1117' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

const themeBootScript = `
(function () {
  try {
    var saved = localStorage.getItem('custodia-theme-mode') || 'system';
    var resolved = saved === 'system'
      ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : saved;
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.style.colorScheme = resolved;
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body style={{ fontFamily: 'system-ui, -apple-system, sans-serif', margin: 0, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
