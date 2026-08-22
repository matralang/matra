# Bootstrap compiler

```compiler.matra.program
module compiler

fn empty_module() -> bytes {
  let output = allocate_bytes(8)
  byte_set(output, 0, 0)
  byte_set(output, 1, 97)
  byte_set(output, 2, 115)
  byte_set(output, 3, 109)
  byte_set(output, 4, 1)
  byte_set(output, 5, 0)
  byte_set(output, 6, 0)
  byte_set(output, 7, 0)
  return output
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
module `00 61 73 6d 01 00 00 00`. `allocate_bytes(size)` returns a `bytes`
value backed by the generated module's linear memory, and `byte_set(bytes,
index, value)` writes one byte. Diagnostics remain a placeholder until their
record format is implemented.
