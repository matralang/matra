# Bootstrap compiler

```compiler.matra.program
module compiler

export fn compile(source: bytes) -> bytes {
  if byte_length(source) == 0 {
    return empty_module()
  }

  return diagnostic_module()
}
```

The initial bootstrap contract maps an empty source to the valid, empty Wasm
module `00 61 73 6d 01 00 00 00`. Until allocation and diagnostics are
implemented in Matra Program, `diagnostic_module()` returns the same placeholder
module. A Program-defined function with either name supersedes the seed
intrinsic, allowing the compiler to replace these temporary implementations.
