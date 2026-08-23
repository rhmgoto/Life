# MyLog

予定と日々の記録を同じ時間軸で残し、検索・振り返り・AI共有に使える個人ログのMVPです。

## 構成

- `app`: アプリの入口と全体スタイル
- `features`: 今日、カレンダー、検索、AI共有の各画面
- `components`: ナビゲーションと編集フォーム
- `domain`: データモデルとログ種類
- `data`: RepositoryインターフェースとIndexedDB実装
- `integrations`: Google CalendarおよびAI連携の境界

## 保存について

現在は各ブラウザのIndexedDBへ保存します。同じURLを使っても端末間では同期されません。将来のクラウドDB移行では `LogRepository` の実装を差し替えます。

## 開発

```sh
pnpm dev
pnpm build
```
