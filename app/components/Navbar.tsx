'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/',              label: 'Swarm Verifier'  },
  { href: '/erc8004',       label: 'ERC-8004 Feed'   },
  { href: '/handshakes',    label: 'Handshakes'      },
  { href: '/a2a',           label: 'A2A Validator'   },
  { href: '/mcp',           label: 'MCP Inspector'   },
  { href: '/verify',        label: 'Proof Lookup'    },
];

export default function Navbar() {
  const path    = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return path === '/';
    return path.startsWith(href);
  };

  const close = () => setOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-inner">

        {/* Brand: logo-mark + logotype side by side */}
        <div className="navbar-brand-group">
          <Link href="/" aria-label="Home" onClick={close}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-mark.svg"
              alt="notapaperclip home"
              width={60}
              height={60}
              style={{ display: 'block', borderRadius: 8, filter: 'drop-shadow(0 3px 4px rgba(0,0,0,0.225)) drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
            />
          </Link>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logotype.svg"
            alt="notapaperclip"
            height={34}
            style={{ display: 'block' }}
          />
        </div>

        {/* Desktop nav links */}
        <div className="navbar-nav">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive(item.href) ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        {/* Hamburger button — mobile only */}
        <button
          className="hamburger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          )}
        </button>

      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="mobile-nav">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-nav-link${isActive(item.href) ? ' active' : ''}`}
              onClick={close}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
