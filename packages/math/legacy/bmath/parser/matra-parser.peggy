// Matra Grammar
// ==========================
//
// Accepts expressions like `f(a=5, b=3, 8)` and computes their value.

{{
  function toMatrast(head, attributes = {}, children = []) {
    return { head, attributes, children }
  }
}}

Matra "expression"
  = head:Identifier _ "(" _ attributes:Attributes _ "," _ children:Children ")" {
    return toMatrast(head, attributes, children)
  }
  / head:Identifier _ "(" _ attributes:Attributes _ ")" {
    return toMatrast(head, attributes)
  }
  / head:Identifier _ "(" _ children:Children _ ")" {
    return toMatrast(head, {}, children)
  }
  / head:Identifier {
    return toMatrast(head)
  }
  / JsonValue
  / "::expression::"

Attributes "attributes"
  = head:PropKeyVal _ tail:("," _ @PropKeyVal)* {
    return Object.fromEntries([head, ...tail])
  }
  / "::attributes::"

PropKeyVal "propKeyVal"
  = key:Identifier _ "=" _ val:Matra {
    return [key, val]
  }
  / "::propKeyVal::"

Children "children"
  = head:Matra _ tail:("," _ @Matra)* {
    return [head, ...tail]
  }
  / "children"

JsonValue "jsonValue"
  = Object
  / Array
  / String
  / Boolean
  / Number
  / "::jsonValue::"

Object "object"
  = "{" _ head:RuleKeyVal _ tail:("," _ @RuleKeyVal)* _ "}" {
    return Object.fromEntries([head, ...tail])
  }
  / "::object::"

RuleKeyVal "ruleKeyVal"
  = _ key:Identifier _ ":" _ val:Identifier _ {
    return [key, val]
  }
  / "::ruleKeyVal::"

Value "value"
  = JsonValue
  / "::value::"

Array "array"
  = "[" _ head:Value? _ tail:("," _ @Value)* _ "]" {
    return [head, ...tail]
  }
  / "::array::"

String "string"
  = '"' @$([^\"]*)  '"'
  / "::string::"

Number "number"
  = num:$("-"? [1-9][0-9]*) {
    return Number(num)
  }
  / "0" { return 0 }
  / "::number::"

Boolean "boolean"
  = "true" { return true }
  / "false" { return false }
  / "::boolean::"
  
Identifier "identifier"
  = $([a-zA-Z_][a-zA-Z0-9_]*)

_ "whitespace"
  = [ \t\n\r]*
