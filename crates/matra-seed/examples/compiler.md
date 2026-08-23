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
  error_offset: i32
}

struct compile_diagnostic {
  kind: i32
  offset: i32
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
    return function_definition(0, 0, 0, 0, offset, keyword.start)
  }
  let name = next_token(source, keyword.start + keyword.length)
  if name.kind != 1 {
    return function_definition(0, 0, 0, 0, offset, name.start)
  }
  let open = next_token(source, name.start + name.length)
  if is_symbol(source, open, 40) == 0 {
    return function_definition(0, 0, 0, 0, offset, open.start)
  }
  let parameter = next_token(source, open.start + open.length)
  let close = parameter
  if is_symbol(source, parameter, 41) == 0 {
    if parameter.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, parameter.start)
    }
    let colon = next_token(source, parameter.start + parameter.length)
    if is_symbol(source, colon, 58) == 0 {
      return function_definition(0, 0, 0, 0, offset, colon.start)
    }
    let parameter_type = next_token(source, colon.start + colon.length)
    if is_i32_type(source, parameter_type) == 0 {
      return function_definition(0, 0, 0, 0, offset, parameter_type.start)
    }
    close = next_token(source, parameter_type.start + parameter_type.length)
    if is_symbol(source, close, 41) == 0 {
      return function_definition(0, 0, 0, 0, offset, close.start)
    }
  }
  let minus = next_token(source, close.start + close.length)
  if is_symbol(source, minus, 45) == 0 {
    return function_definition(0, 0, 0, 0, offset, minus.start)
  }
  let arrow = next_token(source, minus.start + minus.length)
  if is_symbol(source, arrow, 62) == 0 {
    return function_definition(0, 0, 0, 0, offset, arrow.start)
  }
  let result_type = next_token(source, arrow.start + arrow.length)
  if is_i32_type(source, result_type) == 0 {
    return function_definition(0, 0, 0, 0, offset, result_type.start)
  }
  let open_body = next_token(source, result_type.start + result_type.length)
  if is_symbol(source, open_body, 123) == 0 {
    return function_definition(0, 0, 0, 0, offset, open_body.start)
  }
  let returned = next_token(source, open_body.start + open_body.length)
  if is_return_keyword(source, returned) == 0 {
    return function_definition(0, 0, 0, 0, offset, returned.start)
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
      return function_definition(0, 0, 0, 0, offset, value_token.start)
    }
    let call_open = next_token(source, returned_value.start + returned_value.length)
    if is_symbol(source, call_open, 40) == 1 {
      let argument = next_token(source, call_open.start + call_open.length)
      let call_close = argument
      if is_symbol(source, argument, 41) == 0 {
        let argument_value = argument
        if is_symbol(source, argument, 45) == 1 {
          argument_value = next_token(source, argument.start + argument.length)
          if argument_value.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, argument_value.start)
          }
        } else {
          if argument.kind == 1 {
            if is_symbol(source, parameter, 41) == 1 {
              return function_definition(0, 0, 0, 0, offset, argument.start)
            }
            if same_token(source, parameter, argument) == 0 {
              return function_definition(0, 0, 0, 0, offset, argument.start)
            }
          } else {
            if argument.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, argument.start)
            }
          }
        }
        call_close = next_token(source, argument_value.start + argument_value.length)
      }
      if is_symbol(source, call_close, 41) == 0 {
        return function_definition(0, 0, 0, 0, offset, call_close.start)
      }
      let call_body_close = next_token(source, call_close.start + call_close.length)
      if is_symbol(source, call_body_close, 125) == 0 {
        return function_definition(0, 0, 0, 0, offset, call_body_close.start)
      }
      return function_definition(1, name.start, name.length, -2, call_body_close.start + call_body_close.length, 0)
    }
    if is_symbol(source, parameter, 41) == 1 {
      return function_definition(0, 0, 0, 0, offset, returned_value.start)
    }
    if same_token(source, parameter, returned_value) == 0 {
      return function_definition(0, 0, 0, 0, offset, returned_value.start)
    }
    return_value = -1
  }
  let close_body = next_token(source, value_token.start + value_token.length)
  if is_symbol(source, close_body, 125) == 0 {
    return function_definition(0, 0, 0, 0, offset, close_body.start)
  }
  let name_start = name.start
  let name_length = name.length
  let next_position = close_body.start + close_body.length
  return function_definition(1, name_start, name_length, return_value, next_position, 0)
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
      position = function.position
    }
  }
  return 1
}

