import { useEffect, useMemo, useRef, useState } from 'react';
import type { Member } from '@/lib/types';
import { slugify, NOT_SURE } from '@/lib/trades';
import MemberCard from './MemberCard';

type Sort = 'trade' | 'name' | 'years';
type Filters = { trade: string; area: string; sort: Sort };
const DEFAULTS: Filters = { trade: '', area: '', sort: 'trade' };

interface Props {
  members: Member[];
  trades: string[];
  areas: string[];
}

function readUrl(trades: string[], areas: string[]): Filters {
  const p = new URLSearchParams(window.location.search);
  const tradeSlug = p.get('trade') ?? '';
  const trade = trades.find((t) => slugify(t) === tradeSlug) ?? '';
  const areaSlug = p.get('area') ?? '';
  const area = areas.find((a) => slugify(a) === areaSlug) ?? '';
  const sort = (['trade', 'name', 'years'] as Sort[]).includes(p.get('sort') as Sort)
    ? (p.get('sort') as Sort)
    : 'trade';
  return { trade, area, sort };
}

function writeUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.trade) p.set('trade', slugify(f.trade));
  if (f.area) p.set('area', slugify(f.area));
  if (f.sort !== DEFAULTS.sort) p.set('sort', f.sort);
  const qs = p.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  if (next !== `${window.location.pathname}${window.location.search}`) {
    window.history.replaceState(null, '', next);
  }
}

/**
 * Client-side filter and sort. The full roster is server-rendered, then the
 * query string is applied after mount so hydration never mismatches.
 */
export default function DirectoryExplorer({ members, trades, areas }: Props) {
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setF(readUrl(trades, areas));
    setReady(true);
    const onPop = () => setF(readUrl(trades, areas));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [trades, areas]);

  useEffect(() => {
    if (ready) writeUrl(f);
  }, [f, ready]);

  const results = useMemo(() => {
    const list = members.filter(
      (m) => (!f.trade || m.trade === f.trade) && (!f.area || m.areas.includes(f.area)),
    );
    const byName = (a: Member, b: Member) => a.name.localeCompare(b.name);
    if (f.sort === 'name') return list.sort(byName);
    if (f.sort === 'years')
      return list.sort((a, b) => b.yearsInTrade - a.yearsInTrade || byName(a, b));
    return list.sort((a, b) => a.trade.localeCompare(b.trade) || byName(a, b));
  }, [members, f]);

  const active = f.trade || f.area;
  const set = (patch: Partial<Filters>) => setF((prev) => ({ ...prev, ...patch }));
  const clear = () => setF({ ...DEFAULTS, sort: f.sort });

  const selectCls =
    'w-full border-2 border-charcoal bg-paper px-3 py-2.5 font-sans text-[1rem] leading-tight';
  const labelCls = 'block font-sans text-[0.9rem] font-semibold';

  return (
    <div>
      <form
        role="search"
        aria-label="Filter the directory"
        className="border-mortar grid gap-4 border-y py-6 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-end"
        onSubmit={(e) => e.preventDefault()}
      >
        <div>
          <label htmlFor="f-trade" className={labelCls}>
            Trade
          </label>
          <select
            id="f-trade"
            className={selectCls}
            value={f.trade}
            onChange={(e) => set({ trade: e.target.value })}
          >
            <option value="">All trades</option>
            {trades.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-area" className={labelCls}>
            Area served
          </label>
          <select
            id="f-area"
            className={selectCls}
            value={f.area}
            onChange={(e) => set({ area: e.target.value })}
          >
            <option value="">All areas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-sort" className={labelCls}>
            Sort by
          </label>
          <select
            id="f-sort"
            className={selectCls}
            value={f.sort}
            onChange={(e) => set({ sort: e.target.value as Sort })}
          >
            <option value="trade">Trade</option>
            <option value="name">Name</option>
            <option value="years">Years in the trade</option>
          </select>
        </div>
        <button
          type="button"
          onClick={clear}
          disabled={!active}
          className="border-charcoal border-2 px-4 py-2.5 font-sans leading-tight font-semibold disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear filters
        </button>
      </form>

      <p className="text-ash mt-5 font-sans text-[0.95rem]" aria-live="polite">
        {results.length === members.length
          ? `${members.length} members listed.`
          : `${results.length} of ${members.length} members match.`}
        {f.trade ? ` Trade: ${f.trade}.` : ''}
        {f.area ? ` Area: ${f.area}.` : ''}
      </p>

      {results.length > 0 ? (
        <div className="border-mortar mt-4 border-b">
          {results.map((m) => (
            <MemberCard key={m.id} member={m} headingLevel={2} />
          ))}
        </div>
      ) : (
        <div className="border-brass bg-paper mt-6 border-t-4 p-6 md:p-8">
          <h2 ref={headingRef} tabIndex={-1} className="text-h3">
            No {f.trade ? f.trade.toLowerCase() : 'members'} listed{f.area ? ` in ${f.area}` : ''}{' '}
            yet.
          </h2>
          <p className="mt-3 max-w-[56ch] leading-relaxed">
            The Guild still wants to hear about the job. Send a request and a member will see it,
            and the Guild refers work outside its own trades when it can.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href={`/request?trade=${slugify(f.trade || NOT_SURE)}`}
              className="bg-brick text-paper hover:bg-kiln inline-flex items-center px-5 py-3 font-sans leading-none font-semibold no-underline"
            >
              Request help{f.trade ? ` with ${f.trade.toLowerCase()}` : ''}
            </a>
            <button
              type="button"
              onClick={clear}
              className="decoration-brass font-sans font-medium underline decoration-2 underline-offset-4"
            >
              Clear filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
