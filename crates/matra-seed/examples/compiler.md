# Bootstrap compiler

```compiler.matra.program
module compiler

fn empty_module() -> bytes {
  return __seed_empty_module()
}

fn diagnostic_module() -> bytes {
  return __seed_empty_module()
}

export fn compile(source: bytes) -> bytes {
  if byte_length(source) == 0 {
    return empty_module()
  }

  return diagnostic_module()
}
```

The initial bootstrap contract maps an empty source to the valid, empty Wasm
module `00 61 73 6d 01 00 00 00`. Until allocation and diagnostics are
implemented in Matra Program, the private `__seed_empty_module()` intrinsic
provides that byte slice. `empty_module()` and `diagnostic_module()` are defined
in Program so their implementations can be replaced without changing the
compiler entry point.
