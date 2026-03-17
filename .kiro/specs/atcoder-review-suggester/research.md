## Summary
- **Feature**: `atcoder-review-suggester`
- **Discovery Scope**: New Feature
- **Key Findings**:
  - Tampermonkey は `@match`、`@run-at`、`@grant`、`GM_setValue` / `GM_getValue` を公式に提供しており、ユーザースクリプトの注入対象と専用ストレージを明示できる。
  - TypeScript は `noEmit` によりビルドと独立した型チェックを実施でき、ESLint は現行の Getting Started で flat config ベースの初期化を前提としている。
  - ブラウザ内永続化は `localStorage` でも可能だが、Tampermonkey 専用ストレージのほうが userscript の責務境界に合う。
  - AtCoder 上で自然に見える userscript UI は、既存メニュー項目の DOM 構造と一般的な Bootstrap 風モーダル骨格に寄せると違和感を抑えやすい。
  - 問題トグルは、問題ページでは見出し内の既存小型ボタン列、提出詳細ページでは提出情報テーブルの問題リンク行に寄せると文脈と調和しやすい。

## Research Log

### Tampermonkey metadata and storage
- **Context**: 配布形態、Tampermonkey 前提、ブラウザ内永続化の設計根拠が必要だった。
- **Sources Consulted**:
  - https://www.tampermonkey.net/documentation.php
- **Findings**:
  - `@match` で対象 URL を指定できる。
  - `@run-at` は `document-start`、`document-body`、`document-end`、`document-idle` を選択できる。
  - `@grant` で `GM_setValue`、`GM_getValue` を明示できる。
  - `GM_setValue` は userscript storage にキー単位で値を保存できる。
- **Implications**:
  - AtCoder 対象の `@match` を明示した userscript header を配布パッケージに含める。
  - 永続化は `GM_*` ストレージを第一選択とし、DOM やページスクリプトと分離された保存境界を持たせる。
  - DOM 構築後に UI を差し込むため、既定の `document-idle` または `document-end` を前提にしたブートストラップが妥当。

### TypeScript and linting workflow
- **Context**: TypeScript 実装、ESLint、ビルドと独立した型チェックの要件をツールチェーン設計に落とす必要があった。
- **Sources Consulted**:
  - https://www.typescriptlang.org/tsconfig/#noEmit
  - https://eslint.org/docs/latest/use/getting-started
- **Findings**:
  - TypeScript の `noEmit` は JavaScript や declaration を出力せず型チェック専用に使える。
  - ESLint 現行ドキュメントは `npm init @eslint/config@latest` と flat config (`eslint.config.js` / `eslint.config.mjs`) を案内している。
- **Implications**:
  - `lint` と `typecheck` を分離した npm scripts を設計前提にする。
  - 実装では TypeScript コンパイルと userscript 向け出力生成を分離し、CI 上でも `tsc --noEmit` 相当を独立実行可能にする。

### Browser persistence boundary
- **Context**: データはブラウザ内永続化であり、外部通信禁止という要件に対して保存方式を選定する必要があった。
- **Sources Consulted**:
  - https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
  - https://www.tampermonkey.net/documentation.php
- **Findings**:
  - `localStorage` は origin 単位でブラウザセッションをまたいで保存される。
  - `GM_setValue` / `GM_getValue` は userscript 固有の保存領域を提供する。
- **Implications**:
  - 設計上は `GM_*` ストレージを標準とし、`ReviewWorkspace` 全体を単一キーの JSON スナップショットとして保存する。
  - ストレージアクセスは `ReviewStoreAdapter` に隔離し、保存形式検証と canonical empty state フォールバックを集約する。

### Greasy Fork publishing constraints
- **Context**: Greasy Fork 配布前提のため、配布物とメタデータの制約を確認したかった。
- **Sources Consulted**:
  - https://greasyfork.org/en/help/code-rules
  - https://greasyfork.org/en/help/meta-keys
