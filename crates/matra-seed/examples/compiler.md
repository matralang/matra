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

fn is_export_keyword(source: bytes, value: token) -> i32 {
  if value.length != 6 {
    return 0
  }
  if byte_at(source, value.start) != 101 {
    return 0
  }
  if byte_at(source, value.start + 1) != 120 {
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

fn same_token(source: bytes, left: token, right: token) -> i32 {
  if left.length != right.length {
    return 0
  }
  let index = 0
  while index < left.length {
    if byte_at(source, left.start + index) != byte_at(source, right.start + index) {
      return 0
    }
    index = index + 1
  }
  return 1
}

fn parse_function(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  if is_export_keyword(source, keyword) == 1 {
    keyword = next_token(source, keyword.start + keyword.length)
  }
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
  let parameter = next_token(source, open.start + open.length)
  let close = parameter
  if is_symbol(source, parameter, 41) == 0 {
    if parameter.kind != 1 {
      return function_definition(0, 0, 0, 0, offset)
    }
    let colon = next_token(source, parameter.start + parameter.length)
    if is_symbol(source, colon, 58) == 0 {
      return function_definition(0, 0, 0, 0, offset)
    }
    let parameter_type = next_token(source, colon.start + colon.length)
    if is_i32_type(source, parameter_type) == 0 {
      return function_definition(0, 0, 0, 0, offset)
    }
    close = next_token(source, parameter_type.start + parameter_type.length)
    if is_symbol(source, close, 41) == 0 {
      return function_definition(0, 0, 0, 0, offset)
    }
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
  let returned_value = next_token(source, returned.start + returned.length)
  let return_value = 0
  let value_token = returned_value
  let negative = 0
  if is_symbol(source, returned_value, 45) == 1 {
    negative = 1
    value_token = next_token(source, returned_value.start + returned_value.length)
  }
  if value_token.kind == 2 {
    return_value = read_small_integer(source, value_token)
    if negative == 1 {
      return_value = -return_value
    }
  } else {
    if negative == 1 {
      return function_definition(0, 0, 0, 0, offset)
    }
    let call_open = next_token(source, returned_value.start + returned_value.length)
    if is_symbol(source, call_open, 40) == 1 {
      let call_close = next_token(source, call_open.start + call_open.length)
      if is_symbol(source, call_close, 41) == 0 {
        return function_definition(0, 0, 0, 0, offset)
      }
      let call_body_close = next_token(source, call_close.start + call_close.length)
      if is_symbol(source, call_body_close, 125) == 0 {
        return function_definition(0, 0, 0, 0, offset)
      }
      return function_definition(1, name.start, name.length, -2, call_body_close.start + call_body_close.length)
    }
    if is_symbol(source, parameter, 41) == 1 {
      return function_definition(0, 0, 0, 0, offset)
    }
    if same_token(source, parameter, returned_value) == 0 {
      return function_definition(0, 0, 0, 0, offset)
    }
    return_value = -1
  }
  let close_body = next_token(source, value_token.start + value_token.length)
  if is_symbol(source, close_body, 125) == 0 {
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
      let next = next_token(source, function.position)
      if next.kind == 0 {
        return 1
      }
      let second = parse_function(source, next.start)
      if second.status == 0 {
        return 0
      }
      if next_token(source, second.position).kind != 0 {
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

fn second_function(source: bytes) -> function_definition {
  let first = first_function(source)
  if first.status == 0 {
    return function_definition(0, 0, 0, 0, 0)
  }
  let second = next_token(source, first.position)
  if second.kind == 0 {
    return function_definition(0, 0, 0, 0, first.position)
  }
  return parse_function(source, second.start)
}

fn function_name_table(source: bytes) -> [i32] {
  let table: [i32] = allocate_i32_array(byte_length(source) * 2 + 1)
  array_set(table, 0, 0)
  let module_keyword = next_token(source, 0)
  if is_module_keyword(source, module_keyword) == 0 {
    array_set(table, 0, -1)
    return table
  }
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  if module_name.kind != 1 {
    array_set(table, 0, -1)
    return table
  }
  let position = module_name.start + module_name.length
  while position < byte_length(source) {
    let keyword = next_token(source, position)
    if keyword.kind == 0 {
      return table
    }
    if is_import_keyword(source, keyword) == 1 {
      let imported = next_token(source, keyword.start + keyword.length)
      if imported.kind != 1 {
        array_set(table, 0, -1)
        return table
      }
      position = imported.start + imported.length
    } else {
      let function = parse_function(source, keyword.start)
      if function.status == 0 {
        array_set(table, 0, -1)
        return table
      }
      let count = array_get(table, 0)
      array_set(table, count * 2 + 1, function.name_start)
      array_set(table, count * 2 + 2, function.name_length)
      array_set(table, 0, count + 1)
      position = function.position
    }
  }
  return table
}

// A temporary probe verifies the table layout before the emitter consumes it.
export fn function_count(source: bytes) -> i32 {
  let table = function_name_table(source)
  return array_get(table, 0)
}

fn calls_helper(source: bytes, caller: function_definition, helper: function_definition) -> i32 {
  let name = token(1, caller.name_start, caller.name_length)
  let open = next_token(source, name.start + name.length)
  let close = next_token(source, open.start + open.length)
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  let open_body = next_token(source, result_type.start + result_type.length)
  let returned = next_token(source, open_body.start + open_body.length)
  let called = next_token(source, returned.start + returned.length)
  let helper_name = token(1, helper.name_start, helper.name_length)
  return same_token(source, called, helper_name)
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

fn i32_leb_length(value: i32) -> i32 {
  let remaining = value
  let length = 0
  while 1 {
    let quotient = remaining / 128
    if remaining < 0 {
      if remaining != quotient * 128 {
        quotient = quotient - 1
      }
    }
    let byte = remaining - quotient * 128
    remaining = quotient
    length = length + 1
    if remaining == 0 {
      if byte < 64 {
        return length
      }
    }
    if remaining == -1 {
      if byte >= 64 {
        return length
      }
    }
  }
  return 0
}

fn write_i32_leb(buffer: bytes, index: i32, value: i32) -> bytes {
  let remaining = value
  let position = index
  while 1 {
    let quotient = remaining / 128
    if remaining < 0 {
      if remaining != quotient * 128 {
        quotient = quotient - 1
      }
    }
    let byte = remaining - quotient * 128
    remaining = quotient
    if remaining == 0 {
      if byte < 64 {
        byte_set(buffer, position, byte)
        return buffer
      }
    }
    if remaining == -1 {
      if byte >= 64 {
        byte_set(buffer, position, byte)
        return buffer
      }
    }
    byte_set(buffer, position, byte + 128)
    position = position + 1
  }
  return buffer
}

fn single_function_module(source: bytes, function: function_definition) -> bytes {
  let parameter_count = 0
  let value_length = 1
  if function.return_value == -1 {
    parameter_count = 1
  } else {
    value_length = i32_leb_length(function.return_value)
  }
  let output = allocate_bytes(32 + parameter_count + function.name_length + value_length)
  byte_set(output, 0, 0)
  byte_set(output, 1, 97)
  byte_set(output, 2, 115)
  byte_set(output, 3, 109)
  byte_set(output, 4, 1)
  byte_set(output, 5, 0)
  byte_set(output, 6, 0)
  byte_set(output, 7, 0)
  byte_set(output, 8, 1)
  byte_set(output, 9, 5 + parameter_count)
  byte_set(output, 10, 1)
  byte_set(output, 11, 96)
  byte_set(output, 12, parameter_count)
  if parameter_count == 1 {
    byte_set(output, 13, 127)
  }
  byte_set(output, 13 + parameter_count, 1)
  byte_set(output, 14 + parameter_count, 127)
  byte_set(output, 15 + parameter_count, 3)
  byte_set(output, 16 + parameter_count, 2)
  byte_set(output, 17 + parameter_count, 1)
  byte_set(output, 18 + parameter_count, 0)
  byte_set(output, 19 + parameter_count, 7)
  byte_set(output, 20 + parameter_count, 4 + function.name_length)
  byte_set(output, 21 + parameter_count, 1)
  byte_set(output, 22 + parameter_count, function.name_length)
  let index = 0
  while index < function.name_length {
    byte_set(output, 23 + parameter_count + index, byte_at(source, function.name_start + index))
    index = index + 1
  }
  let code_offset = 25 + parameter_count + function.name_length
  byte_set(output, 23 + parameter_count + function.name_length, 0)
  byte_set(output, 24 + parameter_count + function.name_length, 0)
  byte_set(output, code_offset, 10)
  byte_set(output, code_offset + 1, 5 + value_length)
  byte_set(output, code_offset + 2, 1)
  byte_set(output, code_offset + 3, 3 + value_length)
  byte_set(output, code_offset + 4, 0)
  if function.return_value == -1 {
    byte_set(output, code_offset + 5, 32)
    byte_set(output, code_offset + 6, 0)
  } else {
    byte_set(output, code_offset + 5, 65)
    let written = write_i32_leb(output, code_offset + 6, function.return_value)
    byte_set(written, code_offset + 6 + value_length, 11)
    return written
  }
  byte_set(output, code_offset + 7, 11)
  return output
}

fn two_function_module(source: bytes, helper: function_definition, entry: function_definition) -> bytes {
  let value_length = i32_leb_length(helper.return_value)
  let output = allocate_bytes(38 + entry.name_length + value_length)
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
  byte_set(output, 16, 3)
  byte_set(output, 17, 2)
  byte_set(output, 18, 0)
  byte_set(output, 19, 0)
  byte_set(output, 20, 7)
  byte_set(output, 21, 4 + entry.name_length)
  byte_set(output, 22, 1)
  byte_set(output, 23, entry.name_length)
  let index = 0
  while index < entry.name_length {
    byte_set(output, 24 + index, byte_at(source, entry.name_start + index))
    index = index + 1
  }
  byte_set(output, 24 + entry.name_length, 0)
  byte_set(output, 25 + entry.name_length, 1)
  let code_offset = 26 + entry.name_length
  byte_set(output, code_offset, 10)
  byte_set(output, code_offset + 1, 10 + value_length)
  byte_set(output, code_offset + 2, 2)
  byte_set(output, code_offset + 3, 3 + value_length)
  byte_set(output, code_offset + 4, 0)
  byte_set(output, code_offset + 5, 65)
  let written = write_i32_leb(output, code_offset + 6, helper.return_value)
  byte_set(written, code_offset + 6 + value_length, 11)
  byte_set(written, code_offset + 7 + value_length, 4)
  byte_set(written, code_offset + 8 + value_length, 0)
  byte_set(written, code_offset + 9 + value_length, 16)
  byte_set(written, code_offset + 10 + value_length, 0)
  byte_set(written, code_offset + 11 + value_length, 11)
  return written
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
      let second = second_function(source)
      if second.status == 1 {
        if function.return_value >= 0 {
          if second.return_value == -2 {
            if calls_helper(source, second, function) == 1 {
              output = two_function_module(source, function, second)
            } else {
              return diagnostic_record()
            }
          } else {
            return diagnostic_record()
          }
        } else {
          return diagnostic_record()
        }
      }
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
parameters and a nonnegative integer `return` expression. Such a
function is emitted with one Wasm type, function, export, and code entry.
One `i32` parameter returning itself is also supported.
The initial two-function form emits a literal-returning helper and an entry
function that calls it.
`allocate_bytes(size)` returns a `bytes` value backed by the generated module's
linear memory, and `byte_set(bytes, index, value)` writes one byte. Diagnostics
remain a placeholder until diagnostic text is implemented.
