# Matra Grammar v0.2

[English](./grammar.md) | [日本語](./grammar.ja.md) | [Index](./README.md)

## Source text

Source text is Unicode. Space, tab, carriage return, and line feed are
whitespace. Whitespace between tokens is insignificant except inside text
delimiters. A document MUST contain exactly one root expression.

## Function syntax

Function syntax is the canonical notation:

```matra
section(heading("Title"), paragraph("Body"), id="intro")
```

The identifier before `(` is the tag. Positional arguments become children in
source order. `name=value` arguments become properties.

An identifier begins with an ASCII letter or `_`, followed by ASCII letters,
digits, `_`, or `-`. `true`, `false`, and `null` are reserved.

Literals are double-quoted strings, numbers, booleans, and `null`. Numbers may
be signed and may contain a decimal fraction or exponent. v0.2 does not define
string escape sequences. A bare identifier in value position denotes a
string.

For compatibility, `{key: value}` MAY supply properties as an argument.
Keyword properties are canonical; new documents SHOULD NOT use this
object-style form.

## Document syntax

Document syntax is the compact alternative:

```matra
article.card#main[lang="en"] {
  h1 { "Title" }
  p`Body`
}
```

`.name` adds a class, `#name` sets the ID, and `[name="value"]` adds a string
property. Multiple classes are joined with one space. A brace body contains
child nodes or a quoted string.

Backtick and tilde text each produce one string child:

```matra
p`hello`
p~hello~
```

Their delimiters cannot be escaped in v0.2. `$root { ... }` MAY provide a
synthetic root for several children. `<!-- text -->` produces a `#comment`
node whose single child is the comment text.

## Reference grammar

The following EBNF is descriptive. Lexical exclusions and error handling in a
conforming parser MUST produce the behavior specified above.

```ebnf
document       = expression ;
expression     = function-node | document-node | root-node | comment ;
function-node  = identifier, "(", [ argument, { ",", argument } ], ")" ;
argument       = property | object-props | function-node | literal | identifier ;
property       = identifier, "=", value ;
object-props   = "{", [ pair, { ",", pair } ], "}" ;
pair           = (identifier | string), ":", value ;
value          = string | number | boolean | null | identifier ;
document-node  = tag, { class | id }, [ attributes ], [ body | short-text ] ;
attributes     = "[", { tag, "=", string }, "]" ;
body           = "{", { expression }, "}" | "{", string, "}" ;
short-text     = "`", text, "`" | "~", text, "~" ;
root-node      = "$root", [ body ] ;
comment        = "<!--", text, "-->" ;
class          = ".", tag ;
id             = "#", tag ;
literal        = string | number | boolean | null ;
```

## Equivalent forms

These forms MUST produce data-model-equivalent nodes:

```matra
p("hello", class="lead")
p.lead { "hello" }
```
