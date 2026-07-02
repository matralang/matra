// MatraMagica flavored MatraScript Grammar
// ==========================
//
// Accepts expressions like "p`Hello, world!`" and computes their value.
//
// Syntax Modes:
// - 'mixed' (default): Both Block and Function syntax
// - 'document': Block syntax only (Pug-style with .class, #id, [attr])
// - 'application': Function syntax only (JSX-style)

Package
  = _ block:Block _ { return block }

Block
  = TagApply
  / TagBody
  / Tag
  / SetRule
  / StringNode
  / CommentNode

Tag
  = _ tag:Slug _ {
    return [tag, {}, []]
  }

TagApply
  = tag:Identifier _ "(" _ args:ArgList? _ ")" {
      const syntaxMode = options.syntaxMode || 'mixed';
      if (syntaxMode === 'document') {
        error('Function syntax is not allowed in document mode');
      }
      const props = {}, body = []
      for (const arg of args ?? []) {
        if (arg?.__kind === "keyword-prop") {
          if (Object.prototype.hasOwnProperty.call(props, arg.key)) {
            error(`Duplicate prop: ${arg.key}`)
          }
          props[arg.key] = arg.value
        } else if (arg?.__kind === "bare-object") {
          // Legacy compatibility: tag({ key: value }, child)
          for (const [key, value] of Object.entries(arg.value)) {
            if (Object.prototype.hasOwnProperty.call(props, key)) {
              error(`Duplicate prop: ${key}`)
            }
            props[key] = value
          }
        } else {
          body.push(arg)
        }
      }
      return [tag, props, body]
    }

ArgList
  = first:Arg rest:(_ "," _ Arg)* { return [first, ...rest.map(t => t[3])] }

Arg
  = KeywordProp
  / BareObject
  / TagApply
  / StringLiteral
  / Number
  / Boolean
  / Null
  / Identifier

KeywordProp
  = key:Identifier _ "=" _ value:PropValue {
      return { __kind: "keyword-prop", key, value }
    }

PropValue
  = StringLiteral
  / Number
  / Boolean
  / Null
  / Identifier

BareObject
  = "{" _ pairs:(BarePair (_ "," _ BarePair)*)? _ "}" {
      if (!pairs) return { __kind:"bare-object", value:{} }
      const xs = [pairs[0], ...(pairs[1] ? pairs[1].map(t => t[3]) : [])]
      return { __kind:"bare-object", value:Object.fromEntries(xs) }
    }

BarePair
  = key:(Identifier / StringLiteral) _ ":" _ val:(StringLiteral / Number / Boolean / Identifier) {
      const k = typeof key === "string" ? key.replace(/^\"|\"$/g, "") : key
      const v = typeof val === "string" && val.startsWith('"') ? val.slice(1, -1) : val
      return [k, v]
    }

StringLiteral
  = "\"" str:([^\"]*) "\"" {
    return str.join("")
  }

Number
  = value:$("-"? (([0-9]+ "." [0-9]*) / ("." [0-9]+) / [0-9]+) ([eE] [+-]? [0-9]+)?) {
    return Number(value)
  }

Boolean
  = "true" { return true }
  / "false" { return false }

Null
  = "null" { return null }

Identifier
  = !ReservedWord first:[a-zA-Z_] rest:[a-zA-Z0-9_\-]* {
    return first + rest.join("")
  }

ReservedWord
  = ("true" / "false" / "null") ![a-zA-Z0-9_\-]

TagBody
  = "$root" _ body:Body? {
    return ["$root", {}, body ?? []]
  }
  / _ tagName:Slug selectors:(ClassOrId)* setRuleArr:("[" @SetRule+ "]")? _ text:TildeText {
    const syntaxMode = options.syntaxMode || 'mixed';
    if (syntaxMode === 'application') {
      error('Block syntax is not allowed in application mode');
    }
    const classList = selectors.filter(s => s.type === 'class').map(s => s.value);
    const id = selectors.find(s => s.type === 'id')?.value;
    return [
      tagName,
      Object.assign(
        {},
        setRuleArr ? Object.fromEntries(setRuleArr) : {},
        id ? { id } : {},
        classList.length > 0 ? { class: classList.join(" ") } : {}
      ),
      [text],
    ]
  }
  / _ tagName:Slug selectors:(ClassOrId)* setRuleArr:("[" @SetRule+ "]")? _ text:BacktickText {
    const syntaxMode = options.syntaxMode || 'mixed';
    if (syntaxMode === 'application') {
      error('Block syntax is not allowed in application mode');
    }
    const classList = selectors.filter(s => s.type === 'class').map(s => s.value);
    const id = selectors.find(s => s.type === 'id')?.value;
    return [
      tagName,
      Object.assign(
        {},
        setRuleArr ? Object.fromEntries(setRuleArr) : {},
        id ? { id } : {},
        classList.length > 0 ? { class: classList.join(" ") } : {}
      ),
      [text],
    ]
  }
  / _ tagName:Slug selectors:(ClassOrId)* setRuleArr:("[" @SetRule+ "]")? _ body:Body? {
    const syntaxMode = options.syntaxMode || 'mixed';
    if (syntaxMode === 'application') {
      error('Block syntax is not allowed in application mode');
    }
    const classList = selectors.filter(s => s.type === 'class').map(s => s.value);
    const id = selectors.find(s => s.type === 'id')?.value;
    return [
      tagName,
      Object.assign(
        {},
        setRuleArr ? Object.fromEntries(setRuleArr) : {},
        id ? { id } : {},
        classList.length > 0 ? { class: classList.join(" ") } : {}
      ),
      body ?? [],
    ]
  }

ClassOrId
  = "." value:Slug { return { type: "class", value } }
  / "#" value:Slug { return { type: "id", value } }

Body
  = "{" _ @Expression _ "}"
  / "{" _ node:StringNode _ "}" { return [node] }

Expression
  = Array
  / block:Block { return [block] }
  / _

Array
  = arr:(Block _)+ {
    return arr.map(item => item[0])
  }

SetRule
  = _ key:Slug _ "=" _ val:String _ {
    return [key, val]
  }

StringNode
  = "\"" str:([^\"]*) "\"" {
    return str.join("")
  }

CommentNode
  = "<!--" _ strMatch:((!("-->") .)*) _ "-->" {
    return ["#comment", {}, [strMatch.map(item => item[1]).join("")]]
  }

Template
  = Slug

Slug
  = str:[^\'\"\(\)\[\]\{\}\<\>\=\|\#\.\`\~\n]+ {
    return str.join("").trim()
  }

String
  = "\"" str:[^\"]* "\"" {
    return str.join("")
  }

BacktickText
  = "`" str:([^`]*) "`" {
    return str.join("")
  }

TildeText
  = "~" str:([^~]*) "~" {
    return str.join("")
  }

_ "whitespace"
  = [ \t\n\r]*
