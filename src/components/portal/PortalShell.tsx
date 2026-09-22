import { useEffect, useRef, type ReactNode } from 'react';
import type { Session } from '@/lib/types';

export type Tab = { id: string; label: string; content: ReactNode };

interface Props {
  session: Session;
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  onLogout: () => void;
}

/** Portal chrome: who is logged in, ARIA tabs, logout. */
export default function PortalShell({ session, tabs, active, onChange, onLogout }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.id === active),
  );
  const current = tabs[activeIndex];

  useEffect(() => {
    document.title = `${current.label} | Member portal | St. Joseph the Worker Guild`;
  }, [current.label]);

  function onKey(e: React.KeyboardEvent) {
    const keys: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: -Infinity,
      End: Infinity,
    };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const n = tabs.length;
    let i =
      keys[e.key] === -Infinity
        ? 0
        : keys[e.key] === Infinity
          ? n - 1
          : (activeIndex + keys[e.key] + n) % n;
    onChange(tabs[i].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[i]?.focus();
  }

  return (
    <div>
      <div className="border-mortar flex flex-wrap items-center justify-between gap-4 border-b pb-5">
        <p className="font-sans">
          <span className="font-semibold">{session.name}</span>
          <span className="text-ash">
            , {session.role === 'admin' ? 'Guild officer' : 'Guild member'}. {session.email}
          </span>
        </p>
        <button
          type="button"
          onClick={onLogout}
          className="border-charcoal hover:bg-charcoal hover:text-stone border-2 px-4 py-2 font-sans leading-tight font-semibold"
        >
          Log out
        </button>
      </div>

      <div
        ref={listRef}
        role="tablist"
        aria-label="Portal sections"
        className="border-mortar mt-6 flex flex-wrap gap-x-1 gap-y-2 border-b-2"
        onKeyDown={onKey}
      >
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={i === activeIndex}
            aria-controls={`panel-${t.id}`}
            tabIndex={i === activeIndex ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`-mb-[2px] border-b-4 px-4 py-3 font-sans leading-tight font-semibold ${i === activeIndex ? 'border-brick text-charcoal' : 'text-ash hover:text-charcoal border-transparent'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${current.id}`}
        aria-labelledby={`tab-${current.id}`}
        tabIndex={0}
        className="mt-8 outline-none"
      >
        {current.content}
      </div>
    </div>
  );
}
