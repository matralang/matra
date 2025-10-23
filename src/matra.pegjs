// matra.pegjs — Matra Language Grammar (v0.5)
// -------------------------------------------------
// This grammar follows the "Matra Language White Paper v0.5" (JP) consolidated spec.
// Root returns Entry[] (array of entries).
// Entry includes Matra nodes, anonymous JSON nodes, Markdown subsets, and v0.5 additions:
//   - Markdown-style code block: ```lang\n...\n```
//   - Tagged template literal:  lang`...`   (one line)
//   - Markdown link:            [label](url)
//   - Markdown image:           ![alt](src)
// Scope policy (v0.5): these sugars are recognized only at Entry (block) level.
//
// Build (ESM):
//   peggy --format esm --output src/parser.mjs src/matra.pegjs
//
{
  function toMatrast(tag, props, body) {
    // During parse we allow variable length; runtime should normalize to a 3-tuple.
    const parts = [];
    if (tag !== undefined) parts.push(tag);
    if (props !== undefined) parts.push(props);
    if (body !== undefined) parts.push(body);
    return parts;
  }
  function objFrom(list) {
    return Object.fromEntries(list);
  }
  function coercePropVal(v) {
    // String tokens are emitted as raw JS strings already (see String rule).
    return v;
  }
}

// =====================
// Root
// =====================
Start
  = _ entries:EntryList? _ {
      return entries ?? [];
    }

EntryList
  = head:Entry tail:(__ Entry)* {
      return [head, ...tail.map(t => t[1])];
    }

// =====================
// Entry (block-level) — Order matters to avoid ambiguity
// =====================
Entry
  = TagDef
  / CodeBlock         // v0.5 sugar (Entry-only)
  / TaggedTemplate    // v0.5 sugar (Entry-only, single-line)
  / MarkdownLink      // v0.5 sugar (Entry-only)
  / MarkdownImage     // v0.5 sugar (Entry-only)
  / MarkdownHeading   // Add heading at entry level
  / Html
  / JsonOnly          // pure JSON -> anonymous node
  / Matra
  / MatrastLiteral
  / Markdown          // minimal subset (headings/paragraphs/codeblock)

// =====================
// Matra core
// =====================
Matra
  = tag:Tag _ props:Props? _ body:Body? {
      return toMatrast(tag, props ?? null, body ?? null);
    }
  / body:Body {
      return toMatrast(null, null, body);
    }

Tag
  = Identifier

Props
  = "[" _ kv:(PropKeyVal (_ "," _ PropKeyVal)*)? _ "]" {
      if (!kv) return {};
      const items = [kv[0], ...kv[1].map(t => t[3])];
      return Object.fromEntries(items.map(({k, v}) => [k, coercePropVal(v)]));
    }

PropKeyVal
  = k:Identifier _ "=" _ v:(String / Number / Boolean / Identifier) {
      return { k, v };
    }

Body
  = "{" _ content:(BodyContent)? _ "}" {
      if (!content) return [];
      return content;
    }

BodyContent
  = str:String { return [str]; }
  / items:(BodyEntry (_ BodyEntry)*) {
      const [first, rest] = items;
      return [first, ...rest.map(t => t[1])];
    }

// BodyEntry: Entry without Markdown paragraphs (to avoid ambiguity in body)
BodyEntry
  = TagDef
  / CodeBlock
  / TaggedTemplate
  / MarkdownLink
  / MarkdownImage
  / MarkdownHeading
  / Html
  / JsonOnly
  / Matra
  / MatrastLiteral

// =====================
// Matrast literal
// =====================
MatrastLiteral
  = "[" _ tag:String _ "," _ props:Object _ "," _ body:JsonValue _ "]" {
      return [tag, props, body];
    }

// =====================
// Pure JSON as anonymous node
// =====================
JsonOnly
  = v:JsonValue { return [v]; }

JsonValue
  = Object
  / Array
  / String
  / Boolean
  / Number

Object
  = "{" _ members:(RuleKeyVal (_ "," _ RuleKeyVal)*)? _ "}" {
      if (!members) return {};
      const xs = [members[0], ...members[1].map(t => t[3])];
      return objFrom(xs);
    }