- **Findings**:
  - Greasy Fork はスクリプトの説明とメタキーを重視し、主機能は投稿されたコード自体に含まれる必要がある。
  - `@name`、`@description` などの metadata block は UI 表示に使われる。
- **Implications**:
  - 配布物は単体の `.user.js` を主配布対象にし、主機能を外部読み込みに依存しない。
  - メタデータ生成はビルド出力の責務に含め、公開に必要な項目を欠落させない。

### AtCoder problem page DOM anchors
- **Context**: 問題ページでのログイン判定、メニュー差し込み、問題 ID 抽出の実 DOM 根拠が必要だった。
- **Sources Consulted**:
  - ユーザー提供の AtCoder 問題ページ HTML 例 (`/contests/abc388/tasks/abc388_d`)
- **Findings**:
  - 右上ユーザーメニューは `.navbar-right > li.dropdown > a.dropdown-toggle` と、その直下の `ul.dropdown-menu` で構成される。
  - 問題ページ URL は `/contests/{contestId}/tasks/{taskId}` 形式で、例では `abc388` と `abc388_d` を直接取得できる。
  - 問題タイトル領域は `.col-sm-12 > span.h2` で、既存の「解説」ボタンが同居している。
  - 問題タイトルの表示文字列は `.col-sm-12 > span.h2` のテキストノードから取得でき、同居する「解説」ボタン文字列は除外が必要である。
  - 「解説」ボタンは `<a class="btn btn-default btn-sm">` として見出し内に並んでおり、同サイズのボタンをその直後へ追加すると視覚的な整合を取りやすい。
  - コンテスト中など「解説」ボタンが存在しないケースがありうるため、見出し末尾へ直接差し込めるフォールバックが必要である。
- **Implications**:
  - `AuthSessionGuard` は旧ヘッダー/新ヘッダーの DOM シグナルのみをログイン判定の契約として扱う前提で設計できる。
  - `MenuEntryAdapter` はユーザードロップダウンの `ul.dropdown-menu` に新規 `li > a` を追加する前提で設計できる。
  - `ProblemContextResolver` は URL パスから `contestId` と `taskId` を抽出し、`ProblemId = {contestId}/{taskId}` に正規化できる。
  - `ProblemContextResolver` は `.col-sm-12 > span.h2` から表示用タイトルを抽出できるが、子要素のボタンやリンクを除外してプレーンテキスト化する必要がある。
  - `ToggleMountCoordinator` は問題ページで `.col-sm-12 > span.h2` をコンテナとし、見出し内の既存「解説」ボタン直後を第一候補、見出し末尾をフォールバックとして扱える。

### AtCoder submission detail DOM anchors
- **Context**: 提出詳細ページで対象問題を逆引きし、同一トグル操作を提供するための DOM 根拠が必要だった。
- **Sources Consulted**:
  - ユーザー提供の AtCoder 提出詳細ページ HTML 例 (`/contests/abc388/submissions/61566375`)
- **Findings**:
  - 提出詳細ページ URL は `/contests/{contestId}/submissions/{submissionId}` 形式で、URL 単独では `taskId` を含まない。
  - `提出情報` テーブルの「問題」行に `/contests/abc388/tasks/abc388_d` 形式のリンクが存在する。
  - 同じ「問題」行のリンクテキストに `D - Coming of Age Celebration` のような表示用タイトルが含まれる。
  - ページ見出しは `.col-sm-12 > p > span.h2` に `提出 #...` を表示している。
  - ユーザーメニュー DOM は問題ページと同一構造である。
  - 「問題」行の `td.text-center` に問題リンクが 1 つ置かれており、同じセル内でリンク直後に小型ボタンを並べるのが最も文脈に近い。
  - 提出番号見出しの横は提出そのものの文脈であり、対象問題を操作するトグルの配置先としては離れている。
