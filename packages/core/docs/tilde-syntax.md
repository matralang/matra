# Tilde Syntax (~text~)

Matra v0.8 では、**チルダ構文** (~text~) がサポートされました。これは[バッククォート構文](./backtick-syntax.md)と並ぶ、簡潔なテキストノード表記です。

## 基本構文

タグ名の直後にチルダ(`~`)でテキストを囲むことで、テキストノードを持つ要素を簡潔に記述できます。

```matra
h1~Hello, World!~
```

↓ 出力:

```html
<h1>Hello, World!</h1>
```

## バッククォート構文との違い

バッククォート(`` ` ``)とチルダ(`~`)は機能的に同等で、どちらを使うかは好みの問題です:

```matra
// バッククォート
h1`Hello`

// チルダ
h1~Hello~

// どちらも同じ出力: <h1>Hello</h1>
```

### 選択のガイドライン

- **バッククォート (`` `text` ``)**: JavaScript のテンプレートリテラルに近い見た目
- **チルダ (`~text~`)**: Markdown 風の記号、視覚的に目立ちやすい

## クラスと ID セレクター

Pug 風のクラス(`.`)と ID(`#`)セレクターと組み合わせ可能:

```matra
// クラス
div.container~Content~

// ID
div#main~Content~

// 両方
section#hero.banner~Welcome~
```

## 属性

属性も併用できます:

```matra
a[href="/about"]~About Us~
button[type="submit"]~Send~
img[src="photo.jpg" alt="Photo"]~~
```

空のテキスト(`~~`)は空要素を表します。

## ネスト

ブロック構文内でチルダ構文を使用できます:

```matra
nav {
  a[href="/"]~Home~
  a[href="/about"]~About~
  a[href="/contact"]~Contact~
}
```

## 他の構文との混在

チルダ構文は他のテキスト記法と自由に混在できます:

```matra
div {
  h1~Title~              // チルダ
  p`Paragraph`           // バッククォート
  span { "Text" }        // ブロック構文
  strong("Bold")         // 関数構文
}
```

## 実用例

### ナビゲーションメニュー

```matra
nav.navbar {
  a[href="/"]~Home~
  a[href="/products"]~Products~
  a[href="/about"]~About~
  a[href="/contact"]~Contact~
}
```

### カードコンポーネント

```matra
article.card {
  h2.card-title~Card Title~
  p.card-text~This is the card content.~
  button.btn-primary~Read More~
}
```

### フォームラベル

```matra
form {
  label[for="username"]~Username:~
  input[type="text" id="username"]~~

  label[for="email"]~Email:~
  input[type="email" id="email"]~~

  button[type="submit"]~Submit~
}
```

## 構文モードでの動作

チルダ構文は Block 構文の一部として扱われます:

- **Mixed Mode** (デフォルト): ✅ 使用可能
- **Document Mode**: ✅ 使用可能
- **Application Mode**: ❌ 使用不可 (Block 構文が禁止されているため)

```javascript
import { matra } from "@matra/core"

// Mixed/Document mode: OK
matra("p~Text~") // ✅
matra("p~Text~", { mode: "document" }) // ✅

// Application mode: Error
matra("p~Text~", { mode: "application" }) // ❌ Error
```

## まとめ

チルダ構文は:

- ✅ バッククォート構文の代替記法
- ✅ クラス・ID・属性と併用可能
- ✅ ブロック構文内でネスト可能
- ✅ 他の構文と自由に混在可能
- ⚠️ Block 構文扱いのため、Application Mode では使用不可

どちらの記法を使うかは完全に好みの問題です。プロジェクト内で統一するか、用途に応じて使い分けてください。

---

関連ドキュメント:

- [バッククォート構文](./backtick-syntax.md)
- [構文モード](./syntax-modes.md)
- [構文比較](./SYNTAX-COMPARISON.md)
