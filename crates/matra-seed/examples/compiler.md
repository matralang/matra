# Bootstrap compiler

```compiler.matra.program
module compiler

struct token {
  kind: i32
  start: i32
  length: i32
}

struct function_definition {
  status: i32
  name_start: i32
  name_length: i32
  return_value: i32
  position: i32
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

fn is_module_keyword(source: bytes, value: token) -> i32 {
  if value.length != 6 {
    return 0
  }
  if byte_at(source, value.start) != 109 {
    return 0
  }
  if byte_at(source, value.start + 1) != 111 {
    return 0
  }
  if byte_at(source, value.start + 2) != 100 {
    return 0
  }
  if byte_at(source, value.start + 3) != 117 {
    return 0
  }
  if byte_at(source, value.start + 4) != 108 {
    return 0
  }
  if byte_at(source, value.start + 5) != 101 {
    return 0
  }
  return 1
}

fn is_import_keyword(source: bytes, value: token) -> i32 {
  if value.length != 6 {
    return 0
  }
  if byte_at(source, value.start) != 105 {
    return 0
  }
  if byte_at(source, value.start + 1) != 109 {
    return 0
  }
  if byte_at(source, value.start + 2) != 112 {
    return 0
  }
  if byte_at(source, value.start + 3) != 111 {
    return 0
  }
  if byte_at(source, value.start + 4) != 114 {
    return 0
  }
  if byte_at(source, value.start + 5) != 116 {
    return 0
  }
  return 1
}

fn is_fn_keyword(source: bytes, value: token) -> i32 {
  if value.length != 2 {
    return 0
  }
  if byte_at(source, value.start) != 102 {
    return 0
  }
  if byte_at(source, value.start + 1) != 110 {
    return 0
  }
  return 1
}

fn is_return_keyword(source: bytes, value: token) -> i32 {
  if value.length != 6 {
    return 0
  }
  if byte_at(source, value.start) != 114 {
    return 0
  }
  if byte_at(source, value.start + 1) != 101 {
    return 0
  }
  if byte_at(source, value.start + 2) != 116 {
    return 0
  }
  if byte_at(source, value.start + 3) != 117 {
    return 0
  }
  if byte_at(source, value.start + 4) != 114 {
    return 0
  }
  if byte_at(source, value.start + 5) != 110 {
    return 0
  }
  return 1
}

fn is_i32_type(source: bytes, value: token) -> i32 {
  if value.length != 3 {
    return 0
  }
  if byte_at(source, value.start) != 105 {
    return 0
  }
  if byte_at(source, value.start + 1) != 51 {
    return 0
  }
  if byte_at(source, value.start + 2) != 50 {
    return 0
  }
  return 1
}

fn is_symbol(source: bytes, value: token, expected: i32) -> i32 {
  if value.kind != 3 {
    return 0
  }
  if value.length != 1 {
    return 0
  }
  if byte_at(source, value.start) != expected {
    return 0
  }
  return 1
}

fn read_small_integer(source: bytes, value: token) -> i32 {
  let result = 0
  let position = value.start
  while position < value.start + value.length {
    result = result * 10 + byte_at(source, position) - 48
    position = position + 1
  }
  return result
}

fn parse_function(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  if is_fn_keyword(source, keyword) == 0 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let name = next_token(source, keyword.start + keyword.length)
  if name.kind != 1 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let open = next_token(source, name.start + name.length)
  if is_symbol(source, open, 40) == 0 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let close = next_token(source, open.start + open.length)
  if is_symbol(source, close, 41) == 0 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let minus = next_token(source, close.start + close.length)
  if is_symbol(source, minus, 45) == 0 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let arrow = next_token(source, minus.start + minus.length)
  if is_symbol(source, arrow, 62) == 0 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let result_type = next_token(source, arrow.start + arrow.length)
  if is_i32_type(source, result_type) == 0 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let open_body = next_token(source, result_type.start + result_type.length)
  if is_symbol(source, open_body, 123) == 0 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let returned = next_token(source, open_body.start + open_body.length)
  if is_return_keyword(source, returned) == 0 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let integer = next_token(source, returned.start + returned.length)
  if integer.kind != 2 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let close_body = next_token(source, integer.start + integer.length)
  if is_symbol(source, close_body, 125) == 0 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let return_value = read_small_integer(source, integer)
  if return_value >= 64 {
    return function_definition(0, 0, 0, 0, offset)
  }
  let name_start = name.start
  let name_length = name.length
  let next_position = close_body.start + close_body.length
  return function_definition(1, name_start, name_length, return_value, next_position)
}

fn parse_empty_program(source: bytes) -> i32 {
  let first = next_token(source, 0)
  if first.kind == 0 {
    return 1
  }
  if first.kind != 1 {
    return 0
  }
  if is_module_keyword(source, first) == 0 {
    return 0
  }
  let name = next_token(source, first.start + first.length)
  if name.kind != 1 {
    return 0
  }
  let position = name.start + name.length
  while position < byte_length(source) {
    let keyword = next_token(source, position)
    if keyword.kind == 0 {
      return 1
    }
    if keyword.kind != 1 {
      return 0
    }
    if is_import_keyword(source, keyword) == 1 {
      let imported = next_token(source, keyword.start + keyword.length)
      if imported.kind != 1 {
        return 0
      }
      position = imported.start + imported.length
    } else {
      let function = parse_function(source, keyword.start)
      if function.status == 0 {
        return 0
      }
      if next_token(source, function.position).kind != 0 {
        return 0
      }
      return 1
    }
  }
  return 1
}

fn first_function(source: bytes) -> function_definition {
  let module_keyword = next_token(source, 0)
  if module_keyword.kind != 1 {
    return function_definition(0, 0, 0, 0, 0)
  }
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  let position = module_name.start + module_name.length
  while position < byte_length(source) {
    let keyword = next_token(source, position)
    if keyword.kind == 0 {
      return function_definition(0, 0, 0, 0, position)
    }
    if is_import_keyword(source, keyword) == 1 {
      let imported = next_token(source, keyword.start + keyword.length)
      position = imported.start + imported.length
    } else {
      return parse_function(source, keyword.start)
    }
  }
  return function_definition(0, 0, 0, 0, position)
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

fn single_function_module(source: bytes, function: function_definition) -> bytes {
  let output = allocate_bytes(33 + function.name_length)
  byte_set(output, 0, 0)
  byte_set(output, 1, 97)
  byte_set(output, 2, 115)
  byte_set(output, 3, 109)
  byte_set(output, 4, 1)
  byte_set(output, 5, 0)
  byte_set(output, 6, 0)
  byte_set(output, 7, 0)
  byte_set(output, 8, 1)
  byte_set(output, 9, 5)
  byte_set(output, 10, 1)
  byte_set(output, 11, 96)
  byte_set(output, 12, 0)
  byte_set(output, 13, 1)
  byte_set(output, 14, 127)
  byte_set(output, 15, 3)
  byte_set(output, 16, 2)
  byte_set(output, 17, 1)
  byte_set(output, 18, 0)
  byte_set(output, 19, 7)
  byte_set(output, 20, 4 + function.name_length)
  byte_set(output, 21, 1)
  byte_set(output, 22, function.name_length)
  let index = 0
  while index < function.name_length {
    byte_set(output, 23 + index, byte_at(source, function.name_start + index))
    index = index + 1
  }
  byte_set(output, 23 + function.name_length, 0)
  byte_set(output, 24 + function.name_length, 0)
  byte_set(output, 25 + function.name_length, 10)
  byte_set(output, 26 + function.name_length, 6)
  byte_set(output, 27 + function.name_length, 1)
  byte_set(output, 28 + function.name_length, 4)
  byte_set(output, 29 + function.name_length, 0)
  byte_set(output, 30 + function.name_length, 65)
  byte_set(output, 31 + function.name_length, function.return_value)
  byte_set(output, 32 + function.name_length, 11)
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
  if parse_empty_program(source) == 1 {
    let function = first_function(source)
    let output = empty_module()
    if function.status == 1 {
      output = single_function_module(source, function)
    }
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
specification. `parse_empty_program()` accepts an empty source or the minimal
non-empty Program header form `module identifier { import identifier }` and maps
it to an empty Wasm module. It also recognizes an initial function form with no
parameters and a nonnegative integer `return` expression below `64`. Such a
function is emitted with one Wasm type, function, export, and code entry.
`allocate_bytes(size)` returns a `bytes` value backed by the generated module's
linear memory, and `byte_set(bytes, index, value)` writes one byte. Diagnostics
remain a placeholder until diagnostic text is implemented.