- **Implications**:
  - `ProblemContextResolver` は提出詳細ページで `提出情報` テーブルの「問題」リンクを canonical source として `ProblemId` を解決する。
  - `ProblemContextResolver` は提出詳細ページでは同じリンクの `textContent` をそのまま表示用タイトルとして取得できる。
  - `ToggleMountCoordinator` は提出詳細ページでは提出情報テーブルの「問題」行にある問題リンク直後を優先挿入位置にできる。
  - `MenuEntryAdapter` と `AuthSessionGuard` は問題ページと同じセレクタ戦略を再利用できる。

### AtCoder logged out problem page DOM anchors
- **Context**: 未ログイン時に UI を差し込まない条件を、実 DOM から観測可能に固定する必要があった。
- **Sources Consulted**:
  - ユーザー提供の AtCoder 未ログイン問題ページ HTML 例 (`/contests/abc388/tasks/abc388_d`)
- **Findings**:
  - 右上ナビゲーションにはユーザードロップダウンが存在せず、代わりに `新規登録` と `ログイン` のリンクが表示される。
  - 問題本文とタイトル領域の DOM はログイン時とほぼ同じであり、ログイン判定を誤るとトグルだけ差し込めてしまう。
- **Implications**:
  - `AuthSessionGuard` はログイン DOM シグナル不在を根拠として `anonymous` 側へ倒せる。
  - `MenuEntryAdapter` は `ul.dropdown-menu` が存在しない場合に fail closed でリンク追加を中止する。
  - `ToggleMountCoordinator` はセッション判定が `authenticated` の場合にのみ挿入を許可する前提を維持する。

### AtCoder top page logged out DOM anchors
- **Context**: AtCoder トップページでは競技ページと異なる新ヘッダー構造が使われており、誤って競技ページ用セレクタを前提にしないようにする必要があった。
- **Sources Consulted**:
  - ユーザー提供の AtCoder トップページ未ログイン HTML 例 (`/`)
- **Findings**:
  - ヘッダーは `#header` / `.header-nav` / `.header-link` 構造で、競技ページの `.navbar` / `.dropdown-menu` とは別系統である。
  - `.header-link` には `新規登録` / `ログイン` のリンクのみがあり、ユーザーメニューは存在しない。
  - トップページは `/` であり、問題ページでも提出詳細ページでもない。
- **Implications**:
  - `UserscriptBootstrap` はトップページでも起動しうるが、`AtCoderPageAdapter.detectPage()` により `other` と判定し、問題トグルを生成しない。
  - `AuthSessionGuard` は新ヘッダーでもログイン DOM シグナル不在を主根拠として `anonymous` と判定できる。
  - `MenuEntryAdapter` は競技ページ用の `ul.dropdown-menu` が存在しないため fail closed となり、未ログイントップページでは何も追加しない。

### AtCoder top page logged in DOM anchors
- **Context**: トップページのログイン済み状態では新ヘッダーにマイページ領域が現れるため、常設リンクをどこへ表示するかの設計根拠が必要だった。
- **Sources Consulted**:
  - ユーザー提供の AtCoder トップページログイン済み HTML 例 (`/`)
- **Findings**:
  - 新ヘッダーは `header-mypage` / `j-dropdown_mypage` / `header-mypage_detail` を用いた独自構造で、競技ページの `ul.dropdown-menu` とは異なる。
  - トップページはログイン済みでも URL が `/` のままで、問題ページ・提出詳細ページではない。
- **Implications**:
  - `AuthSessionGuard` はトップページ新ヘッダーの `header-mypage` / `header-mypage_detail` を主契約として `authenticated` 判定できる。
  - `UserscriptBootstrap` はログイン済みトップページでも `detectPage() === other` により問題トグルを生成しない。
  - `MenuEntryAdapter` はトップページログイン済み時、`header-mypage_detail` 内の `header-mypage_list` に常設リンクを追加対象として扱える。

