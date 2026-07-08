# Examples

[English](./06-examples.md) | [日本語](./06-examples.ja.md)

> [!WARNING]
> この文書はCore v0.8のhistorical examplesです。現在のMatraではpackage責務やAST表現が異なる場合があります。

## Table of Contents

- [Blog Post Card](#blog-post-card)
- [Navigation Menu](#navigation-menu)
- [User Profile](#user-profile)
- [Product Grid](#product-grid)
- [Form with Validation](#form-with-validation)
- [Data Table](#data-table)
- [Comment Thread](#comment-thread)
- [Dashboard Widget](#dashboard-widget)

## Blog Post Card

```matra
article.card {
  h2 { "{{post.title}}" }
  p.meta { "{{post.author}} / {{post.date}}" }
  p { "{{post.summary}}" }
  a[href="{{post.url}}"] { "Read more" }
}
```

Blog cardでは、title、author、date、summary、urlをcontextから差し込みます。layoutはtemplateに、表示データはcontextに分けます。

## Navigation Menu

```matra
nav.menu {
  ul {
    li[m-each="items" m-as="item"] {
      a[href="{{item.href}}"] { "{{item.label}}" }
    }
  }
}
```

Navigationのような反復要素では`m-each`が有効です。active stateが必要な場合は、context側で`item.active`を計算しておきます。

## User Profile

```matra
section.profile {
  img[src="{{user.avatar}}" alt="{{user.name}}"] {}
  h1 { "{{user.name}}" }
  p[m-if="user.bio"] { "{{user.bio}}" }
}
```

Optionalなbioは`m-if`で出し分けます。avatar URLやalt textはcontextで必ず埋まるようにvalidateします。

## Product Grid

```matra
section.products {
  article.card[m-each="products" m-as="product"] {
    h2 { "{{product.name}}" }
    p.price { "{{product.price}}" }
    button[data-id="{{product.id}}"] { "Add to cart" }
  }
}
```

GridそのもののlayoutはCSSに任せ、Matra templateではsemanticなHTML構造を保ちます。

## Form with Validation

```matra
form[action="/signup" method="post"] {
  label[for="email"] { "Email" }
  input[id="email" name="email" type="email" required=true] {}
  p.error[m-if="errors.email"] { "{{errors.email}}" }
  button[type="submit"] { "Create account" }
}
```

Validation messageはcontextの`errors` objectで制御します。server-side renderingでは、送信後の入力値もcontextに戻すと再表示しやすくなります。

## Data Table

```matra
table {
  thead { tr { th { "Name" } th { "Status" } } }
  tbody {
    tr[m-each="rows" m-as="row"] {
      td { "{{row.name}}" }
      td { "{{row.status}}" }
    }
  }
}
```

Tableはheaderとbodyを分けると、反復範囲が明確になります。

## Comment Thread

```matra
section.comments {
  article.comment[m-each="comments" m-as="comment"] {
    h3 { "{{comment.author}}" }
    p { "{{comment.body}}" }
  }
}
```

Nested replyを扱う場合は、深いrecursive templateにする前にdata構造と表示上の深さ制限を決めます。

## Dashboard Widget

```matra
section.widget {
  h2 { "{{title}}" }
  p.value { "{{value}}" }
  p.delta[m-if="delta"] { "{{delta}}" }
}
```

Dashboardでは小さなtemplateをcompileして再利用すると、表示単位ごとの責務が明確になります。

## Next Steps

構文ごとの違いは[Syntax Comparison](./SYNTAX-COMPARISON.ja.md)、function syntaxの詳細は[Function Syntax Guide](./function-syntax.ja.md)を参照してください。
