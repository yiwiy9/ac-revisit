# Requirements Document

## Introduction
ac-revisit は、AtCoder にログイン中の利用者が復習したい問題を管理し、14日間隔で「今日の一問」を1問だけ提案するブラウザ内完結のユーザースクリプトである。設計思想は「最小限・静か・非強制」であり、利用者の自己判断による復習完了を支援する。

## Requirements

### Requirement 1: 利用前提とデータ境界
**Objective:** As a AtCoderログインユーザー, I want ログイン前提かつローカル完結で利用したい, so that 外部依存なく安心して復習記録を保持できる

#### Acceptance Criteria
1. While AtCoder にログインしていない状態, the ac-revisit スクリプト shall 復習提案および復習操作UIを提供しない.
2. The ac-revisit スクリプト shall 復習データをブラウザ内に永続化する.
3. The ac-revisit スクリプト shall 外部APIおよび外部サーバーへの通信を行わない.

### Requirement 2: 復習対象の登録と解除
**Objective:** As a AtCoderログインユーザー, I want 問題を復習対象へ登録/解除したい, so that 復習したい問題を自分で管理できる

#### Acceptance Criteria
1. When 問題ページを表示したとき, the ac-revisit スクリプト shall 復習対象の登録・解除トグルを表示する.
2. When 提出詳細ページを表示したとき, the ac-revisit スクリプト shall 復習対象の登録・解除トグルを表示する.
3. When 利用者が未登録問題で登録トグルを押したとき, the ac-revisit スクリプト shall 当該問題を復習対象として追加する.
4. When 利用者が登録済み問題で解除トグルを押したとき, the ac-revisit スクリプト shall 当該問題を復習対象から完全に削除する.

### Requirement 3: 復習候補判定ルール
**Objective:** As a AtCoderログインユーザー, I want 一貫したルールで提案候補が選ばれてほしい, so that 復習タイミングを予測しやすい

#### Acceptance Criteria
1. The ac-revisit スクリプト shall 各問題の復習間隔を固定14日として扱う.
2. When 問題に完了履歴がない場合, the ac-revisit スクリプト shall 登録日から14日経過後に提案候補として扱う.
3. When 問題に完了履歴がある場合, the ac-revisit スクリプト shall 前回完了日から14日経過後に提案候補として扱う.
4. The ac-revisit スクリプト shall 定着判定や間隔最適化アルゴリズムを要求しない.

### Requirement 4: 日次提案と通知
**Objective:** As a AtCoderログインユーザー, I want 1日1回だけ静かに提案を受けたい, so that 復習の負担感を減らせる

#### Acceptance Criteria
1. When 利用者がその日に初めて AtCoder を開いたとき, the ac-revisit スクリプト shall 提案候補からランダムに1問を選び今日の一問として設定する.
2. When その日の自動通知が未実施で今日の一問が設定されたとき, the ac-revisit スクリプト shall 問題リンクのみを含むポップアップ通知を1回だけ表示する.
3. While 同一日の2回目以降のアクセス, the ac-revisit スクリプト shall 追加の自動ポップアップ通知を表示しない.
4. If 提案候補が存在しない場合, the ac-revisit スクリプト shall 新規通知を表示しない.
5. The ac-revisit スクリプト shall ポップアップ通知に完了・削除・もう1問などの操作ボタンを含めない.
6. The ac-revisit スクリプト shall 1日の判定を利用者のブラウザローカル日付単位で扱う.

### Requirement 5: Current Suggestion の保持と導線
**Objective:** As a AtCoderログインユーザー, I want 現在の提案問題へ常時アクセスしたい, so that 復習導線を見失わない

#### Acceptance Criteria
1. The ac-revisit スクリプト shall 同時に扱う現在の提案問題を常に1問に限定する.
2. When AtCoder ヘッダー右端のユーザー名メニューを開いたとき, the ac-revisit スクリプト shall 現在の提案問題へアクセスする導線を表示する.
3. If 現在の提案問題が存在しない場合, the ac-revisit スクリプト shall 現在の提案問題リンクを無効な遷移先にしない.
4. While 現在の提案問題が削除または明示的にクリアされていない状態, the ac-revisit スクリプト shall ページ遷移や再訪問後も同一の現在提案問題を保持する.

### Requirement 6: 現在の提案問題に対するユーザー操作
**Objective:** As a AtCoderログインユーザー, I want 提案問題を完了・削除・追加提案要求で操作したい, so that 自分の復習ペースを維持できる

#### Acceptance Criteria
1. When 利用者が現在の提案問題を完了として扱ったとき, the ac-revisit スクリプト shall その日を新しい完了日として記録する.
2. When 利用者が現在の提案問題を復習対象から削除したとき, the ac-revisit スクリプト shall 当該問題を復習対象から削除し現在の提案状態をクリアする.
3. When 現在の提案問題が削除され提案状態がクリアされたとき, the ac-revisit スクリプト shall 自動で別問題に差し替えない.
4. When 現在の提案問題が未完了の状態で利用者がもう1問を要求したとき, the ac-revisit スクリプト shall 提案問題を差し替えない.
5. When 現在の提案問題が完了済みの状態で利用者がもう1問を要求したとき, the ac-revisit スクリプト shall 提案候補からランダムに1問を新しい提案問題として設定する.
6. When もう1問の要求で新しい提案問題を設定したとき, the ac-revisit スクリプト shall 追加の自動ポップアップ通知を表示しない.
7. When もう1問の要求で提案候補が存在しないとき, the ac-revisit スクリプト shall 現在の提案問題を新規作成しない.

### Requirement 7: 提出詳細ページでの自動AC検知
**Objective:** As a AtCoderログインユーザー, I want AC時に手動操作を減らしたい, so that 復習完了記録を簡単に更新できる

#### Acceptance Criteria
1. When 提出詳細ページを表示したとき, the ac-revisit スクリプト shall 現在の提案問題に対する当日AC判定を実行できる.
2. If 現在の提案問題が当日ACであることを検知した場合, the ac-revisit スクリプト shall 当該提案問題を自動で完了として記録する.
3. While 自動AC検知を実行中, the ac-revisit スクリプト shall ページ利用をブロックしない.
4. If 自動AC検知に失敗した場合, the ac-revisit スクリプト shall 手動完了操作を継続して利用可能にする.
5. The ac-revisit スクリプト shall 提出一覧ページを自動AC検知の対象にしない.
6. If 提出詳細ページの提出結果がAC以外である場合, the ac-revisit スクリプト shall 自動完了を記録しない.

### Requirement 8: MVPスコープ制約
**Objective:** As a プロダクトオーナー, I want MVP対象外機能を明確に除外したい, so that 初期リリースを最小構成で成立させる

#### Acceptance Criteria
1. The ac-revisit スクリプト shall 復習対象一覧画面を提供しない.
2. The ac-revisit スクリプト shall デュー可視化、メモ、タグ、ストリーク、統計分析機能を提供しない.
3. The ac-revisit スクリプト shall 復習間隔の動的変更機能を提供しない.

### Requirement 9: 配布形態と実行環境
**Objective:** As a 利用者, I want 想定配布経路と実行環境で利用したい, so that 導入手順と期待挙動が一致する

#### Acceptance Criteria
1. The ac-revisit スクリプト shall Greasy Fork 配布を前提としたユーザースクリプトとして提供される.
2. The ac-revisit スクリプト shall Tampermonkey へインストールして実行できる形で提供される.
3. While AtCoder ドメイン以外のページ, the ac-revisit スクリプト shall 復習提案機能を動作対象にしない.