### AtCoder-adjacent UI composition pattern
- **Context**: 機能要件を満たすだけでなく、AtCoder 上で違和感の少ないメニュー項目とポップアップの見た目を定義する必要が生じた。
- **Sources Consulted**:
  - ユーザー提供の既存 userscript 実装断片（メニュー差し込み・モーダル DOM・スタイル定義）
- **Findings**:
  - 既存ユーザーメニューへの差し込みは `li > a` の単純な構造に徹し、周囲のメニュー項目と同じ並びに入れると視覚的な浮きが少ない。
  - 既存ユーザーメニューでは、設定系項目やその近傍の区切り位置に寄せて差し込むと、「どこにあるべきか」の期待と合いやすい。
  - 新旧ヘッダーで利用できるアイコン系が異なる場合でも、既存 UI の小さな補助アイコンに合わせるとメニュー項目の密度を崩しにくい。
  - 同じユーザーメニューへ差し込む他 userscript（例: `ac-predictor`）がある場合、末尾 `divider` をアンカーにして挿入順を決める実装があるため、`divider` の位置・個数を壊すと相互干渉が起こりやすい。
  - `li` のクラス（例: `large`, `divider`）を機械的にコピーすると、行高やセパレータ判定が崩れ、別 userscript の挿入条件を破壊しうる。
  - ポップアップは header / body / footer の 3 分割を持つ一般的なモーダル骨格のほうが、見出し、本文、閉じる/更新操作の役割が明確になる。
  - ただし「今日の一問」系のように 1 件の対象と 1 つの主要操作だけを扱う UI では、問題タイトルと主要アクションを本文内で近接配置したほうが、何を解いて何を押すのかを追いやすい。
  - フッター側は close のような補助操作だけに寄せると、主目的と離脱操作の役割分担が明確になる。
  - ページ側が Bootstrap 風スタイルを持つ環境では、白背景パネル、薄い border、影、半透明 overlay、標準的なボタン階層が周辺 UI と調和しやすい。
  - 一方で `data-toggle="modal"` のようなページ側 JavaScript への依存は、userscript 側の安定性を下げる可能性がある。
  - 問題トグルは `btn btn-sm` 相当の小型ボタンへ寄せると、問題ページの解説ボタンや提出詳細ページの情報セル内と視覚的一貫性を持ちやすい。
  - 状態差は文言だけでなく色で補助できるが、削除用途でも強い警告色は避け、中立な default 系と追加を示す success 系の組み合わせが扱いやすい。
- **Implications**:
  - `MenuEntryAdapter` は独自の浮遊 UI を作らず、既存メニューの DOM 構文に寄せた差し込みを優先する。
  - `MenuEntryAdapter` は既存の設定系メニュー項目に近い挿入位置を優先し、新旧ヘッダーで利用できる最小限の補助アイコンを任意で添えられる。
  - `MenuEntryAdapter` は他 userscript との共存を前提に、`li.divider` を項目本体へ流用しない。末尾 `divider` がある場合はその前へ挿入し、`logout` 直前の区切りを維持する。
  - `MenuEntryAdapter` は `li` クラスを継承せず、リンク内アイコンのみを周辺メニューから再利用することで、サイズ差とセパレータ誤判定を回避する。
  - `PopupPresenter` は見た目だけ一般的なモーダル構成に寄せつつ、開閉と再描画の制御は userscript 側で自前実装する。
  - `PopupPresenter` は header 右上 close と footer の close 補助操作を持つ一般的なモーダル配置を採り、主要更新操作は本文内で問題タイトルの近くに置く。
  - userscript 固有のスタイルは必要最小限にとどめ、AtCoder 既存 Bootstrap クラスと大きく競合しない補助的な文字サイズ・余白指定だけを許容する。
  - `ToggleMountCoordinator` は問題ごとの文脈に密着した既存ボタン列や問題リンク行へ差し込み、提出番号見出しのような離れた位置へは出さない。

