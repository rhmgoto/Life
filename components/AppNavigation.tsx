export type ViewName = 'today' | 'calendar' | 'search' | 'share';

const items: Array<{ id: ViewName; label: string; icon: string }> = [
  { id: 'today', label: '今日', icon: '⌂' },
  { id: 'calendar', label: 'カレンダー', icon: '□' },
  { id: 'search', label: '検索', icon: '⌕' },
  { id: 'share', label: 'AI共有', icon: '✦' },
];

export function AppNavigation({ view, onChange }: { view: ViewName; onChange: (view: ViewName) => void }) {
  const buttons = items.map((item) => (
    <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>
      <span aria-hidden="true">{item.icon}</span>{item.label}
    </button>
  ));
  return <><aside className="sidebar"><div className="brand"><span className="brand-mark">M</span><span>MyLog</span></div><nav className="nav-list" aria-label="メインナビゲーション">{buttons}</nav><p className="storage-note">● この端末に保存中</p></aside><nav className="bottom-nav" aria-label="メインナビゲーション">{buttons}</nav></>;
}
