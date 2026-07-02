// MatraMagica flavored MatraScript Grammar
// ==========================
//
// Accepts expressions like `
// html[lang="en"] {
//   head {
//     meta[charset="UTF-8"]
//     meta[name="viewport" content="width=device-width, initial-scale=1.0"]
//     title { "Sample HTML" }
//   }
//   body {
//     h1 { "Welcome to My Page" }
//     p { "This is a sample page created using the matra templating system." }
//     ul {
//       li { "Item 1" }
//       li { "Item 2" }
//       li { "Item 3" }
//     }
//   }
// }`

Package
  = docType:"<!DOCTYPE html>"? _ block:Block _ { return block }

Block
  = TagBody
  / Tag
  / SetRule
  / StringNode

Tag
  = _ tag:Slug _ {
    return { tag, properties: {}, children: [] }
  }

TagBody
  = "$root" _ body:Body? {
    return {
      type: "root",
      children: body ?? [],
    }
  }
  / _ tagName:Slug classList:("." @Slug)* id:("#" @Slug)? setRuleArr:("[" @SetRule+ "]")? _ body:Body? {
    return {
      type: "element",
      tagName,
      properties: Object.assign(
        {},
        setRuleArr ? Object.fromEntries(setRuleArr) : {},
        id ? { id } : {},
        classList.length > 0 ? { class: classList.join(" ") } : {}
      ),
      children: body ?? [],
    }
  }

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
    return { type: "text", value: str.join("") }
  }

Slug
  = str:[^\'\"\(\)\[\]\{\}\<\>\=\|\#\.\`\n]+ {
    return str.join("").trim()
  }

String
  = "\"" str:[^\"]* "\"" {
    return str.join("")
  }

_ "whitespace"
  = [ \t\n\r]*
 No newline at end of file
