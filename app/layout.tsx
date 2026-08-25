import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'MyLog — 日々を、静かに残す',
  description: '日々のつぶやきと学びを残し、振り返り・AI共有に使える自分専用ログ。',
  openGraph: {
    title: 'MyLog — 日々を、静かに残す',
    description: '日々のつぶやきと学びを残し、振り返り・AI共有に使える自分専用ログ。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'MyLog — 日々を、静かに残す' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyLog — 日々を、静かに残す',
    description: '日々のつぶやきと学びを残し、振り返り・AI共有に使える自分専用ログ。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body><Script src="/config.js" strategy="beforeInteractive" />{children}</body></html>;
}
