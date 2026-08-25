export type ViewName = 'today' | 'calendar' | 'search' | 'share';

const items: Array<{ id: ViewName; label: string; icon: string }> = [
  { id: 'today', label: '今日', icon: '⌂' },
  { id: 'calendar', label: 'カレンダー', icon: '□' },
  { id: 'search', label: '振り返り', icon: '⌕' },
  { id: 'share', label: 'AI共有', icon: '✦' },
];

export function AppNavigation({ view, onChange, storageLabel = 'この端末に保存中' }: { view: ViewName; onChange: (view: ViewName) => void; storageLabel?: string }) {
  const buttons = items.map((item) => (
    <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>
      <span aria-hidden="true">{item.icon}</span>{item.label}
    </button>
  ));
  return <><aside className="sidebar"><div className="brand"><span className="brand-mark">M</span><span>MyLog</span></div><nav className="nav-list" aria-label="メインナビゲーション">{buttons}</nav><p className="storage-note">● {storageLabel}</p></aside><nav className="bottom-nav" aria-label="メインナビゲーション">{buttons}</nav></>;
}
