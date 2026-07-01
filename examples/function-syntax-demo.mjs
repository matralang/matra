/**
 * Matra v0.8 Function Syntax Examples
 * ====================================
 *
 * This file demonstrates the new function-style syntax introduced in v0.8
 * alongside the existing block-style syntax from v0.7.
 */

import { compile } from "../dist/index.js"

console.log("=== Matra v0.8 Function Syntax Examples ===\n")

// Example 1: Simple function call
console.log("1. Simple function call:")
console.log('   Input:  p("Hello, World!")')
const ex1 = compile('p("Hello, World!")')
console.log("   Output:", ex1)
console.log()

// Example 2: Function with properties
console.log("2. Function with properties:")
console.log('   Input:  h1({class:"title", id:"main-title"}, "Welcome")')
const ex2 = compile('h1({class:"title", id:"main-title"}, "Welcome")')
console.log("   Output:", ex2)
console.log()

// Example 3: Nested function calls
console.log("3. Nested function calls:")
console.log('   Input:  div(h1("Title"), p("Paragraph"))')
const ex3 = compile('div(h1("Title"), p("Paragraph"))')
console.log("   Output:", ex3)
console.log()

// Example 4: Complex nested structure
console.log("4. Complex nested structure:")
const ex4Input =
  'article(header(h1("My Blog Post")), section(p("Introduction"), p("Content")), footer("© 2025"))'
console.log("   Input: ", ex4Input)
const ex4 = compile(ex4Input)
console.log("   Output:", ex4)
console.log()

// Example 5: Navigation menu
console.log("5. Navigation menu:")
const ex5Input =
  'nav({class:"menu"}, ul(li(a({href:"/"},"Home")), li(a({href:"/about"},"About")), li(a({href:"/contact"},"Contact"))))'
console.log("   Input: ", ex5Input)
const ex5 = compile(ex5Input)
console.log("   Output:", ex5)
console.log()

// Example 6: With template variables
console.log("6. With template variables:")
console.log('   Input:  div(h1("{{title}}"), p("{{content}}"))')
const ex6 = compile('div(h1("{{title}}"), p("{{content}}"))', {
  context: { title: "Welcome", content: "This is a test." },
})
console.log("   Output:", ex6)
console.log()

// Example 7: Self-closing elements
console.log("7. Self-closing elements:")
console.log('   Input:  div(img({src:"logo.png", alt:"Logo"}), br(), hr())')
const ex7 = compile('div(img({src:"logo.png", alt:"Logo"}), br(), hr())')
console.log("   Output:", ex7)
console.log()

// Example 8: Number and boolean properties
console.log("8. Number and boolean properties:")
console.log('   Input:  input({type:"checkbox", checked:true, tabindex:1})')
const ex8 = compile('input({type:"checkbox", checked:true, tabindex:1})')
console.log("   Output:", ex8)
console.log()

// Example 9: Comparison with block syntax
console.log("9. Comparison with block syntax:")
console.log('   Block:    div.container { h1#title { "Hello" } p { "World" } }')
const ex9a = compile('div.container { h1#title { "Hello" } p { "World" } }')
console.log("   Output:  ", ex9a)
console.log(
  '   Function: div({class:"container"}, h1({id:"title"}, "Hello"), p("World"))'
)
const ex9b = compile(
  'div({class:"container"}, h1({id:"title"}, "Hello"), p("World"))'
)
console.log("   Output:  ", ex9b)
console.log("   Same?   ", ex9a === ex9b)
console.log()

// Example 10: With m-if directive
console.log("10. With m-if directive:")
console.log('    Input:  p({"m-if":"show"}, "Conditional content")')
const ex10a = compile('p({"m-if":"show"}, "Conditional content")', {
  context: { show: true },
})
console.log("    Output (show=true): ", ex10a)
const ex10b = compile('p({"m-if":"show"}, "Conditional content")', {
  context: { show: false },
})
console.log("    Output (show=false):", ex10b)
console.log()

// Example 11: Card component pattern
console.log("11. Card component pattern:")
const cardInput = `
article({class:"card"},
  header({class:"card-header"},
    h2({class:"card-title"}, "{{title}}")
  ),
  div({class:"card-body"},
    p("{{description}}")
  ),
  footer({class:"card-footer"},
    a({href:"{{link}}", class:"btn"}, "Read more")
  )
)`
console.log("    Template:", cardInput.trim())
const ex11 = compile(cardInput, {
  context: {
    title: "Matra v0.8",
    description: "Now with function syntax!",
    link: "/docs/v0.8",
  },
})
console.log("    Output:", ex11)
console.log()

console.log("=== All examples completed successfully! ===")
