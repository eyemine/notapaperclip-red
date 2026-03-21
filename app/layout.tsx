import type { Metadata } from 'next'; // Force recompile
import Navbar from './components/Navbar';
import AnimationToggle from './components/AnimationToggle';
import PaperclipRain from './components/PaperclipRain';
import './globals.css';

export const metadata: Metadata = {
  title: 'notapaperclip.red — Agent Trust Oracle',
  description: 'Neutral agent verification hub. Validate A2A compliance, verify swarm attestations, and monitor ERC-8004 on-chain activity.',
  openGraph: {
    title: 'notapaperclip.red',
    description: 'Neutral agent trust oracle — verify any swarm, validate A2A compliance, monitor ERC-8004.',
    url: 'https://notapaperclip.red',
    siteName: 'notapaperclip.red',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        <AnimationToggle />
        <PaperclipRain />
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
