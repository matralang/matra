// MatraMagica flavored MatraScript Grammar
// ==========================
//
// Accepts expressions like "p`Hello, world!`" and computes their value.

Package
  = docType:"<!DOCTYPE html>"? _ block:Block _ { return block }

Block
  = TagBody
  / Tag
  / SetRule
  / HtmlElement
  / StringNode
  / CommentNode

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

CommentNode
  = "<!--" _ strMatch:((!("-->") .)*) _ "-->" {
    return {
      type: "comment",
      value: strMatch.map(item => item[1]).join("")
    }
  }

Template
  = Slug

Slug
  = str:[^\'\"\(\)\[\]\{\}\<\>\=\|\#\.\`\n]+ {
    return str.join("").trim()
  }

HtmlElement
  = tagProp:HtmlTagOpen children:HtmlContent* HtmlTagClose _ {
    return {
      type: "element",
      ...tagProp,
      children,
    }
  }
  / tagProp:HtmlTagSelfClose _ {
    return {
      type: "element",
      ...tagProp,
    }
  }

HtmlTagOpen
  = "<" tagName:HtmlIdentifier _ prop:HtmlAttributes? ">" {
    return {
      tagName,
      properties: prop ?? {},
    }
  }

HtmlTagSelfClose
  = "<" tagName:HtmlIdentifier _ prop:HtmlAttributes? "/>" {
    return {
      tagName,
      properties: prop ?? {},
    }
  }

HtmlTagClose
  = "</" HtmlIdentifier ">"

HtmlIdentifier
  = str:([a-zA-Z0-9\-]+) {
    return str.join("")
  }

HtmlAttributes
  = attrArr:HtmlAttribute+ {
    return Object.fromEntries(attrArr)
  }

HtmlAttribute
  = key:HtmlIdentifier "=" val:HtmlQuotedString _ {
    return [key, val]
  }
  / key:HtmlIdentifier {
    return [key, true]
  }

HtmlContent = HtmlElement / HtmlText / HtmlComment

HtmlText
  = str:([^<]+) {
    return {
      type: "text",
      value: str.join("")
    }
  }

HtmlComment
  = CommentNode

HtmlQuotedString
  = "\"" str:([^\"]*) "\"" {
    return str.join("")
  }

String
  = "\"" str:[^\"]* "\"" {
    return str.join("")
  }

_ "whitespace"
  = [ \t\n\r]*