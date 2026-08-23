import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'MyLog — 日々を、静かに残す',
  description: '予定と記録をひとつの流れで残し、振り返るための自分専用ログ。',
  openGraph: {
    title: 'MyLog — 日々を、静かに残す',
    description: '予定と記録をひとつの流れで残し、振り返るための自分専用ログ。',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'MyLog — 日々を、静かに残す' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyLog — 日々を、静かに残す',
    description: '予定と記録をひとつの流れで残し、振り返るための自分専用ログ。',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
