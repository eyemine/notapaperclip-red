import type { Metadata } from 'next'; // Force recompile
import Link from 'next/link';
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
        <script type="text/javascript" dangerouslySetInnerHTML={{ __html: `
  (function(e,c){if(!c.__SV){var l,h;window.mixpanel=c;c._i=[];c.init=function(q,r,f){function t(d,a){var g=a.split(".");2==g.length&&(d=d[g[0]],a=g[1]);d[a]=function(){d.push([a].concat(Array.prototype.slice.call(arguments,0)))}}var b=c;"undefined"!==typeof f?b=c[f]=[]:f="mixpanel";b.people=b.people||[];b.toString=function(d){var a="mixpanel";"mixpanel"!==f&&(a+="."+f);d||(a+=" (stub)");return a};b.people.toString=function(){return b.toString(1)+".people (stub)"};l="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders start_session_recording stop_session_recording people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");for(h=0;h<l.length;h++)t(b,l[h]);var n="set set_once union unset remove delete".split(" ");b.get_group=function(){function d(p){a[p]=function(){b.push([g,[p].concat(Array.prototype.slice.call(arguments,0))])}}for(var a={},g=["get_group"].concat(Array.prototype.slice.call(arguments,0)),m=0;m<n.length;m++)d(n[m]);return a};c._i.push([q,r,f])};c.__SV=1.2;var k=e.createElement("script");k.type="text/javascript";k.async=!0;k.src="undefined"!==typeof MIXPANEL_CUSTOM_LIB_URL?MIXPANEL_CUSTOM_LIB_URL:"file:"===e.location.protocol&&"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js".match(/^\\/\\//)?"https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js":"//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";e=e.getElementsByTagName("script")[0];e.parentNode.insertBefore(k,e)}})(document,window.mixpanel||[]);
  mixpanel.init('854dc0c0b766fe76d0b22a6cac96a6a1', {
    autocapture: true,
    record_sessions_percent: 100,
    api_host: 'https://api-eu.mixpanel.com',
  });
        ` }} />
      </head>
      <body suppressHydrationWarning>
        <AnimationToggle />
        <PaperclipRain />
        <Navbar />
        <main>{children}</main>
        <footer style={{ marginTop: '4rem', padding: '2rem 1.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
            notapaperclip.red verifies agent behavior — it does not control it.{' '}
            <Link href="/legal" style={{ color: '#9ca3af', textDecoration: 'underline' }}>Disclaimer &amp; Terms</Link>
            {' · '}
            <a href="https://github.com/eyemine/notapaperclip-red" target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', textDecoration: 'underline' }}>GitHub</a>
            {' · '}
            <a href="https://ghostagent.ninja" target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', textDecoration: 'underline' }}>GhostAgent.ninja</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