fn program_error_offset(source: bytes) -> i32 {
  let first = next_token(source, 0)
  if first.kind != 1 {
    return first.start
  }
  if is_module_keyword(source, first) == 0 {
    return first.start
  }
  let name = next_token(source, first.start + first.length)
  if name.kind != 1 {
    return name.start
  }
  let position = name.start + name.length
  while position < byte_length(source) {
    let keyword = next_token(source, position)
    if keyword.kind == 0 {
      return keyword.start
    }
    if keyword.kind != 1 {
      return keyword.start
    }
    if is_import_keyword(source, keyword) == 1 {
      let imported = next_token(source, keyword.start + keyword.length)
      if imported.kind != 1 {
        return imported.start
      }
      position = imported.start + imported.length
    } else {
      let function = parse_function(source, keyword.start)
      if function.status == 0 {
        return function.error_offset
      }
      position = function.position
    }
  }
  return byte_length(source)
}

fn first_function(source: bytes) -> function_definition {
  let module_keyword = next_token(source, 0)
  if module_keyword.kind != 1 {
    return function_definition(0, 0, 0, 0, 0, module_keyword.start)
  }
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  let position = module_name.start + module_name.length
  while position < byte_length(source) {
    let keyword = next_token(source, position)
    if keyword.kind == 0 {
      return function_definition(0, 0, 0, 0, position, keyword.start)
    }
    if is_import_keyword(source, keyword) == 1 {
      let imported = next_token(source, keyword.start + keyword.length)
      position = imported.start + imported.length
    } else {
      return parse_function(source, keyword.start)
    }
  }
  return function_definition(0, 0, 0, 0, position, position)
}

fn function_parameter_count_of(source: bytes, function: function_definition) -> i32 {
  let name = token(1, function.name_start, function.name_length)
  let open = next_token(source, name.start + name.length)
  let parameter = next_token(source, open.start + open.length)
  if is_symbol(source, parameter, 41) == 1 {
    return 0
  }
  return 1
}