### AtCoder old layout modal scroll-lock behavior
- **Context**: 旧レイアウトの問題ページ・提出詳細ページで、userscript のモーダル表示中に背景スクロールが止まらない事象の原因を切り分ける必要があった。
- **Sources Consulted**:
  - ユーザー提供の旧レイアウト / 新レイアウト DOM 断面
  - ブラウザ Console での `document.scrollingElement`、`overflow`、AtCoder 純正モーダル挙動の確認結果
- **Findings**:
  - 旧レイアウトの競技ページでは `document.scrollingElement` が `HTML` になり、実スクロール主体が `body` ではなく `html` である。
  - 同状態で `body.modal-open` と `body { overflow: hidden; }` は有効でも、`html` 側は `overflow: auto scroll` のままであり、ページ全体のスクロールは継続する。
  - 旧レイアウトに元から存在する AtCoder 純正モーダル（例: `#modal-contest-start`）を `$('#modal-contest-start').modal('show')` で開いても、背景スクロールは止まらなかった。
  - 追加の fixed / sticky UI は存在するものの、主要候補に独立した scroll container は見当たらず、本件の主因ではなかった。
- **Implications**:
  - 旧レイアウトでの背景スクロール継続は `ac-revisit` 固有の DOM 差し込み不備ではなく、AtCoder 純正モーダルと同系統の制約として扱える。
  - MVP では AtCoder 既存 modal contract への追従を優先し、旧レイアウト専用の独自 scroll-lock 補完は行わない。
  - 将来この挙動を変える場合は、「AtCoder 既存挙動との一致」ではなく「userscript 独自補完」を導入する判断として明示的に扱う。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Single script monolith | 1 ファイルに UI と状態と DOM 操作を集約 | 初期実装が最短 | 境界が曖昧で保守性が低い | MVP でも変更時に破綻しやすい |
| Layered feature slices | DOM 入出力、アプリケーションサービス、永続化を分離 | 追跡しやすくテストしやすい | 小規模でも抽象化が少し増える | 本機能の規模に対して最適 |
| Full hexagonal | 厳密な ports and adapters | 境界が非常に明確 | userscript MVP に対して過剰 | 将来拡張時の参考に留める |

## Design Decisions

### Decision: レイヤードな userscript 構成を採用する
- **Context**: DOM 注入、日次判定、永続化、UI 操作を同時に扱うため、責務分離が必要だった。
- **Alternatives Considered**:
  1. 単一スクリプト集約
  2. レイヤードな feature slices
- **Selected Approach**: `UserscriptBootstrap`、`AtCoderPageAdapter`、`ReviewMutationService`、`ReviewStoreAdapter`、`PopupPresenter` に分割する。
- **Rationale**: DOM 変更点と状態遷移を分離でき、並行実装でも衝突しにくい。
- **Trade-offs**: ファイル数とインターフェース定義は増えるが、トランザクション境界とテスト対象が明確になる。
- **Follow-up**: タスク生成時に UI 層とドメイン層を分離して実装順を定義する。

### Decision: 永続化は GM storage を標準にする
- **Context**: ブラウザ内永続化かつ外部通信禁止の条件を満たしつつ、userscript とページの境界を保つ必要があった。
- **Alternatives Considered**:
  1. `localStorage`
  2. Tampermonkey `GM_*` storage
- **Selected Approach**: `GM_getValue` / `GM_setValue` を `ReviewStoreAdapter` の実装基盤にする。
- **Rationale**: userscript 固有ストレージであり、AtCoder 側の JavaScript や他スクリプトとの衝突を避けやすい。
- **Trade-offs**: Tampermonkey 依存は増えるが、要件上すでに Tampermonkey 前提のため許容範囲。
- **Follow-up**: 実装時に grant 設定と型定義の整合性を確認する。

### Decision: 今日の一問状態は単一レコードで持つ
- **Context**: 問題ごとの完了フラグを禁止し、単一トランザクションを保証する必要がある。
- **Alternatives Considered**:
  1. 問題ごとに完了属性を持たせる
  2. 今日の提案状態を独立レコード化する
