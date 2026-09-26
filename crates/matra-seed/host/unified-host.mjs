/** 統一文法の暫定 host value ABI。制御フローは生成 Wasm が実行する。 */
export async function instantiateUnified(bytes) {
  const values = [undefined]
  const intern = value => { values.push(value); return values.length - 1 }
  const value = handle => {
    if (!Number.isInteger(handle) || handle < 0 || handle >= values.length) throw new RangeError("Invalid Matra value handle")
    return values[handle]
  }
  const scopes = [undefined]
  const scope = handle => {
    const result = scopes[handle]
    if (!result) throw new RangeError("Invalid Matra scope handle")
    return result
  }
  const binding = (handle, name) => {
    for (let current = scope(handle); current; current = current.parent) {
      if (current.bindings.has(name)) return current
    }
    throw new ReferenceError(`Unknown name: ${name}`)
  }
  const own = (object, name, item) => { Object.defineProperty(object, name, { value: item, enumerable: true, configurable: true, writable: true }); return object }
  const array = handle => { const result = value(handle); if (!Array.isArray(result)) throw new TypeError("Expected an array"); return result }
  let instance
  const imports = { matra: {
    literal(pointer, length) { return intern(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(instance.exports.memory.buffer, pointer, length)))) },
    scope(parent) { scopes.push({ parent: parent ? scope(parent) : undefined, bindings: new Map() }); return scopes.length - 1 },
    bind(env, key, item) { const name = value(key); const target = scope(env); if (target.bindings.has(name)) throw new SyntaxError(`Duplicate binding: ${name}`); target.bindings.set(name, item); return item },
    assign(env, key, item) { binding(env, value(key)).bindings.set(value(key), item); return item },
    get(env, key) { return binding(env, value(key)).bindings.get(value(key)) },
    array() { return intern([]) },
    push(target, item) { array(target).push(value(item)); return target },
    spread(target, items) { array(target).push(...array(items)); return target },
    object() { return intern({}) },
    property(target, key, item) { own(value(target), value(key), value(item)); return target },
    member(target, key) { const object = value(target); const name = value(key); if (object == null || !Object.hasOwn(Object(object), name)) throw new ReferenceError(`Unknown member: ${name}`); return intern(object[name]) },
    unary(op, operand) { return intern(value(op) === "!" ? !value(operand) : -Number(value(operand))) },
    binary(op, left, right) {
      const a = value(left); const b = value(right)
      const operators = { "+": () => a + b, "-": () => a - b, "*": () => a * b, "/": () => a / b, "==": () => a === b, "!=": () => a !== b, "<": () => a < b, "<=": () => a <= b, ">": () => a > b, ">=": () => a >= b }
      const operation = operators[value(op)]
      if (!operation) throw new TypeError("Unknown binary operator")
      return intern(operation())
    },
    truthy(item) { return Number(Boolean(value(item))) },
    function(index, env) {
      return intern((...args) => value(instance.exports.__functions.get(index)(env, intern(args))))
    },
    call(callee, args) { const fn = value(callee); if (typeof fn !== "function") throw new TypeError("Call target is not a function"); return intern(fn(...array(args))) },
    node(tag, props, children) { return intern({ tag: value(tag), props: value(props), children: array(children) }) },
    length(target) { return array(target).length },
    item(target, index) { return intern(array(target)[index] ?? null) },
  } }
  const result = await WebAssembly.instantiate(bytes, imports)
  instance = result instanceof WebAssembly.Instance ? result : result.instance
  return { instance, run: () => value(instance.exports.run()) }
}