fn returned_value_token(source: bytes, function: function_definition) -> token {
  let name = token(1, function.name_start, function.name_length)
  let open = next_token(source, name.start + name.length)
  let parameter = next_token(source, open.start + open.length)
  let close = parameter
  if is_symbol(source, parameter, 41) == 0 {
    let colon = next_token(source, parameter.start + parameter.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    close = next_token(source, parameter_type.start + parameter_type.length)
  }
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  let open_body = next_token(source, result_type.start + result_type.length)
  let returned = next_token(source, open_body.start + open_body.length)
  return next_token(source, returned.start + returned.length)
}

fn function_body_kind_of(source: bytes, function: function_definition) -> i32 {
  let value = returned_value_token(source, function)
  if is_symbol(source, value, 45) == 1 {
    return 0
  }
  if value.kind == 2 {
    return 0
  }
  let call_open = next_token(source, value.start + value.length)
  if is_symbol(source, call_open, 40) == 1 {
    return 2
  }
  return 1
}

fn call_argument_token(source: bytes, function: function_definition) -> token {
  let called = returned_value_token(source, function)
  let call_open = next_token(source, called.start + called.length)
  return next_token(source, call_open.start + call_open.length)
}

fn call_argument_kind_of(source: bytes, function: function_definition) -> i32 {
  let argument = call_argument_token(source, function)
  if is_symbol(source, argument, 41) == 1 {
    return 0
  }
  if is_symbol(source, argument, 45) == 1 {
    return 1
  }
  if argument.kind == 2 {
    return 1
  }
  return 2
}

fn call_argument_value_of(source: bytes, function: function_definition) -> i32 {
  let argument = call_argument_token(source, function)
  if is_symbol(source, argument, 45) == 1 {
    let value = next_token(source, argument.start + argument.length)
    return -read_small_integer(source, value)
  }
  if argument.kind == 2 {
    return read_small_integer(source, argument)
  }
  return 0
}

fn count_functions(source: bytes) -> i32 {
  let module_keyword = next_token(source, 0)
  if is_module_keyword(source, module_keyword) == 0 {
    return -1
  }
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  if module_name.kind != 1 {
    return -1
  }
  let position = module_name.start + module_name.length
  let count = 0
  while position < byte_length(source) {
    let keyword = next_token(source, position)
    if keyword.kind == 0 {
      return count
    }
    if is_import_keyword(source, keyword) == 1 {
      let imported = next_token(source, keyword.start + keyword.length)
      if imported.kind != 1 {
        return -1
      }
      position = imported.start + imported.length
    } else {
      let function = parse_function(source, keyword.start)
      if function.status == 0 {
        return -1
      }
      count = count + 1
      position = function.position
    }
  }
  return count
}

fn function_table(source: bytes) -> [i32] {
  let function_total = count_functions(source)
  let capacity = 1
  if function_total > 0 {
    capacity = function_total * 7 + 1
  }
  let table: [i32] = allocate_i32_array(capacity)
  array_set(table, 0, 0)
  if function_total < 0 {
    array_set(table, 0, -1)
    return table
  }
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
      let parameter_count = function_parameter_count_of(source, function)
      let body_kind = function_body_kind_of(source, function)
      let body_value = function.return_value
      if body_kind == 1 {
        body_value = 0
      }
      if body_kind == 2 {
        body_value = -1
      }
      array_set(table, count * 7 + 1, function.name_start)
      array_set(table, count * 7 + 2, function.name_length)
      array_set(table, count * 7 + 3, parameter_count)
      array_set(table, count * 7 + 4, body_kind)
      array_set(table, count * 7 + 5, body_value)
      array_set(table, count * 7 + 6, 0)
      array_set(table, count * 7 + 7, 0)
      array_set(table, 0, count + 1)
      position = function.position
    }
  }
  let current_function = first_function(source)
  let index = 0
  while index < array_get(table, 0) {
    if array_get(table, index * 7 + 4) == 2 {
      array_set(table, index * 7 + 5, called_function_index(source, table, current_function))
      array_set(table, index * 7 + 6, call_argument_kind_of(source, current_function))
      array_set(table, index * 7 + 7, call_argument_value_of(source, current_function))
    }
    index = index + 1
    if index < array_get(table, 0) {
      let next = next_token(source, current_function.position)
      current_function = parse_function(source, next.start)
    }
  }
  return table
}

// A temporary probe keeps the function table observable from the integration test.
export fn function_count(source: bytes) -> i32 {
  let table = function_table(source)
  return array_get(table, 0)
}

fn function_index_in_table(source: bytes, table: [i32], name: token) -> i32 {
  let index = 0
  let count = array_get(table, 0)
  while index < count {
    let name_start = array_get(table, index * 7 + 1)
    let name_length = array_get(table, index * 7 + 2)
    let candidate = token(1, name_start, name_length)
    if same_token(source, candidate, name) == 1 {
      return index
    }
    index = index + 1
  }
  return -1
}

// A temporary probe keeps name-to-index resolution observable from the integration test.
export fn function_index(source: bytes, offset: i32) -> i32 {
  let table = function_table(source)
  let name = next_token(source, offset)
  return function_index_in_table(source, table, name)
}

export fn function_parameter_count(source: bytes, index: i32) -> i32 {
  let table = function_table(source)
  return array_get(table, index * 7 + 3)
}