- **Selected Approach**: `ReviewWorkspace = { reviewItems, dailyState }` の中で `dailyState` を単一レコードとして保持し、`reviewItems` と同一スナップショット内で更新する。
- **Rationale**: 問題データを「識別子・表示用タイトル・登録日」に限定したまま、今日の状態だけを別責務として管理しやすい。
- **Trade-offs**: 更新ごとに `ReviewWorkspace` 全体を書き換えるため、保存粒度は大きくなる。
- **Follow-up**: 設計で single snapshot の read modify write 手順と保存値検証ルールを定義する。

### Decision: 日跨ぎ時の未完了提案は持ち越さず、自動表示は bootstrap が担当する
- **Context**: 日跨ぎルールと自動ポップアップの責務分担が曖昧だと、実装者ごとに挙動がぶれる。
- **Alternatives Considered**:
  1. 前日未完了提案をそのまま持ち越す
  2. 日跨ぎ時に前日提案を stale として扱い、その日の評価結果へ置き換える
- **Selected Approach**: `DailySuggestionService` は日跨ぎ時に前日提案を継続扱いにせず、候補があれば新しい当日提案で上書きし、候補がなければ `activeProblemId = null` として破棄する。自動表示の起点は `UserscriptBootstrap` が担当する。
- **Rationale**: Requirement 4.3 / 4.5 の「持ち越さない」をそのまま日次正規化に反映できる。
- **Trade-offs**: 前日未完了でも翌日に同じ問題が消える、または再抽選される可能性がある。
- **Follow-up**: タスク化時に日跨ぎの統合テストを追加する。

### Decision: 複合更新は単一スナップショット更新に固定する
- **Context**: `reviewItems` と `dailyState` の整合を保ちつつ、ストレージ失敗時に中間状態を書き出さない手順を固定する必要があった。
- **Alternatives Considered**:
  1. 複数キーへ分割して書き込み順を管理する
  2. `ReviewWorkspace` 全体を単一キーへ一括保存する
- **Selected Approach**: `ac_revisit_workspace_v1` に `SchemaEnvelope` 全体を 1 回で直列化して保存し、部分状態や中間断片は書き出さない。
- **Rationale**: 真の原子性は保証できなくても、userscript 側から partial state を発生させない手順に固定できる。
- **Trade-offs**: 更新ごとに保存対象全体を書き換えるため、旧 schema との互換が崩れた場合は空状態フォールバックになりうる。
- **Follow-up**: `writeWorkspace` の単一スナップショット保存と schema mismatch 時の canonical empty state をテストで検証する。

## Risks & Mitigations
- AtCoder の DOM 変更でメニュー挿入位置が崩れる — `AtCoderPageAdapter` にセレクタ探索と fail closed を集約し、挿入不可時は UI を出さない。
- 日付境界の解釈差で 1 日 1 回制御が不安定になる — ブラウザのローカル日付文字列 `YYYY-MM-DD` を正規化キーとして保存する。
- ストレージ書き込み失敗や破損値で不整合が出る — `ReviewStoreAdapter` で単一スナップショット保存、schema 検証、canonical empty state フォールバックを一箇所に集約する。

## References
- [Tampermonkey Documentation](https://www.tampermonkey.net/documentation.php) — metadata block、grant、storage API の根拠
- [TypeScript TSConfig noEmit](https://www.typescriptlang.org/tsconfig/#noEmit) — ビルドと独立した型チェックの根拠
- [ESLint Getting Started](https://eslint.org/docs/latest/use/getting-started) — lint 初期化と flat config の現行方針
- [MDN localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) — ブラウザ内永続化の代替案比較
- [Greasy Fork code rules](https://greasyfork.org/en/help/code-rules) — 配布物制約
- [Greasy Fork meta keys](https://greasyfork.org/en/help/meta-keys) — metadata block の公開要件
