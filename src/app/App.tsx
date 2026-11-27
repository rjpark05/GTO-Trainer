import { useState } from 'preact/hooks';
import { MatrixView } from '@/features/matrix/MatrixView';
import { PlayView } from '@/features/play/PlayView';

const TABS = {
  play: { label: 'Play', view: PlayView },
  matrix: { label: 'Analysis', view: MatrixView },
} as const;
type TabId = keyof typeof TABS;

export function App() {
  const [tab, setTab] = useState<TabId>('play');
  const View = TABS[tab].view;
  return (
    <div class="app">
      <nav class="tabs" role="tablist">
        {(Object.keys(TABS) as TabId[]).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {TABS[id].label}
          </button>
        ))}
      </nav>
      <main>
        <View />
      </main>
    </div>
  );
}
