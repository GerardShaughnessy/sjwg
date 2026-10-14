import { emailList } from '@/lib/api';
import { useResource } from '@/lib/hooks';
import { btnSecondary, ErrorStrip, Loading } from '../ui';

const SOURCE_LABEL: Record<string, string> = {
  popup: 'Popup',
  footer: 'Footer',
  contact: 'Contact page',
  donate: 'Donate page',
  site: 'Site',
};

/** Everyone who signed up for Guild news on the public site. */
export default function EmailListPanel() {
  const { data, loading, error } = useResource(() => emailList.list(), []);
  const list = data ?? [];
  const bySource = list.reduce<Record<string, number>>((acc, s) => {
    acc[s.source] = (acc[s.source] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="font-sans">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-h2 font-serif">Email list</h2>
          <p className="text-ash mt-2 max-w-[60ch] text-[0.95rem]">
            People who signed up for Guild news from the popup, the footer, or the contact page.
            Download the list to send a newsletter from Gmail, Mailchimp, or similar.
          </p>
        </div>
        {list.length > 0 && (
          <a href={emailList.csvUrl} className={btnSecondary} download>
            Download CSV
          </a>
        )}
      </div>

      {error && <ErrorStrip>{error}</ErrorStrip>}
      {loading && !data && (
        <div className="mt-6">
          <Loading what="the email list" />
        </div>
      )}

      {data && (
        <>
          <p className="mt-6 text-[1.05rem]">
            <span className="font-semibold">{list.length}</span>{' '}
            {list.length === 1 ? 'person' : 'people'} on the list
            {list.length > 0 && (
              <span className="text-ash">
                {' '}
                (
                {Object.entries(bySource)
                  .map(([k, n]) => `${SOURCE_LABEL[k] ?? k} ${n}`)
                  .join(', ')}
                )
              </span>
            )}
            .
          </p>
          {list.length > 0 && (
            <ul className="border-mortar mt-4 border-t">
              {list.map((s) => (
                <li
                  key={s.id}
                  className="border-mortar grid gap-1 border-b py-3 sm:grid-cols-[1.4fr_1fr_8rem_7rem] sm:gap-4"
                >
                  <span className="font-semibold break-all">{s.email}</span>
                  <span>{s.name || <span className="text-ash">No name</span>}</span>
                  <span className="text-ash">{SOURCE_LABEL[s.source] ?? s.source}</span>
                  <span className="text-ash">
                    {new Date(s.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