export fn function_body_kind(source: bytes, index: i32) -> i32 {
  let table = function_table(source)
  return array_get(table, index * 7 + 4)
}

export fn function_body_value(source: bytes, index: i32) -> i32 {
  let table = function_table(source)
  return array_get(table, index * 7 + 5)
}

fn called_function_index(source: bytes, table: [i32], caller: function_definition) -> i32 {
  let called = returned_value_token(source, caller)
  return function_index_in_table(source, table, called)
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

fn u32_leb_length(value: i32) -> i32 {
  let remaining = value
  let length = 1
  while remaining >= 128 {
    remaining = remaining / 128
    length = length + 1
  }
  return length
}

fn write_u32_leb(buffer: bytes, index: i32, value: i32) -> bytes {
  let remaining = value
  let position = index
  while 1 {
    let quotient = remaining / 128
    let byte = remaining - quotient * 128
    remaining = quotient
    if remaining == 0 {
      byte_set(buffer, position, byte)
      return buffer
    }
    byte_set(buffer, position, byte + 128)
    position = position + 1
  }
  return buffer
}

fn single_function_module(source: bytes, table: [i32]) -> bytes {
  let name_start = array_get(table, 1)
  let name_length = array_get(table, 2)
  let parameter_count = array_get(table, 3)
  let body_kind = array_get(table, 4)
  let body_value = array_get(table, 5)
  let type_payload_length = 5 + parameter_count
  let function_payload_length = 2
  let export_payload_length = 1 + u32_leb_length(name_length) + name_length + 1 + 1
  let body_length = 3 + i32_leb_length(body_value)
  if body_kind == 1 {
    body_length = 3 + u32_leb_length(body_value)
  }
  let code_payload_length = 1 + u32_leb_length(body_length) + body_length
  let output_length = 8 + 1 + u32_leb_length(type_payload_length) + type_payload_length + 1 + u32_leb_length(function_payload_length) + function_payload_length + 1 + u32_leb_length(export_payload_length) + export_payload_length + 1 + u32_leb_length(code_payload_length) + code_payload_length
  let output = allocate_bytes(output_length)
  byte_set(output, 0, 0)
  byte_set(output, 1, 97)
  byte_set(output, 2, 115)
  byte_set(output, 3, 109)
  byte_set(output, 4, 1)
  byte_set(output, 5, 0)
  byte_set(output, 6, 0)
  byte_set(output, 7, 0)
  let position = 8
  byte_set(output, position, 1)
  position = position + 1
  let type_length_written = write_u32_leb(output, position, type_payload_length)
  position = position + u32_leb_length(type_payload_length)
  let type_count_written = write_u32_leb(type_length_written, position, 1)
  position = position + 1
  byte_set(type_count_written, position, 96)
  position = position + 1
  let parameter_count_written = write_u32_leb(output, position, parameter_count)
  position = position + u32_leb_length(parameter_count)
  if parameter_count == 1 {
    byte_set(parameter_count_written, position, 127)
    position = position + 1
  }
  byte_set(output, position, 1)
  byte_set(output, position + 1, 127)
  position = position + 2
  byte_set(output, position, 3)
  position = position + 1
  let function_length_written = write_u32_leb(output, position, function_payload_length)
  position = position + 1
  let function_count_written = write_u32_leb(function_length_written, position, 1)
  position = position + 1
  let type_index_written = write_u32_leb(function_count_written, position, 0)
  position = position + 1
  byte_set(type_index_written, position, 7)
  position = position + 1
  let export_length_written = write_u32_leb(output, position, export_payload_length)
  position = position + u32_leb_length(export_payload_length)
  let export_count_written = write_u32_leb(export_length_written, position, 1)
  position = position + 1
  let name_length_written = write_u32_leb(export_count_written, position, name_length)
  position = position + u32_leb_length(name_length)
  let index = 0
  while index < name_length {
    byte_set(name_length_written, position, byte_at(source, name_start + index))
    position = position + 1
    index = index + 1
  }
  byte_set(output, position, 0)
  position = position + 1
  let export_index_written = write_u32_leb(output, position, 0)
  position = position + 1
  byte_set(export_index_written, position, 10)
  position = position + 1
  let code_length_written = write_u32_leb(output, position, code_payload_length)
  position = position + u32_leb_length(code_payload_length)
  let code_count_written = write_u32_leb(code_length_written, position, 1)
  position = position + 1
  let body_length_written = write_u32_leb(code_count_written, position, body_length)
  position = position + u32_leb_length(body_length)
  byte_set(body_length_written, position, 0)
  position = position + 1
  if body_kind == 1 {
    byte_set(output, position, 32)
    position = position + 1
    let local_index_written = write_u32_leb(output, position, body_value)
    position = position + u32_leb_length(body_value)
    byte_set(local_index_written, position, 11)
  } else {
    byte_set(output, position, 65)
    position = position + 1
    let value_written = write_i32_leb(output, position, body_value)
    position = position + i32_leb_length(body_value)
    byte_set(value_written, position, 11)
  }
  return output
}

fn multiple_function_module(source: bytes, table: [i32]) -> bytes {
  let count = array_get(table, 0)
  let code_payload_length = u32_leb_length(count)
  let index = 0
  while index < count {
    let sized_body_kind = array_get(table, index * 7 + 4)
    let body_length = 4
    if sized_body_kind == 0 {
      body_length = 3 + i32_leb_length(array_get(table, index * 7 + 5))
    }
    if sized_body_kind == 1 {
      body_length = 3 + u32_leb_length(array_get(table, index * 7 + 5))
    }
    if sized_body_kind == 2 {
      let sized_argument_kind = array_get(table, index * 7 + 6)
      let sized_target_length = u32_leb_length(array_get(table, index * 7 + 5))
      body_length = 3 + sized_target_length
      if sized_argument_kind == 1 {
        body_length = 4 + i32_leb_length(array_get(table, index * 7 + 7)) + sized_target_length
      }
      if sized_argument_kind == 2 {
        body_length = 4 + u32_leb_length(array_get(table, index * 7 + 7)) + sized_target_length
      }
    }
    code_payload_length = code_payload_length + u32_leb_length(body_length) + body_length
    index = index + 1
  }
  let last_name_start = array_get(table, (count - 1) * 7 + 1)
  let last_name_length = array_get(table, (count - 1) * 7 + 2)
  let type_payload_length = 10
  let function_payload_length = u32_leb_length(count) + count
  let export_payload_length = u32_leb_length(1) + u32_leb_length(last_name_length) + last_name_length + 1 + u32_leb_length(count - 1)
  let output_length = 8 + 1 + u32_leb_length(type_payload_length) + type_payload_length + 1 + u32_leb_length(function_payload_length) + function_payload_length + 1 + u32_leb_length(export_payload_length) + export_payload_length + 1 + u32_leb_length(code_payload_length) + code_payload_length
  let output = allocate_bytes(output_length)
  byte_set(output, 0, 0)
  byte_set(output, 1, 97)
  byte_set(output, 2, 115)
  byte_set(output, 3, 109)
  byte_set(output, 4, 1)
  byte_set(output, 5, 0)
  byte_set(output, 6, 0)
  byte_set(output, 7, 0)
  let position = 8
  byte_set(output, position, 1)
  position = position + 1
  let type_length_written = write_u32_leb(output, position, type_payload_length)
  position = position + u32_leb_length(type_payload_length)
  let type_count_written = write_u32_leb(type_length_written, position, 2)
  position = position + 1
  byte_set(type_count_written, position, 96)
  byte_set(type_count_written, position + 1, 0)
  byte_set(type_count_written, position + 2, 1)
  byte_set(type_count_written, position + 3, 127)
  byte_set(type_count_written, position + 4, 96)
  byte_set(type_count_written, position + 5, 1)
  byte_set(type_count_written, position + 6, 127)
  byte_set(type_count_written, position + 7, 1)
  byte_set(type_count_written, position + 8, 127)
  position = position + 9
  byte_set(output, position, 3)
  position = position + 1
  let function_length_written = write_u32_leb(output, position, function_payload_length)
  position = position + u32_leb_length(function_payload_length)
  let function_count_written = write_u32_leb(function_length_written, position, count)
  position = position + u32_leb_length(count)
  index = 0
  while index < count {
    let type_index = array_get(table, index * 7 + 3)
    let type_index_written = write_u32_leb(function_count_written, position, type_index)
    position = position + u32_leb_length(type_index)
    index = index + 1
  }
  byte_set(output, position, 7)
  position = position + 1
  let export_length_written = write_u32_leb(output, position, export_payload_length)
  position = position + u32_leb_length(export_payload_length)
  let export_count_written = write_u32_leb(export_length_written, position, 1)
  position = position + 1
  let name_length_written = write_u32_leb(export_count_written, position, last_name_length)
  position = position + u32_leb_length(last_name_length)
  index = 0
  while index < last_name_length {
    byte_set(name_length_written, position, byte_at(source, last_name_start + index))
    position = position + 1
    index = index + 1
  }
  byte_set(output, position, 0)
  position = position + 1
  let export_index_written = write_u32_leb(output, position, count - 1)
  position = position + u32_leb_length(count - 1)
  byte_set(export_index_written, position, 10)
  position = position + 1
  let code_length_written = write_u32_leb(output, position, code_payload_length)
  position = position + u32_leb_length(code_payload_length)
  let code_count_written = write_u32_leb(code_length_written, position, count)
  position = position + u32_leb_length(count)
  index = 0
  while index < count {
    let body_kind = array_get(table, index * 7 + 4)
    let body_value = array_get(table, index * 7 + 5)
    let emitted_body_length = 4
    if body_kind == 0 {
      emitted_body_length = 3 + i32_leb_length(body_value)
    }
    if body_kind == 1 {
      emitted_body_length = 3 + u32_leb_length(body_value)
    }
    if body_kind == 2 {
      let emitted_argument_kind = array_get(table, index * 7 + 6)
      let emitted_target_length = u32_leb_length(body_value)
      emitted_body_length = 3 + emitted_target_length
      if emitted_argument_kind == 1 {
        emitted_body_length = 4 + i32_leb_length(array_get(table, index * 7 + 7)) + emitted_target_length
      }
      if emitted_argument_kind == 2 {
        emitted_body_length = 4 + u32_leb_length(array_get(table, index * 7 + 7)) + emitted_target_length
      }
    }
    let body_length_written = write_u32_leb(code_count_written, position, emitted_body_length)
    position = position + u32_leb_length(emitted_body_length)
    if body_kind == 2 {
      let argument_kind = array_get(table, index * 7 + 6)
      let argument_value = array_get(table, index * 7 + 7)
      if argument_kind == 0 {
        byte_set(body_length_written, position, 0)
        byte_set(body_length_written, position + 1, 16)
        position = position + 2
        let empty_call_index_written = write_u32_leb(output, position, body_value)
        position = position + u32_leb_length(body_value)
        byte_set(empty_call_index_written, position, 11)
        position = position + 1
      }
      if argument_kind == 1 {
        let argument_length = i32_leb_length(argument_value)
        byte_set(body_length_written, position, 0)
        byte_set(body_length_written, position + 1, 65)
        position = position + 2
        let argument_written = write_i32_leb(output, position, argument_value)
        position = position + argument_length
        byte_set(argument_written, position, 16)
        position = position + 1
        let literal_call_index_written = write_u32_leb(output, position, body_value)
        position = position + u32_leb_length(body_value)
        byte_set(literal_call_index_written, position, 11)
        position = position + 1
      }
      if argument_kind == 2 {
        byte_set(body_length_written, position, 0)
        byte_set(body_length_written, position + 1, 32)
        position = position + 2
        let local_index_written = write_u32_leb(output, position, argument_value)
        position = position + u32_leb_length(argument_value)
        byte_set(local_index_written, position, 16)
        position = position + 1
        let parameter_call_index_written = write_u32_leb(output, position, body_value)
        position = position + u32_leb_length(body_value)
        byte_set(parameter_call_index_written, position, 11)
        position = position + 1
      }
    } else {
      if body_kind == 1 {
        byte_set(body_length_written, position, 0)
        byte_set(body_length_written, position + 1, 32)
        position = position + 2
        let returned_local_written = write_u32_leb(output, position, body_value)
        position = position + u32_leb_length(body_value)
        byte_set(returned_local_written, position, 11)
        position = position + 1
      } else {
        let value_length = i32_leb_length(body_value)
        byte_set(body_length_written, position, 0)
        byte_set(body_length_written, position + 1, 65)
        position = position + 2
        let written = write_i32_leb(output, position, body_value)
        position = position + value_length
        byte_set(written, position, 11)
        position = position + 1
      }
    }
    index = index + 1
  }
  return output
}

fn multiple_function_diagnostic(source: bytes, table: [i32]) -> compile_diagnostic {
  let count = array_get(table, 0)
  let current_function = first_function(source)
  let index = 0
  while index < count {
    let parameter_count = array_get(table, index * 7 + 3)
    let body_kind = array_get(table, index * 7 + 4)
    if body_kind == 1 {
      if parameter_count != 1 {
        return compile_diagnostic(3, current_function.name_start)
      }
    }
    if body_kind == 2 {
      let called_index = array_get(table, index * 7 + 5)
      let called_token = returned_value_token(source, current_function)
      let argument_token = call_argument_token(source, current_function)
      if called_index < 0 {
        return compile_diagnostic(2, called_token.start)
      }
      let argument_kind = array_get(table, index * 7 + 6)
      let argument_count = 0
      if argument_kind != 0 {
        argument_count = 1
      }
      if array_get(table, called_index * 7 + 3) != argument_count {
        return compile_diagnostic(3, argument_token.start)
      }
      if argument_kind == 2 {
        if parameter_count != 1 {
          return compile_diagnostic(3, argument_token.start)
        }
      }
    }
    index = index + 1
    if index < count {
      let next = next_token(source, current_function.position)
      current_function = parse_function(source, next.start)
    }
  }
  return compile_diagnostic(0, 0)
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

fn decimal_length(value: i32) -> i32 {
  let remaining = value
  let length = 1
  while remaining >= 10 {
    remaining = remaining / 10
    length = length + 1
  }
  return length
}

fn write_decimal(buffer: bytes, index: i32, value: i32) -> bytes {
  let remaining = value
  let position = index + decimal_length(value) - 1
  while position >= index {
    let quotient = remaining / 10
    byte_set(buffer, position, 48 + remaining - quotient * 10)
    remaining = quotient
    position = position - 1
  }
  return buffer
}

fn diagnostic_prefix_length(kind: i32) -> i32 {
  if kind == 1 {
    return 11
  }
  if kind == 2 {
    return 16
  }
  return 23
}

fn write_diagnostic_prefix(buffer: bytes, kind: i32) -> bytes {
  if kind == 1 {
    byte_set(buffer, 0, 112)
    byte_set(buffer, 1, 97)
    byte_set(buffer, 2, 114)
    byte_set(buffer, 3, 115)
    byte_set(buffer, 4, 101)
    byte_set(buffer, 5, 32)
    byte_set(buffer, 6, 101)
    byte_set(buffer, 7, 114)
    byte_set(buffer, 8, 114)
    byte_set(buffer, 9, 111)
    byte_set(buffer, 10, 114)
    return buffer
  }
  if kind == 2 {
    byte_set(buffer, 0, 117)
    byte_set(buffer, 1, 110)
    byte_set(buffer, 2, 107)
    byte_set(buffer, 3, 110)
    byte_set(buffer, 4, 111)
    byte_set(buffer, 5, 119)
    byte_set(buffer, 6, 110)
    byte_set(buffer, 7, 32)
    byte_set(buffer, 8, 102)
    byte_set(buffer, 9, 117)
    byte_set(buffer, 10, 110)
    byte_set(buffer, 11, 99)
    byte_set(buffer, 12, 116)
    byte_set(buffer, 13, 105)
    byte_set(buffer, 14, 111)
    byte_set(buffer, 15, 110)
    return buffer
  }
  byte_set(buffer, 0, 97)
  byte_set(buffer, 1, 114)
  byte_set(buffer, 2, 103)
  byte_set(buffer, 3, 117)
  byte_set(buffer, 4, 109)
  byte_set(buffer, 5, 101)
  byte_set(buffer, 6, 110)
  byte_set(buffer, 7, 116)
  byte_set(buffer, 8, 32)
  byte_set(buffer, 9, 99)
  byte_set(buffer, 10, 111)
  byte_set(buffer, 11, 117)
  byte_set(buffer, 12, 110)
  byte_set(buffer, 13, 116)
  byte_set(buffer, 14, 32)
  byte_set(buffer, 15, 109)
  byte_set(buffer, 16, 105)
  byte_set(buffer, 17, 115)
  byte_set(buffer, 18, 109)
  byte_set(buffer, 19, 97)
  byte_set(buffer, 20, 116)
  byte_set(buffer, 21, 99)
  byte_set(buffer, 22, 104)
  return buffer
}

fn diagnostic_record(kind: i32, offset: i32) -> i32 {
  let prefix_length = diagnostic_prefix_length(kind)
  let offset_length = decimal_length(offset)
  let diagnostic = allocate_bytes(prefix_length + 4 + offset_length)
  let prefix_written = write_diagnostic_prefix(diagnostic, kind)
  byte_set(prefix_written, prefix_length, 32)
  byte_set(prefix_written, prefix_length + 1, 97)
  byte_set(prefix_written, prefix_length + 2, 116)
  byte_set(prefix_written, prefix_length + 3, 32)
  let diagnostic_written = write_decimal(prefix_written, prefix_length + 4, offset)
  let record = allocate_bytes(20)
  let status = write_i32(record, 0, 1)
  let output_pointer = write_i32(status, 4, 0)
  let output_length = write_i32(output_pointer, 8, 0)
  let diagnostic_pointer = write_i32(output_length, 12, byte_pointer(diagnostic_written))
  let diagnostic_length = write_i32(diagnostic_pointer, 16, byte_length(diagnostic_written))
  return byte_pointer(diagnostic_length)
}

export fn compile(source: bytes) -> i32 {
  if parse_empty_program(source) == 1 {
    let function = first_function(source)
    let table = function_table(source)
    let output = empty_module()
    if function.status == 1 {
      output = single_function_module(source, table)
      if array_get(table, 0) > 1 {
        let diagnostic = multiple_function_diagnostic(source, table)
        if diagnostic.kind == 0 {
          output = multiple_function_module(source, table)
        } else {
          return diagnostic_record(diagnostic.kind, diagnostic.offset)
        }
      }
    }
    return success_record(output)
  }

  return diagnostic_record(1, program_error_offset(source))
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
it to an empty Wasm module. It also recognizes functions with integer literal,
parameter, and function call `return` expressions. Multiple functions use Wasm
types for zero or one `i32` parameter, the last function is exported, and call
names are resolved to their Wasm function indices. Function metadata is stored
as fixed seven-field records containing name range, parameter count, body kind,
body value, argument kind, and argument value. Section lengths, counts, type
indices, function indices, body sizes, and name lengths use unsigned LEB128.
`allocate_bytes(size)` returns a `bytes` value backed by the generated module's
linear memory, and `byte_set(bytes, index, value)` writes one byte. Failed
compilations return classified UTF-8 diagnostic bytes for parse errors, unknown
functions, and argument count mismatches, including the relevant source offset.
