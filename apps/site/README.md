# @matra/site

Matra の公式サイトです。現在は静的サイトを生成し、今後はドキュメントと Playground もこの app にまとめます。

## 開発

リポジトリのルートで依存関係をインストールし、次のコマンドを実行します。

```sh
npm run site:build
npm run site:serve
```

ページは `src/pages`、共通レイアウトは `src/layouts`、スタイルは `src/styles` に置きます。

## 拡張方針

- 公式サイト: `src/pages` の静的ページ
- ドキュメント: `/docs/` 以下
- Playground: `/playground/` 以下
