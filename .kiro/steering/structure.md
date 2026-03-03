# Project Structure

## Organization Philosophy

全体は「起動」「ページ統合」「ドメイン規則」「保存」「表示」「共有基盤」を分離したレイヤード構成とする。新しいコードは、責務がどの層に属するかを先に決めてから追加する。

## Directory Patterns

### Bootstrap Layer
**Location**: `/src/bootstrap/`  
**Purpose**: 起動順序の統括、依存組み立て、失敗時の入口制御。  
**Example**: 認証確認後に menu/toggle 差し込み、当日提案、自動ポップアップ判定を順に実行する。

### Runtime Integration
**Location**: `/src/runtime/`  
**Purpose**: AtCoder DOM の固定セレクタ、ログイン判定、ページ種別判定、差し込みアンカー解決。  
**Example**: 問題ページか提出詳細ページかを判定し、解決不能なら fail-closed で打ち切る。

### Domain Services
**Location**: `/src/domain/`  
**Purpose**: 14 日ルール、日次選定、登録/解除/完了/再抽選、stale 判定など副作用境界の中心。  
**Example**: `Result` 型で成功・失敗を返し、UI 層へ例外制御を漏らさない。

### Persistence
**Location**: `/src/persistence/`  
**Purpose**: 単一スナップショット保存と schema 正規化。  
**Example**: 保存値が壊れていれば部分復旧せず canonical 空状態へ落とす。

### Presentation
**Location**: `/src/presentation/`  
**Purpose**: ポップアップ描画と表示用状態決定。  
**Example**: ボタン文言や活性/非活性判定は ViewModel 生成へ集約する。

### Shared Foundations
**Location**: `/src/shared/`  
**Purpose**: 共通型とローカル日付ルールの定義元。  
**Example**: `LocalDateKey` の生成と 14 日判定の前提をここに固定する。

### Tooling and Tests
**Location**: `/scripts/`, `/test/`  
**Purpose**: 配布物生成と、純粋ロジック + DOM 挙動の検証。  
**Example**: build script と metadata の契約もテストで固定する。

## Naming Conventions

- **Files**: 小文字ケバブケースを基本とし、1 ファイル 1 主要責務を保つ。
- **Factory Functions**: `createXxx` で生成関数を明示する。
- **Types / Interfaces**: `XxxInput`, `XxxResult`, `XxxError`, `XxxService` のように役割を接尾辞で表す。
- **Constants**: DOM ID や storage key は大文字スネークケースで固定値として置く。

## Import Organization

```typescript
import type { ReviewWorkspace } from "../shared/types.ts";
import { createReviewStoreAdapter } from "../persistence/review-store";
```

**Path Strategy**:
- パスエイリアスは使わず、相対 import を維持する。
- Type-only import と値 import を分け、依存意図を明確にする。
- `.ts` 拡張子付き import は NodeNext 用の script/test 側で許容される。アプリ本体は既存スタイルに合わせる。

## Code Organization Principles

- 新しい機能は、まず `shared` か既存 `domain` にルールを寄せ、UI 側でルールを重複させない。
- DOM 解決不能、保存失敗、状態不整合は、ユーザー通知を増やす前に静かに停止または再描画する方向を優先する。
- 永続化されるデータは最小限を維持し、派生状態や補助フラグを安易に追加しない。
- テストは「純粋ロジックの固定」と「起動導線の回帰防止」を分けて配置する。

---
_新しいファイルはこの責務分割と命名に従う限り、構成ルールの更新を必要としない_
