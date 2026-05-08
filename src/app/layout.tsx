import type { Metadata, Viewport } from 'next'
import './globals.css'
import './more-menu-polish.css'
import './calendar-polish.css'
import './calendar-home-look.css'
import './calendar-action-sheet-polish.css'
import './app-header-polish.css'
import './nexo-brand.css'
import './ui-polish-pack.css'
import './premium-navigation.css'
import './documents-vault.css'
import './calendar-wow.css'
import './forms-premium.css'
import './more-hub-premium.css'
import './settings-feedback-premium.css'
import './contacts-polish.css'
import './pwa-status.css'
import './more-hub-screen-fix.css'
import './more-tab-screen.css'
import './event-form-mobile-fix.css'
import './guided-creation.css'
import { AuthProvider } from '@/lib/auth-context'
import { ThemeProvider } from '@/lib/theme-context'
import { PwaStatusBridge } from '@/components/pwa/PwaStatusBridge'
import { GuidedCreationBridge } from '@/components/guided/GuidedCreationBridge'
import { EventDeleteBridge } from '@/components/events/EventDeleteBridge'
import { CalendarGuidedPlusBridge } from '@/components/calendar/CalendarGuidedPlusBridge'

export const metadata: Metadata = {
  title: 'Nexo',
  description: 'Todo lo importante, conectado.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/favicon.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/apple-touch-icon-precomposed.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: ['/favicon.png'],
  },
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Nexo' },
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
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Nexo" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" sizes="192x192" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon-precomposed" sizes="192x192" href="/apple-touch-icon-precomposed.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon.png" />
        <link rel="shortcut icon" type="image/png" href="/favicon.png" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body style={{ fontFamily: 'system-ui, -apple-system, sans-serif', margin: 0, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
        <ThemeProvider>
          <AuthProvider>
            <PwaStatusBridge />
            <GuidedCreationBridge />
            <EventDeleteBridge />
            <CalendarGuidedPlusBridge />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
