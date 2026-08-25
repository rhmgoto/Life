import type { AppData } from '@/domain/models';
import { addDays, toDateKey } from '@/lib/date';

export function createSeedData(): AppData {
  const today = toDateKey();
  const now = new Date().toISOString();
  return {
    logs: [
      { id: 'seed-log-1', date: today, time: '10:15', title: '小さく試して振り返る', body: '会議で新しいプロジェクトの進め方について検討した。まずは小さく試して、来週振り返る。', type: 'BM', tags: ['仕事', '決定'], createdAt: now, updatedAt: now },
      { id: 'seed-log-2', date: today, time: '15:40', body: '日々の記録をAIと共有できる、自分専用のログアプリについて考えた。', type: 'PT', tags: ['アイデア', 'MyLog'], createdAt: now, updatedAt: now },
      { id: 'seed-log-3', date: addDays(today, -2), time: '17:20', title: '資料の初稿', body: '来週の資料構成を確認して、月曜日までに初稿を作る。', type: 'BT', tags: ['仕事', 'TODO'], createdAt: now, updatedAt: now },
    ],
    events: [],
  };
}
