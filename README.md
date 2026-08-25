# MyLog

日々のつぶやきと学びを残し、振り返り・AI共有に使える個人ログのMVPです。

## 構成

- `app`: アプリの入口と全体スタイル
- `features`: 今日、カレンダー、振り返り、AI共有の各画面
- `components`: ナビゲーションと編集フォーム
- `domain`: データモデルとログ種類
- `data`: RepositoryインターフェースとIndexedDB実装
- `integrations`: Google CalendarおよびAI連携の境界

## 保存と同期

Supabaseを設定すると、ログインした利用者の記録をクラウドへ保存し、端末間で自動同期します。IndexedDBはオフライン時の保存先と未送信キューとして残るため、通信が戻ると再送されます。未設定時は従来どおり端末内だけで動作します。

ログには任意の見出しと、`PT`（personal tubuyaki）、`BT`（business tubuyaki）、`PM`（personal manabi）、`BM`（business manabi）の種類を設定できます。旧`P`と`B`はSupabaseのスキーマ更新時に`PT`と`BT`へ移行されます。旧予定データはバックアップ互換性のため保存層に残しますが、画面には表示しません。

### Supabaseの設定

1. Supabaseでプロジェクトを作成します。
2. Dashboardの **SQL Editor** で `supabase/schema.sql` を実行します。
3. **Authentication → URL Configuration** でSite URLを `https://rhmgoto.github.io/Life/` にし、同じURLをRedirect URLsにも追加します。
4. **Project Settings → API** からProject URLとPublishable key（旧anon key）を確認します。
5. `public/config.js` の空欄へ2つの値を設定します。`service_role`キーは絶対に設定しないでください。
6. `pnpm build:pages` を実行してGitHubへpushします。

初回ログイン時、その端末のIndexedDBにある記録をクラウドの記録と統合します。以後は30秒ごと、オンライン復帰時、画面へ戻った時にも同期します。

アプリの「保存と同期」から、全記録をJSONで書き出し・復元できます。クラウド同期とは別に、定期的なバックアップを推奨します。

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

> Supabase未設定時は、データがブラウザごとのIndexedDBだけに保存され、端末間では同期されません。
