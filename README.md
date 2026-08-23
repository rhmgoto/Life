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
pnpm build:pages
```

## Windowsでダブルクリック起動

ルートフォルダの `MyLogを開く.cmd` をダブルクリックします。Windows標準のPowerShellだけで `docs` フォルダを配信し、既定のブラウザでMyLogを開きます。表示された小さなウィンドウを閉じるとローカル配信も終了します。

## GitHub Pagesで公開

1. `pnpm build:pages` を実行し、静的版を `docs` フォルダへ生成します。
2. このリポジトリ全体をGitHubへpushします。
3. GitHubのリポジトリで **Settings → Pages** を開きます。
4. **Build and deployment** のSourceを **Deploy from a branch** にします。
5. Branchを `main`、フォルダを `/docs` にして保存します。

公開URLをiPhoneのSafariで開けばそのまま利用できます。共有メニューの **ホーム画面に追加** を選ぶと、アプリに近い形で起動できます。

> 現在のデータはブラウザごとのIndexedDBに保存されます。WindowsとiPhoneでURLを共有しても、記録データ自体は同期されません。端末間同期には次の段階でクラウドDBと認証が必要です。
