import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@/lib/types';
import { PageHead, pBtnQuiet } from './layout';
import PageErrorBoundary from './PageErrorBoundary';
import { portalNameFor } from '@/server/auth/session';

export type NavItem = {
  id: string;
  label: string;
  /** Sidebar heading this item sits under. */
  group?: string;
  count?: number;
  /** What a screen reader hears for the count, e.g. "3 tradesmen need action". */
  countLabel?: string;
  title: string;
  lede: string;
  content: ReactNode;
};

interface Props {
  session: Session;
  /** Under the name: an officer title or "Guild officer", or the trade. */
  roleLabel: string;
  items: NavItem[];
  active: string;
  onChange: (id: string) => void;
  onLogout: () => void;
  /** Shown above every page, e.g. an agreement waiting for a signature. */
  banner?: ReactNode;
}

/**
 * Portal chrome from the approved mockup: a header with the seal, who is
 * logged in, and Log out; a grouped sidebar with count badges (behind a
 * Menu button on phones); then the page with its serif title and lede.
 */
export default function PortalShell({
  session,
  roleLabel,
  items,
  active,
  onChange,
  onLogout,
  banner,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const current = items.find((i) => i.id === active) ?? items[0];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  /** The Admin runs the site and is not presented as an officer. */
  const portalName = portalNameFor(session);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const navListRef = useRef<HTMLUListElement>(null);

  // On phones: opening the menu moves focus to its first link; Escape closes
  // it and returns focus to the Menu button.
  useEffect(() => {
    if (!menuOpen) return;
    navListRef.current?.querySelector<HTMLAnchorElement>('a[href]')?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      menuBtnRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  // Consecutive items with the same group form one labelled section.
  const sections: { group?: string; items: NavItem[] }[] = [];
  for (const n of items) {
    const last = sections[sections.length - 1];
    if (last && last.group === n.group) last.items.push(n);
    else sections.push({ group: n.group, items: [n] });
  }

  useEffect(() => {
    document.title = `${current.label} | ${portalName} portal | St. Joseph the Worker Guild`;
    // Move focus to the new page's title after a change, not on first load.
    if (first.current) first.current = false;
    else headingRef.current?.querySelector('h1')?.focus();
  }, [current.id, current.label, portalName]);

  function go(id: string) {
    onChange(id);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="bg-stone min-h-svh">
      <header className="border-mortar bg-paper border-b">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:gap-4 md:px-6">
          <button
            ref={menuBtnRef}
            type="button"
            className="border-mortar rounded-sm border px-2.5 py-1.5 font-sans text-sm font-semibold md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-controls="portal-nav"
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
          <a href="/" className="flex min-w-0 items-center gap-3 no-underline">
            <img src="/brand/seal.svg" alt="" className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
            <span className="min-w-0 leading-tight">
              <span className="block font-serif text-[1rem] sm:text-[1.15rem]">
                St. Joseph the Worker Guild
              </span>
              <span className="text-brass-ink block font-sans text-[0.8rem] font-semibold tracking-[0.12em] uppercase">
                {portalName} portal
              </span>
            </span>
          </a>
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden text-right font-sans leading-tight sm:block">
              <p className="font-semibold">{session.name}</p>
              <p className="text-ash text-[0.85rem]">{roleLabel}</p>
            </div>
            <button type="button" className={`${pBtnQuiet} max-sm:hidden`} onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-6 md:flex-row md:gap-8 md:px-6">
        <nav
          id="portal-nav"
          aria-label="Portal"
          className={`${menuOpen ? 'block' : 'hidden'} border-mortar border-b pb-4 md:block md:w-60 md:shrink-0 md:border-b-0 md:pb-0`}
        >
          <div className="border-mortar mb-3 flex items-center justify-between gap-3 border-b pb-3 font-sans leading-tight sm:hidden">
            <p>
              <span className="font-semibold">{session.name}</span>
              <span className="text-ash block text-[0.85rem]">{roleLabel}</span>
            </p>
            <button type="button" className={pBtnQuiet} onClick={onLogout}>
              Log out
            </button>
          </div>
          <ul ref={navListRef} className="flex flex-col gap-0.5 font-sans">
            {sections.map((sec, si) => {
              const links = sec.items.map((n) => {
                const on = n.id === current.id;
                return (
                  <li key={n.id}>
                    <a
                      href={`?tab=${n.id}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                        e.preventDefault();
                        go(n.id);
                      }}
                      aria-current={on ? 'page' : undefined}
                      className={`flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-left font-semibold no-underline ${on ? 'bg-brick text-paper' : 'hover:bg-paper text-charcoal'}`}
                    >
                      {n.label}
                      {n.count ? (
                        <span
                          className={`rounded-full px-2 text-[0.75rem] ${on ? 'bg-paper text-brick' : 'bg-[#a8432f] text-white'}`}
                        >
                          <span aria-hidden="true">{n.count}</span>
                          <span className="sr-only">, {n.countLabel ?? `${n.count} waiting`}</span>
                        </span>
                      ) : null}
                    </a>
                  </li>
                );
              });
              if (!sec.group) return links;
              const labelId = `portal-nav-group-${si}`;
              return (
                <li key={`group-${si}`}>
                  <p
                    id={labelId}
                    className="text-ash mt-5 mb-1.5 px-3 text-[0.75rem] font-semibold tracking-[0.14em] uppercase"
                  >
                    {sec.group}
                  </p>
                  <ul aria-labelledby={labelId} className="flex flex-col gap-0.5">
                    {links}
                  </ul>
                </li>
              );
            })}
          </ul>
        </nav>

        <main id="main" className="min-w-0 flex-1" ref={headingRef}>
          {banner}
          <PageHead title={current.title} lede={current.lede} />
          <PageErrorBoundary key={current.id} onHome={() => go(items[0].id)}>
            <div>{current.content}</div>
          </PageErrorBoundary>
        </main>
      </div>
    </div>
  );
}