RuleKeyVal
  = _ key:(Identifier / String) _ ":" _ val:(JsonValue / String / Number / Boolean) _ {
      return [key, val];
    }

Array
  = "[" _ elems:(Value (_ "," _ Value)*)? _ "]" {
      if (!elems) return [];
      return [elems[0], ...elems[1].map(t => t[3])];
    }

Value
  = JsonValue
  / MatrastLiteral    // allow embedded Matrast literal

// =====================
// Literals / Tokens
// =====================
String
  = QuotedString

QuotedString
  = '"' chars:$([^"\n]*) '"' { return chars; }

Number
  = n:$(
      [-+]? [0-9]+ ("." [0-9]+)?
    ) { return Number(n); }

Boolean
  = "true"  { return true; }
  / "false" { return false; }

Identifier
  = $([a-zA-Z_][a-zA-Z0-9_]*)

// =====================
// Markdown (minimal subset)
// =====================
Markdown
  = md:MarkdownBody { return md; }

MarkdownBody
  = head:MarkdownBlock tail:(__ MarkdownBlock)* { return [head, ...tail.map(t => t[1])]; }

MarkdownBlock
  = MarkdownHeading
  / MarkdownCodeBlock
  / MarkdownParagraph

MarkdownHeading
  = "# " t:TextLine { return toMatrast("h1", null, [t]); }
  / "## " t:TextLine { return toMatrast("h2", null, [t]); }
  / "### " t:TextLine { return toMatrast("h3", null, [t]); }
  / "#### " t:TextLine { return toMatrast("h4", null, [t]); }
  / "##### " t:TextLine { return toMatrast("h5", null, [t]); }
  / "###### " t:TextLine { return toMatrast("h6", null, [t]); }

MarkdownCodeBlock
  = "```" ft:Identifier? "\n" content:$(!"```" .)* "```" {
      const lines = content.split('\n').filter(line => line.trim() !== '');
      return toMatrast("code", ft ? { fileType: ft } : null, lines);
    }

MarkdownParagraph
  = t:TextLine _ { return toMatrast("p", null, [t]); }

TextLine
  = text:$([^\n]+) { return text.trim(); }

// =====================
// HTML (stub)
// =====================
Html
  = "::html::" { return toMatrast("doc", { type: "html" }, []); }

// =====================
// v0.5: New sugars (Entry-level only)
// =====================

// ```lang\n ... \n```
CodeBlock
  = "```" ft:Identifier? "\n" content:$(!"```" .)* "```" {
      const lines = content.split('\n').filter(line => line.trim() !== '');
      return ["code", ft ? { fileType: ft } : null, lines];
    }

// lang`...`  (one line)
TaggedTemplate
  = lang:Identifier "`" body:$([^`\n]+) "`" {
      return ["code", { fileType: lang }, [body]];
    }

// [label](url)
MarkdownLink
  = "[" label:$([^\]]+) "]" "(" url:$([^\) \n]+) ")" {
      return ["a", { href: url.trim() }, [label.trim()]];
    }

// ![alt](src)
MarkdownImage
  = "!" "[" alt:$([^\]]+) "]" "(" src:$([^\) \n]+) ")" {
      return ["img", { alt: alt.trim(), src: src.trim() }];
    }

// =====================
// tagdef (v0.4 feature)
// =====================
TagDef
  = "tagdef" _ name:Identifier _ "{" _ fields:TagFieldList? _ "}" {
      return ["tagdef", { name }, fields ?? []];
    }

TagFieldList
  = head:TagField tail:(_ "," _ TagField)* { return [head, ...tail.map(t => t[3])]; }

TagField
  = key:Identifier _ typeClause:(":" _ type:Identifier { return type; })? _ defaultClause:("=" _ def:Value { return def; })? {
      return { key, type: typeClause ?? null, default: defaultClause ?? null };
    }

// =====================
// Whitespace & Comments
// =====================
_ "whitespace"
  = (WS / LineComment / BlockComment)*

__ "required whitespace"
  = (WS / LineComment / BlockComment)+

WS
  = [ \t\r\n]+

LineComment
  = "//" [^\n]*

BlockComment
  = "/*" (!"*/" .)* "*/"
