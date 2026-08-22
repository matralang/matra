# Bootstrap compiler

```compiler.matra.program
module compiler

struct token {
  kind: i32
  start: i32
  length: i32
}

fn is_space(value: i32) -> i32 {
  if value == 9 {
    return 1
  }
  if value == 10 {
    return 1
  }
  if value == 13 {
    return 1
  }
  if value == 32 {
    return 1
  }
  return 0
}

fn is_identifier(value: i32) -> i32 {
  if value >= 65 {
    if value <= 90 {
      return 1
    }
  }
  if value >= 97 {
    if value <= 122 {
      return 1
    }
  }
  if value == 95 {
    return 1
  }
  return 0
}

fn is_digit(value: i32) -> i32 {
  if value >= 48 {
    if value <= 57 {
      return 1
    }
  }
  return 0
}

fn next_token(source: bytes, offset: i32) -> token {
  let position = offset
  let source_length = byte_length(source)
  while position < source_length {
    let value = byte_at(source, position)
    if is_space(value) == 1 {
      position = position + 1
    } else {
      if value == 47 {
        if position + 1 < source_length {
          if byte_at(source, position + 1) == 47 {
            position = position + 2
            while position < source_length {
              if byte_at(source, position) == 10 {
                break
              }
              position = position + 1
            }
          } else {
            break
          }
        } else {
          break
        }
      } else {
        break
      }
    }
  }
  if position == source_length {
    return token(0, position, 0)
  }

  let start = position
  let first = byte_at(source, position)
  if is_identifier(first) == 1 {
    position = position + 1
    while position < source_length {
      if is_identifier(byte_at(source, position)) == 1 {
        position = position + 1
      } else {
        if is_digit(byte_at(source, position)) == 1 {
          position = position + 1
        } else {
          break
        }
      }
    }
    return token(1, start, position - start)
  }
  if is_digit(first) == 1 {
    position = position + 1
    while position < source_length {
      if is_digit(byte_at(source, position)) == 1 {
        position = position + 1
      } else {
        break
      }
    }
    return token(2, start, position - start)
  }
  return token(3, start, 1)
}

// A temporary execution probe keeps the bootstrap lexer observable from the
// seed compiler integration test. It is not part of the long-term compiler ABI.
export fn token_summary(source: bytes) -> i32 {
  let value = next_token(source, 0)
  return value.kind * 1000 + value.start * 100 + value.length
}

fn write_i32(buffer: bytes, index: i32, value: i32) -> bytes {
  byte_set(buffer, index, value)
  byte_set(buffer, index + 1, value / 256)
  byte_set(buffer, index + 2, value / 65536)
  byte_set(buffer, index + 3, value / 16777216)
  return buffer
}

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

export fn alloc(size: i32) -> i32 {
  let bytes = allocate_bytes(size)
  return byte_pointer(bytes)
}

fn success_record(output: bytes) -> i32 {
  let record = allocate_bytes(20)
  let status = write_i32(record, 0, 0)
  let output_pointer = write_i32(status, 4, byte_pointer(output))
  let output_length = write_i32(output_pointer, 8, byte_length(output))
  let diagnostic_pointer = write_i32(output_length, 12, 0)
  let diagnostic_length = write_i32(diagnostic_pointer, 16, 0)
  return byte_pointer(diagnostic_length)
}

fn diagnostic_record() -> i32 {
  let record = allocate_bytes(20)
  let status = write_i32(record, 0, 1)
  let output_pointer = write_i32(status, 4, 0)
  let output_length = write_i32(output_pointer, 8, 0)
  let diagnostic_pointer = write_i32(output_length, 12, 0)
  let diagnostic_length = write_i32(diagnostic_pointer, 16, 0)
  return byte_pointer(diagnostic_length)
}

export fn compile(source: bytes) -> i32 {
  let first = next_token(source, 0)
  if first.kind == 0 {
    let output = empty_module()
    return success_record(output)
  }

  return diagnostic_record()
}
```

The initial bootstrap contract maps an empty or whitespace-only source to the
valid, empty Wasm module `00 61 73 6d 01 00 00 00`. `next_token()` skips ASCII
whitespace and `//` comments, and distinguishes EOF, ASCII identifiers, integers, and symbols;
identifier and integer tokens have their complete source range. The temporary
`token_summary()` export is an integration-test probe. The `compile()` export
returns a pointer to the 20-byte result record described in the Matra Program
specification.
`allocate_bytes(size)` returns a `bytes` value backed by the generated module's
linear memory, and `byte_set(bytes, index, value)` writes one byte. Diagnostics
remain a placeholder until diagnostic text is implemented.
