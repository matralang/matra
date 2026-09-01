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
  error_expected: i32
}

struct compile_diagnostic {
  kind: i32
  offset: i32
  expected: i32
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

fn is_struct_keyword(source: bytes, value: token) -> i32 {
  if value.length != 6 {
    return 0
  }
  if byte_at(source, value.start) != 115 {
    return 0
  }
  if byte_at(source, value.start + 1) != 116 {
    return 0
  }
  if byte_at(source, value.start + 2) != 114 {
    return 0
  }
  if byte_at(source, value.start + 3) != 117 {
    return 0
  }
  if byte_at(source, value.start + 4) != 99 {
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

fn is_if_keyword(source: bytes, value: token) -> i32 {
  if value.length != 2 {
    return 0
  }
  if byte_at(source, value.start) != 105 {
    return 0
  }
  if byte_at(source, value.start + 1) != 102 {
    return 0
  }
  return 1
}

fn is_else_keyword(source: bytes, value: token) -> i32 {
  if value.length != 4 {
    return 0
  }
  if byte_at(source, value.start) != 101 {
    return 0
  }
  if byte_at(source, value.start + 1) != 108 {
    return 0
  }
  if byte_at(source, value.start + 2) != 115 {
    return 0
  }
  if byte_at(source, value.start + 3) != 101 {
    return 0
  }
  return 1
}

fn is_while_keyword(source: bytes, value: token) -> i32 {
  if value.length != 5 {
    return 0
  }
  if byte_at(source, value.start) != 119 {
    return 0
  }
  if byte_at(source, value.start + 1) != 104 {
    return 0
  }
  if byte_at(source, value.start + 2) != 105 {
    return 0
  }
  if byte_at(source, value.start + 3) != 108 {
    return 0
  }
  if byte_at(source, value.start + 4) != 101 {
    return 0
  }
  return 1
}

fn is_break_keyword(source: bytes, value: token) -> i32 {
  if value.length != 5 {
    return 0
  }
  if byte_at(source, value.start) != 98 {
    return 0
  }
  if byte_at(source, value.start + 1) != 114 {
    return 0
  }
  if byte_at(source, value.start + 2) != 101 {
    return 0
  }
  if byte_at(source, value.start + 3) != 97 {
    return 0
  }
  if byte_at(source, value.start + 4) != 107 {
    return 0
  }
  return 1
}

fn is_let_keyword(source: bytes, value: token) -> i32 {
  if value.length != 3 {
    return 0
  }
  if byte_at(source, value.start) != 108 {
    return 0
  }
  if byte_at(source, value.start + 1) != 101 {
    return 0
  }
  if byte_at(source, value.start + 2) != 116 {
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

fn is_bytes_type(source: bytes, value: token) -> i32 {
  if value.length != 5 {
    return 0
  }
  if byte_at(source, value.start) != 98 {
    return 0
  }
  if byte_at(source, value.start + 1) != 121 {
    return 0
  }
  if byte_at(source, value.start + 2) != 116 {
    return 0
  }
  if byte_at(source, value.start + 3) != 101 {
    return 0
  }
  if byte_at(source, value.start + 4) != 115 {
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

fn parse_struct(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  let name = next_token(source, keyword.start + keyword.length)
  if name.kind != 1 {
    return function_definition(0, 0, 0, 0, offset, name.start, 2)
  }
  let open = next_token(source, name.start + name.length)
  if is_symbol(source, open, 123) == 0 {
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
  }
  let field = next_token(source, open.start + open.length)
  while is_symbol(source, field, 125) == 0 {
    if field.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, field.start, 2)
    }
    let colon = next_token(source, field.start + field.length)
    if is_symbol(source, colon, 58) == 0 {
      return function_definition(0, 0, 0, 0, offset, colon.start, 6)
    }
    let field_type = next_token(source, colon.start + colon.length)
    if is_i32_type(source, field_type) == 0 {
      return function_definition(0, 0, 0, 0, offset, field_type.start, 7)
    }
    field = next_token(source, field_type.start + field_type.length)
  }
  return function_definition(1, name.start, name.length, 0, field.start + field.length, 0, 0)
}

fn struct_field_count(source: bytes, struct_name: token) -> i32 {
  let module_keyword = next_token(source, 0)
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  let position = module_name.start + module_name.length
  while position < byte_length(source) {
    let keyword = next_token(source, position)
    if is_import_keyword(source, keyword) == 1 {
      let imported = next_token(source, keyword.start + keyword.length)
      position = imported.start + imported.length
    } else {
      if is_struct_keyword(source, keyword) == 0 {
        return -1
      }
      let name = next_token(source, keyword.start + keyword.length)
      let open = next_token(source, name.start + name.length)
      let field = next_token(source, open.start + open.length)
      let count = 0
      while is_symbol(source, field, 125) == 0 {
        count = count + 1
        let colon = next_token(source, field.start + field.length)
        let field_type = next_token(source, colon.start + colon.length)
        field = next_token(source, field_type.start + field_type.length)
      }
      if same_token(source, name, struct_name) == 1 {
        return count
      }
      position = field.start + field.length
    }
  }
  return -1
}

fn parse_conditional_statement(source: bytes, offset: i32, parameter: token) -> function_definition {
    let keyword = next_token(source, offset)
    let left = next_token(source, keyword.start + keyword.length)
  if left.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, left.start, 12)
    }
    let operator = next_token(source, left.start + left.length)
    if is_symbol(source, operator, 46) == 1 {
      let left_field = next_token(source, operator.start + operator.length)
      if left_field.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, left_field.start, 2)
      }
      operator = next_token(source, left_field.start + left_field.length)
    }
    if is_symbol(source, operator, 40) == 1 {
      let call_argument = next_token(source, operator.start + operator.length)
      while is_symbol(source, call_argument, 41) == 0 {
        if call_argument.kind != 1 {
          if call_argument.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, call_argument.start, 13)
          }
        }
        let call_separator = next_token(source, call_argument.start + call_argument.length)
        if is_symbol(source, call_separator, 46) == 1 {
          let call_field = next_token(source, call_separator.start + call_separator.length)
          if call_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, call_field.start, 2)
          }
          call_separator = next_token(source, call_field.start + call_field.length)
        }
        while is_arithmetic_operator(source, call_separator) == 1 {
          let call_operand = next_token(source, call_separator.start + call_separator.length)
          if call_operand.kind != 1 {
            if call_operand.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, call_operand.start, 13)
            }
          }
          call_separator = next_token(source, call_operand.start + call_operand.length)
          if is_symbol(source, call_separator, 46) == 1 {
            let call_operand_field = next_token(source, call_separator.start + call_separator.length)
            if call_operand_field.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, call_operand_field.start, 2)
            }
            call_separator = next_token(source, call_operand_field.start + call_operand_field.length)
          }
        }
        if is_symbol(source, call_separator, 44) == 1 {
          call_argument = next_token(source, call_separator.start + call_separator.length)
        } else {
          call_argument = call_separator
        }
      }
      operator = next_token(source, call_argument.start + call_argument.length)
    }
    if operator.kind != 3 {
      return function_definition(0, 0, 0, 0, offset, operator.start, 13)
    }
    let right = next_token(source, operator.start + operator.length)
    if is_symbol(source, operator, 61) == 1 {
      if is_symbol(source, right, 61) == 1 {
        right = next_token(source, right.start + right.length)
      } else {
        if right.kind != 1 {
          if right.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, right.start, 13)
          }
        }
      }
    } else {
      if is_symbol(source, operator, 33) == 1 {
        if is_symbol(source, right, 61) == 0 {
          return function_definition(0, 0, 0, 0, offset, right.start, 13)
        }
        right = next_token(source, right.start + right.length)
      } else {
        if is_symbol(source, operator, 60) == 0 {
          if is_symbol(source, operator, 62) == 0 {
            return function_definition(0, 0, 0, 0, offset, operator.start, 13)
          }
        }
        if is_symbol(source, right, 61) == 1 {
          right = next_token(source, right.start + right.length)
        }
      }
    }
    if right.kind != 1 {
      if right.kind != 2 {
        return function_definition(0, 0, 0, 0, offset, right.start, 13)
      }
    }
    let right_end = next_token(source, right.start + right.length)
    if is_symbol(source, right_end, 46) == 1 {
      let right_field = next_token(source, right_end.start + right_end.length)
      if right_field.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, right_field.start, 2)
      }
      right_end = next_token(source, right_field.start + right_field.length)
    }
    if is_symbol(source, right_end, 40) == 1 {
      let condition_call_argument = next_token(source, right_end.start + right_end.length)
      while is_symbol(source, condition_call_argument, 41) == 0 {
        if condition_call_argument.kind != 1 {
          if condition_call_argument.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, condition_call_argument.start, 13)
          }
        }
        let condition_call_separator = next_token(source, condition_call_argument.start + condition_call_argument.length)
        if is_symbol(source, condition_call_separator, 46) == 1 {
          let condition_call_field = next_token(source, condition_call_separator.start + condition_call_separator.length)
          if condition_call_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, condition_call_field.start, 2)
          }
          condition_call_separator = next_token(source, condition_call_field.start + condition_call_field.length)
        }
        while is_arithmetic_operator(source, condition_call_separator) == 1 {
          let condition_arithmetic_operand = next_token(source, condition_call_separator.start + condition_call_separator.length)
          if condition_arithmetic_operand.kind != 1 {
            if condition_arithmetic_operand.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, condition_arithmetic_operand.start, 13)
            }
          }
          condition_call_separator = next_token(source, condition_arithmetic_operand.start + condition_arithmetic_operand.length)
          if is_symbol(source, condition_call_separator, 46) == 1 {
            let condition_arithmetic_field = next_token(source, condition_call_separator.start + condition_call_separator.length)
            if condition_arithmetic_field.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, condition_arithmetic_field.start, 2)
            }
            condition_call_separator = next_token(source, condition_arithmetic_field.start + condition_arithmetic_field.length)
          }
        }
        if is_symbol(source, condition_call_separator, 44) == 1 {
          condition_call_argument = next_token(source, condition_call_separator.start + condition_call_separator.length)
        } else {
          condition_call_argument = condition_call_separator
        }
      }
      right_end = next_token(source, condition_call_argument.start + condition_call_argument.length)
    }
    while is_arithmetic_operator(source, right_end) == 1 {
      let right_arithmetic_operand = next_token(source, right_end.start + right_end.length)
      if right_arithmetic_operand.kind != 1 {
        if right_arithmetic_operand.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, right_arithmetic_operand.start, 13)
        }
      }
      right_end = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
      if is_symbol(source, right_end, 46) == 1 {
        let right_arithmetic_field = next_token(source, right_end.start + right_end.length)
        if right_arithmetic_field.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, right_arithmetic_field.start, 2)
        }
        right_end = next_token(source, right_arithmetic_field.start + right_arithmetic_field.length)
      }
    }
    let open = right_end
    if is_symbol(source, open, 123) == 0 {
      return function_definition(0, 0, 0, 0, offset, open.start, 10)
    } else {
      let current = next_token(source, open.start + open.length)
    while is_symbol(source, current, 125) == 0 {
      if is_if_keyword(source, current) == 1 {
        let nested = parse_conditional_statement(source, current.start, parameter)
        if nested.status == 0 {
          return nested
        }
        current = next_token(source, nested.position)
      } else {
        if is_while_keyword(source, current) == 1 {
          let nested_while = parse_while_statement(source, current.start)
          if nested_while.status == 0 {
            return nested_while
          }
          current = next_token(source, nested_while.position)
        } else {
        if is_return_keyword(source, current) == 1 {
          let returned_value = next_token(source, current.start + current.length)
          if returned_value.kind != 1 {
            if returned_value.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, returned_value.start, 13)
            }
          }
          current = expression_end(source, returned_value)
        } else {
          if current.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, current.start, 2)
          }
          if is_let_keyword(source, current) == 1 {
            current = next_token(source, current.start + current.length)
          }
          let assignment_equals = next_token(source, current.start + current.length)
          if is_symbol(source, assignment_equals, 61) == 0 {
            return function_definition(0, 0, 0, 0, offset, assignment_equals.start, 13)
          }
          let assignment_operand = next_token(source, assignment_equals.start + assignment_equals.length)
          current = expression_end(source, assignment_operand)
        }
        }
      }
    }
    let after_then = next_token(source, current.start + current.length)
    if is_else_keyword(source, after_then) == 1 {
      let else_open = next_token(source, after_then.start + after_then.length)
      if is_symbol(source, else_open, 123) == 0 {
        return function_definition(0, 0, 0, 0, offset, else_open.start, 10)
      }
      let else_current = next_token(source, else_open.start + else_open.length)
      while is_symbol(source, else_current, 125) == 0 {
        if is_if_keyword(source, else_current) == 1 {
          let else_nested = parse_conditional_statement(source, else_current.start, parameter)
          if else_nested.status == 0 {
            return else_nested
          }
          else_current = next_token(source, else_nested.position)
        } else {
          if is_while_keyword(source, else_current) == 1 {
            let else_nested_while = parse_while_statement(source, else_current.start)
            if else_nested_while.status == 0 {
              return else_nested_while
            }
            else_current = next_token(source, else_nested_while.position)
          } else {
          if is_return_keyword(source, else_current) == 1 {
            let else_returned_value = next_token(source, else_current.start + else_current.length)
            if is_symbol(source, else_returned_value, 45) == 1 {
              let else_negative_value = next_token(source, else_returned_value.start + else_returned_value.length)
              if else_negative_value.kind != 2 {
                return function_definition(0, 0, 0, 0, offset, else_negative_value.start, 13)
              }
              else_current = next_token(source, else_negative_value.start + else_negative_value.length)
            } else {
              if else_returned_value.kind != 1 {
                if else_returned_value.kind != 2 {
                  return function_definition(0, 0, 0, 0, offset, else_returned_value.start, 13)
                }
              }
              else_current = expression_end(source, else_returned_value)
            }
          } else {
            if else_current.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, else_current.start, 2)
            }
            if is_let_keyword(source, else_current) == 1 {
              else_current = next_token(source, else_current.start + else_current.length)
            }
            let else_assignment_equals = next_token(source, else_current.start + else_current.length)
            if is_symbol(source, else_assignment_equals, 61) == 0 {
              return function_definition(0, 0, 0, 0, offset, else_assignment_equals.start, 13)
            }
            let else_assignment_operand = next_token(source, else_assignment_equals.start + else_assignment_equals.length)
            else_current = expression_end(source, else_assignment_operand)
          }
          }
        }
      }
      return function_definition(1, 0, 0, 0, else_current.start + else_current.length, 0, 0)
    }
      return function_definition(1, 0, 0, 0, current.start + current.length, 0, 0)
    }
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
}

fn parse_conditional_body(source: bytes, offset: i32, name: token, parameter: token) -> function_definition {
  let current = next_token(source, offset)
  while is_if_keyword(source, current) == 1 {
    let conditional_left = next_token(source, current.start + current.length)
    let conditional_operator = next_token(source, conditional_left.start + conditional_left.length)
    let statement = function_definition(0, 0, 0, 0, current.start, 0, 0)
    if is_symbol(source, conditional_operator, 40) == 1 {
      statement = parse_local_return_conditional(source, current.start)
    } else {
      if is_symbol(source, conditional_operator, 46) == 1 {
        statement = parse_local_return_conditional(source, current.start)
      } else {
        statement = parse_conditional_statement(source, current.start, parameter)
      }
    }
    if statement.status == 0 {
      return statement
    }
    current = next_token(source, statement.position)
  }
  if is_return_keyword(source, current) == 0 {
    return function_definition(0, 0, 0, 0, offset, current.start, 11)
  }
  let final_value = next_token(source, current.start + current.length)
  let final_return_value = 0
  if final_value.kind == 2 {
    final_return_value = read_small_integer(source, final_value)
  } else {
    if final_value.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, final_value.start, 13)
    }
    final_return_value = -1
  }
  let close_body = next_token(source, final_value.start + final_value.length)
  if is_symbol(source, close_body, 125) == 0 {
    return function_definition(0, 0, 0, 0, offset, close_body.start, 15)
  }
  return function_definition(1, name.start, name.length, final_return_value, close_body.start + close_body.length, 0, 0)
}

fn is_arithmetic_operator(source: bytes, value: token) -> i32 {
  if is_symbol(source, value, 43) == 1 {
    return 1
  }
  if is_symbol(source, value, 45) == 1 {
    return 1
  }
  if is_symbol(source, value, 42) == 1 {
    return 1
  }
  return is_symbol(source, value, 47)
}

fn expression_end(source: bytes, operand: token) -> token {
  let current = next_token(source, operand.start + operand.length)
  if is_symbol(source, current, 46) == 1 {
    let field = next_token(source, current.start + current.length)
    current = next_token(source, field.start + field.length)
  }
  if is_symbol(source, current, 40) == 1 {
    current = next_token(source, current.start + current.length)
    while is_symbol(source, current, 41) == 0 {
      let call_separator = next_token(source, current.start + current.length)
      if is_symbol(source, call_separator, 46) == 1 {
        let call_field = next_token(source, call_separator.start + call_separator.length)
        call_separator = next_token(source, call_field.start + call_field.length)
      }
      while is_arithmetic_operator(source, call_separator) == 1 {
        let call_operand = next_token(source, call_separator.start + call_separator.length)
        call_separator = next_token(source, call_operand.start + call_operand.length)
        if is_symbol(source, call_separator, 46) == 1 {
          let call_operand_field = next_token(source, call_separator.start + call_separator.length)
          call_separator = next_token(source, call_operand_field.start + call_operand_field.length)
        }
      }
      if is_symbol(source, call_separator, 44) == 1 {
        current = next_token(source, call_separator.start + call_separator.length)
      } else {
        current = call_separator
      }
    }
    return next_token(source, current.start + current.length)
  }
  while is_arithmetic_operator(source, current) == 1 {
    let next_operand = next_token(source, current.start + current.length)
    current = next_token(source, next_operand.start + next_operand.length)
    if is_symbol(source, current, 46) == 1 {
      let next_field = next_token(source, current.start + current.length)
      current = next_token(source, next_field.start + next_field.length)
    }
    if is_symbol(source, current, 40) == 1 {
      let next_argument = next_token(source, current.start + current.length)
      while is_symbol(source, next_argument, 41) == 0 {
        let next_separator = next_token(source, next_argument.start + next_argument.length)
        if is_symbol(source, next_separator, 44) == 1 {
          next_argument = next_token(source, next_separator.start + next_separator.length)
        } else {
          next_argument = next_separator
        }
      }
      current = next_token(source, next_argument.start + next_argument.length)
    }
  }
  return current
}

fn parse_loop_conditional_break(source: bytes, statement: token) -> function_definition {
  let next = next_token(source, statement.start + statement.length)
  return function_definition(1, 0, 0, 0, next.start, 0, 0)
}

fn parse_loop_conditional_if(source: bytes, statement: token) -> function_definition {
  let nested_left = next_token(source, statement.start + statement.length)
  let nested_open = next_token(source, nested_left.start + nested_left.length)
  let nested = function_definition(0, 0, 0, 0, statement.start, 0, 0)
  if is_symbol(source, nested_open, 40) == 1 {
    nested = parse_loop_conditional(source, statement.start)
  } else {
    nested = parse_loop_local_conditional(source, statement.start)
  }
  return nested
}

fn parse_loop_conditional_while(source: bytes, statement: token) -> function_definition {
  let while_result = parse_while_statement(source, statement.start)
  return while_result
}

fn parse_loop_conditional(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  let called = next_token(source, keyword.start + keyword.length)
  let call_open = next_token(source, called.start + called.length)
  if is_symbol(source, call_open, 40) == 0 {
    return function_definition(0, 0, 0, 0, offset, call_open.start, 4)
  }
  let argument = next_token(source, call_open.start + call_open.length)
  while is_symbol(source, argument, 41) == 0 {
    if argument.kind != 1 {
      if argument.kind != 2 {
        return function_definition(0, 0, 0, 0, offset, argument.start, 13)
      }
    }
    let separator = next_token(source, argument.start + argument.length)
    if is_symbol(source, separator, 46) == 1 {
      let argument_field = next_token(source, separator.start + separator.length)
      if argument_field.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, argument_field.start, 2)
      }
      separator = next_token(source, argument_field.start + argument_field.length)
    } else {
      if is_symbol(source, separator, 40) == 1 {
        let nested_argument_operand = next_token(source, separator.start + separator.length)
        while is_symbol(source, nested_argument_operand, 41) == 0 {
          if nested_argument_operand.kind != 1 {
            if nested_argument_operand.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, nested_argument_operand.start, 13)
            }
          }
          let nested_argument_separator = next_token(source, nested_argument_operand.start + nested_argument_operand.length)
          if is_symbol(source, nested_argument_separator, 44) == 1 {
            nested_argument_operand = next_token(source, nested_argument_separator.start + nested_argument_separator.length)
          } else {
            nested_argument_operand = nested_argument_separator
          }
        }
        separator = next_token(source, nested_argument_operand.start + nested_argument_operand.length)
      }
    }
    while is_arithmetic_operator(source, separator) == 1 {
      let next_argument_operand = next_token(source, separator.start + separator.length)
      if next_argument_operand.kind != 1 {
        if next_argument_operand.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, next_argument_operand.start, 13)
        }
      }
      separator = next_token(source, next_argument_operand.start + next_argument_operand.length)
    }
    if is_symbol(source, separator, 44) == 1 {
      argument = next_token(source, separator.start + separator.length)
    } else {
      argument = separator
    }
  }
  let operator = next_token(source, argument.start + argument.length)
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  if right.kind != 1 {
    if right.kind != 2 {
      return function_definition(0, 0, 0, 0, offset, right.start, 13)
    }
  }
  let open = next_token(source, right.start + right.length)
  if is_symbol(source, open, 40) == 1 {
    let right_argument = next_token(source, open.start + open.length)
    while is_symbol(source, right_argument, 41) == 0 {
      if right_argument.kind != 1 {
        if right_argument.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, right_argument.start, 13)
        }
      }
      let right_separator = next_token(source, right_argument.start + right_argument.length)
      if is_symbol(source, right_separator, 46) == 1 {
        let right_argument_field = next_token(source, right_separator.start + right_separator.length)
        if right_argument_field.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, right_argument_field.start, 2)
        }
        right_separator = next_token(source, right_argument_field.start + right_argument_field.length)
      }
      while is_arithmetic_operator(source, right_separator) == 1 {
        let right_arithmetic_operand = next_token(source, right_separator.start + right_separator.length)
        if right_arithmetic_operand.kind != 1 {
          if right_arithmetic_operand.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, right_arithmetic_operand.start, 13)
          }
        }
        right_separator = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
      }
      if is_symbol(source, right_separator, 44) == 1 {
        right_argument = next_token(source, right_separator.start + right_separator.length)
      } else {
        right_argument = right_separator
      }
    }
    open = next_token(source, right_argument.start + right_argument.length)
  }
  if is_symbol(source, open, 123) == 0 {
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
  } else {
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 125) == 0 {
    if is_break_keyword(source, current) == 1 {
      let break_result = parse_loop_conditional_break(source, current)
      current = next_token(source, break_result.position)
    } else {
      if is_if_keyword(source, current) == 1 {
        let nested_result = parse_loop_conditional_if(source, current)
        if nested_result.status == 0 {
          return nested_result
        }
        current = next_token(source, nested_result.position)
      } else {
        if is_while_keyword(source, current) == 1 {
          let nested_while = parse_loop_conditional_while(source, current)
          if nested_while.status == 0 {
            return nested_while
          }
          current = next_token(source, nested_while.position)
        } else {
          if is_return_keyword(source, current) == 1 {
            let return_value = next_token(source, current.start + current.length)
            if is_symbol(source, return_value, 45) == 1 {
              let negative_return_value = next_token(source, return_value.start + return_value.length)
              if negative_return_value.kind != 2 {
                return function_definition(0, 0, 0, 0, offset, negative_return_value.start, 13)
              }
              current = next_token(source, negative_return_value.start + negative_return_value.length)
            } else {
            if return_value.kind != 1 {
              if return_value.kind != 2 {
                return function_definition(0, 0, 0, 0, offset, return_value.start, 13)
              }
            }
            current = expression_end(source, return_value)
            }
          } else {
            if current.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, current.start, 2)
            }
            if is_let_keyword(source, current) == 1 {
              current = next_token(source, current.start + current.length)
            }
            let equals = next_token(source, current.start + current.length)
            if is_symbol(source, equals, 61) == 0 {
              return function_definition(0, 0, 0, 0, offset, equals.start, 13)
            }
            let operand = next_token(source, equals.start + equals.length)
            current = expression_end(source, operand)
          }
        }
      }
    }
  }
  let after_then = next_token(source, current.start + current.length)
  if is_else_keyword(source, after_then) == 1 {
    let else_open = next_token(source, after_then.start + after_then.length)
    if is_symbol(source, else_open, 123) == 0 {
      return function_definition(0, 0, 0, 0, offset, else_open.start, 10)
    }
    let else_statement = next_token(source, else_open.start + else_open.length)
    while is_symbol(source, else_statement, 125) == 0 {
      if is_break_keyword(source, else_statement) == 1 {
        let else_break = parse_loop_conditional_break(source, else_statement)
        if else_break.status == 0 {
          return else_break
        }
        else_statement = next_token(source, else_break.position)
      } else {
        if is_if_keyword(source, else_statement) == 1 {
          let else_nested = parse_loop_conditional_if(source, else_statement)
          if else_nested.status == 0 {
            return else_nested
          }
          else_statement = next_token(source, else_nested.position)
        } else {
          if is_while_keyword(source, else_statement) == 1 {
            let else_nested_while = parse_loop_conditional_while(source, else_statement)
            if else_nested_while.status == 0 {
              return else_nested_while
            }
            else_statement = next_token(source, else_nested_while.position)
          } else {
            if is_return_keyword(source, else_statement) == 1 {
              let else_return_value = next_token(source, else_statement.start + else_statement.length)
              if is_symbol(source, else_return_value, 45) == 1 {
                let negative_else_return_value = next_token(source, else_return_value.start + else_return_value.length)
                if negative_else_return_value.kind != 2 {
                  return function_definition(0, 0, 0, 0, offset, negative_else_return_value.start, 13)
                }
                else_statement = next_token(source, negative_else_return_value.start + negative_else_return_value.length)
              } else {
              if else_return_value.kind != 1 {
                if else_return_value.kind != 2 {
                  return function_definition(0, 0, 0, 0, offset, else_return_value.start, 13)
                }
              }
              else_statement = expression_end(source, else_return_value)
              }
            } else {
            if else_statement.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, else_statement.start, 2)
            }
              if is_let_keyword(source, else_statement) == 1 {
                else_statement = next_token(source, else_statement.start + else_statement.length)
              }
            let else_equals = next_token(source, else_statement.start + else_statement.length)
            if is_symbol(source, else_equals, 61) == 0 {
              return function_definition(0, 0, 0, 0, offset, else_equals.start, 13)
            }
            let else_operand = next_token(source, else_equals.start + else_equals.length)
            else_statement = expression_end(source, else_operand)
            }
          }
        }
      }
    }
    return function_definition(1, 0, 0, 0, else_statement.start + else_statement.length, 0, 0)
  } else {
    return function_definition(1, 0, 0, 0, current.start + current.length, 0, 0)
  }
  }
  return function_definition(0, 0, 0, 0, offset, open.start, 10)
}

fn parse_loop_local_conditional(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  let left = next_token(source, keyword.start + keyword.length)
  let left_operator = next_token(source, left.start + left.length)
  let operator = left_operator
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, left_operator, 46) == 1 {
    let left_field = next_token(source, left_operator.start + left_operator.length)
    if left_field.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, left_field.start, 2)
    }
    operator = next_token(source, left_field.start + left_field.length)
    right = next_token(source, operator.start + operator.length)
  }
  if is_arithmetic_operator(source, left_operator) == 1 {
    operator = next_token(source, right.start + right.length)
    right = next_token(source, operator.start + operator.length)
  }
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  if right.kind != 1 {
    if right.kind != 2 {
      return function_definition(0, 0, 0, 0, offset, right.start, 13)
    }
  }
  let open = next_token(source, right.start + right.length)
  if is_symbol(source, open, 123) == 0 {
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
  } else {
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 125) == 0 {
    if is_break_keyword(source, current) == 1 {
      let break_result = parse_loop_conditional_break(source, current)
      current = next_token(source, break_result.position)
    } else {
      if is_if_keyword(source, current) == 1 {
        let nested = parse_loop_conditional_if(source, current)
        if nested.status == 0 {
          return nested
        }
        current = next_token(source, nested.position)
      } else {
        if is_while_keyword(source, current) == 1 {
          let nested_while = parse_loop_conditional_while(source, current)
          if nested_while.status == 0 {
            return nested_while
          }
          current = next_token(source, nested_while.position)
        } else {
          if is_return_keyword(source, current) == 1 {
            let return_value = next_token(source, current.start + current.length)
            if is_symbol(source, return_value, 45) == 1 {
              let negative_return_value = next_token(source, return_value.start + return_value.length)
              if negative_return_value.kind != 2 {
                return function_definition(0, 0, 0, 0, offset, negative_return_value.start, 13)
              }
              current = next_token(source, negative_return_value.start + negative_return_value.length)
            } else {
            if return_value.kind != 1 {
              if return_value.kind != 2 {
                return function_definition(0, 0, 0, 0, offset, return_value.start, 13)
              }
            }
            current = expression_end(source, return_value)
            }
          } else {
            if current.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, current.start, 2)
            }
            if is_let_keyword(source, current) == 1 {
              current = next_token(source, current.start + current.length)
            }
            let equals = next_token(source, current.start + current.length)
            if is_symbol(source, equals, 61) == 0 {
              return function_definition(0, 0, 0, 0, offset, equals.start, 13)
            }
            let operand = next_token(source, equals.start + equals.length)
            current = expression_end(source, operand)
          }
        }
      }
    }
  }
  let after_then = next_token(source, current.start + current.length)
  if is_else_keyword(source, after_then) == 1 {
    let else_open = next_token(source, after_then.start + after_then.length)
    if is_symbol(source, else_open, 123) == 0 {
      return function_definition(0, 0, 0, 0, offset, else_open.start, 10)
    }
    let else_statement = next_token(source, else_open.start + else_open.length)
    while is_symbol(source, else_statement, 125) == 0 {
      if is_break_keyword(source, else_statement) == 1 {
        else_statement = next_token(source, else_statement.start + else_statement.length)
      } else {
        if is_if_keyword(source, else_statement) == 1 {
          let else_nested_left = next_token(source, else_statement.start + else_statement.length)
          let else_nested_open = next_token(source, else_nested_left.start + else_nested_left.length)
          let else_nested = function_definition(0, 0, 0, 0, else_statement.start, 0, 0)
          if is_symbol(source, else_nested_open, 40) == 1 {
            else_nested = parse_loop_conditional(source, else_statement.start)
          } else {
            else_nested = parse_loop_local_conditional(source, else_statement.start)
          }
          if else_nested.status == 0 {
            return else_nested
          }
          else_statement = next_token(source, else_nested.position)
        } else {
          if is_while_keyword(source, else_statement) == 1 {
            let else_nested_while = parse_while_statement(source, else_statement.start)
            if else_nested_while.status == 0 {
              return else_nested_while
            }
            else_statement = next_token(source, else_nested_while.position)
          } else {
            if is_return_keyword(source, else_statement) == 1 {
              let else_return_value = next_token(source, else_statement.start + else_statement.length)
              if is_symbol(source, else_return_value, 45) == 1 {
                let negative_else_return_value = next_token(source, else_return_value.start + else_return_value.length)
                if negative_else_return_value.kind != 2 {
                  return function_definition(0, 0, 0, 0, offset, negative_else_return_value.start, 13)
                }
                else_statement = next_token(source, negative_else_return_value.start + negative_else_return_value.length)
              } else {
              if else_return_value.kind != 1 {
                if else_return_value.kind != 2 {
                  return function_definition(0, 0, 0, 0, offset, else_return_value.start, 13)
                }
              }
              else_statement = expression_end(source, else_return_value)
              }
            } else {
            if else_statement.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, else_statement.start, 2)
            }
              if is_let_keyword(source, else_statement) == 1 {
                else_statement = next_token(source, else_statement.start + else_statement.length)
              }
            let else_equals = next_token(source, else_statement.start + else_statement.length)
            if is_symbol(source, else_equals, 61) == 0 {
              return function_definition(0, 0, 0, 0, offset, else_equals.start, 13)
            }
            let else_operand = next_token(source, else_equals.start + else_equals.length)
            else_statement = expression_end(source, else_operand)
            }
          }
        }
      }
    }
    return function_definition(1, 0, 0, 0, else_statement.start + else_statement.length, 0, 0)
  } else {
    return function_definition(1, 0, 0, 0, current.start + current.length, 0, 0)
  }
  }
  return function_definition(0, 0, 0, 0, offset, open.start, 10)
}

fn parse_while_statement(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  let left = next_token(source, keyword.start + keyword.length)
  if left.kind != 1 {
    return function_definition(0, 0, 0, 0, offset, left.start, 13)
  }
  let operator = next_token(source, left.start + left.length)
  if is_symbol(source, operator, 40) == 1 {
    let condition_argument = next_token(source, operator.start + operator.length)
    while is_symbol(source, condition_argument, 41) == 0 {
      if condition_argument.kind != 1 {
        if condition_argument.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, condition_argument.start, 13)
        }
      }
      let condition_separator = next_token(source, condition_argument.start + condition_argument.length)
      if is_symbol(source, condition_separator, 46) == 1 {
        let condition_field = next_token(source, condition_separator.start + condition_separator.length)
        if condition_field.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, condition_field.start, 2)
        }
        condition_separator = next_token(source, condition_field.start + condition_field.length)
      }
      while is_arithmetic_operator(source, condition_separator) == 1 {
        let condition_arithmetic_operand = next_token(source, condition_separator.start + condition_separator.length)
        if condition_arithmetic_operand.kind != 1 {
          if condition_arithmetic_operand.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, condition_arithmetic_operand.start, 13)
          }
        }
        condition_separator = next_token(source, condition_arithmetic_operand.start + condition_arithmetic_operand.length)
        if is_symbol(source, condition_separator, 46) == 1 {
          let condition_arithmetic_field = next_token(source, condition_separator.start + condition_separator.length)
          if condition_arithmetic_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, condition_arithmetic_field.start, 2)
          }
          condition_separator = next_token(source, condition_arithmetic_field.start + condition_arithmetic_field.length)
        }
      }
      if is_symbol(source, condition_separator, 44) == 1 {
        condition_argument = next_token(source, condition_separator.start + condition_separator.length)
      } else {
        condition_argument = condition_separator
      }
    }
    operator = next_token(source, condition_argument.start + condition_argument.length)
  }
  if operator.kind != 3 {
    return function_definition(0, 0, 0, 0, offset, operator.start, 13)
  }
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  if right.kind != 1 {
    if right.kind != 2 {
      return function_definition(0, 0, 0, 0, offset, right.start, 13)
    }
  }
  let right_end = next_token(source, right.start + right.length)
  if is_symbol(source, right_end, 46) == 1 {
    let right_field = next_token(source, right_end.start + right_end.length)
    if right_field.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, right_field.start, 2)
    }
    right_end = next_token(source, right_field.start + right_field.length)
  }
  if is_symbol(source, right_end, 40) == 1 {
    let condition_call_argument = next_token(source, right_end.start + right_end.length)
    while is_symbol(source, condition_call_argument, 41) == 0 {
      if condition_call_argument.kind != 1 {
        if condition_call_argument.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, condition_call_argument.start, 13)
        }
      }
      let condition_call_separator = next_token(source, condition_call_argument.start + condition_call_argument.length)
      if is_symbol(source, condition_call_separator, 44) == 1 {
        condition_call_argument = next_token(source, condition_call_separator.start + condition_call_separator.length)
      } else {
        condition_call_argument = condition_call_separator
      }
    }
    right_end = next_token(source, condition_call_argument.start + condition_call_argument.length)
  }
  while is_arithmetic_operator(source, right_end) == 1 {
    let right_arithmetic_operand = next_token(source, right_end.start + right_end.length)
    if right_arithmetic_operand.kind != 1 {
      if right_arithmetic_operand.kind != 2 {
        return function_definition(0, 0, 0, 0, offset, right_arithmetic_operand.start, 13)
      }
    }
    right_end = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
    if is_symbol(source, right_end, 46) == 1 {
      let right_arithmetic_field = next_token(source, right_end.start + right_end.length)
      if right_arithmetic_field.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, right_arithmetic_field.start, 2)
      }
      right_end = next_token(source, right_arithmetic_field.start + right_arithmetic_field.length)
    }
  }
  let open = right_end
  if is_symbol(source, open, 123) == 0 {
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
  } else {
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 125) == 0 {
    if is_while_keyword(source, current) == 1 {
      let nested_while = parse_while_statement(source, current.start)
      if nested_while.status == 0 {
        return nested_while
      }
      current = next_token(source, nested_while.position)
    } else {
      if is_if_keyword(source, current) == 1 {
        let conditional_left = next_token(source, current.start + current.length)
        let conditional_open = next_token(source, conditional_left.start + conditional_left.length)
        let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, conditional_open, 40) == 1 {
          let loop_conditional_first = next_token(source, conditional_open.start + conditional_open.length)
          if is_return_keyword(source, loop_conditional_first) == 1 {
            conditional = parse_local_return_conditional(source, current.start)
          } else {
            conditional = parse_loop_conditional(source, current.start)
          }
        } else {
          conditional = parse_loop_local_conditional(source, current.start)
        }
        if conditional.status == 0 {
          return conditional
        }
        current = next_token(source, conditional.position)
      } else {
        let target = current
        if is_let_keyword(source, current) == 1 {
          target = next_token(source, current.start + current.length)
        }
        if target.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, target.start, 2)
        }
        let equals = next_token(source, target.start + target.length)
        if is_symbol(source, equals, 61) == 0 {
          return function_definition(0, 0, 0, 0, offset, equals.start, 13)
        }
        let operand = next_token(source, equals.start + equals.length)
        if operand.kind != 1 {
          if operand.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, operand.start, 13)
          }
        }
        current = next_token(source, operand.start + operand.length)
        if is_symbol(source, current, 40) == 1 {
          let argument = next_token(source, current.start + current.length)
          while is_symbol(source, argument, 41) == 0 {
            if argument.kind != 1 {
              if argument.kind != 2 {
                return function_definition(0, 0, 0, 0, offset, argument.start, 13)
              }
            }
            let separator = next_token(source, argument.start + argument.length)
            if is_symbol(source, separator, 46) == 1 {
              let argument_field = next_token(source, separator.start + separator.length)
              if argument_field.kind != 1 {
                return function_definition(0, 0, 0, 0, offset, argument_field.start, 2)
              }
              separator = next_token(source, argument_field.start + argument_field.length)
            }
            while is_arithmetic_operator(source, separator) == 1 {
              let argument_arithmetic_operand = next_token(source, separator.start + separator.length)
              if argument_arithmetic_operand.kind != 1 {
                if argument_arithmetic_operand.kind != 2 {
                  return function_definition(0, 0, 0, 0, offset, argument_arithmetic_operand.start, 13)
                }
              }
              separator = next_token(source, argument_arithmetic_operand.start + argument_arithmetic_operand.length)
              if is_symbol(source, separator, 46) == 1 {
                let argument_arithmetic_field = next_token(source, separator.start + separator.length)
                if argument_arithmetic_field.kind != 1 {
                  return function_definition(0, 0, 0, 0, offset, argument_arithmetic_field.start, 2)
                }
                separator = next_token(source, argument_arithmetic_field.start + argument_arithmetic_field.length)
              }
            }
            if is_symbol(source, separator, 44) == 1 {
              argument = next_token(source, separator.start + separator.length)
            } else {
              argument = separator
            }
          }
          current = next_token(source, argument.start + argument.length)
        } else {
          while is_arithmetic_operator(source, current) == 1 {
            let next_operand = next_token(source, current.start + current.length)
            if next_operand.kind != 1 {
              if next_operand.kind != 2 {
                return function_definition(0, 0, 0, 0, offset, next_operand.start, 13)
              }
            }
            current = next_token(source, next_operand.start + next_operand.length)
            if is_symbol(source, current, 40) == 1 {
              let arithmetic_argument = next_token(source, current.start + current.length)
              while is_symbol(source, arithmetic_argument, 41) == 0 {
                if arithmetic_argument.kind != 1 {
                  if arithmetic_argument.kind != 2 {
                    return function_definition(0, 0, 0, 0, offset, arithmetic_argument.start, 13)
                  }
                }
                let arithmetic_separator = next_token(source, arithmetic_argument.start + arithmetic_argument.length)
                if is_symbol(source, arithmetic_separator, 44) == 1 {
                  arithmetic_argument = next_token(source, arithmetic_separator.start + arithmetic_separator.length)
                } else {
                  arithmetic_argument = arithmetic_separator
                }
              }
              current = next_token(source, arithmetic_argument.start + arithmetic_argument.length)
            }
          }
        }
      }
    }
  }
  return function_definition(1, 0, 0, 0, current.start + current.length, 0, 0)
  }
  return function_definition(0, 0, 0, 0, offset, open.start, 10)
}

fn parse_local_return_conditional(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  let left = next_token(source, keyword.start + keyword.length)
  if left.kind != 1 {
    return function_definition(0, 0, 0, 0, offset, left.start, 13)
  }
  let operator = next_token(source, left.start + left.length)
  if is_symbol(source, operator, 46) == 1 {
    let left_field = next_token(source, operator.start + operator.length)
    if left_field.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, left_field.start, 2)
    }
    operator = next_token(source, left_field.start + left_field.length)
  } else {
    if is_symbol(source, operator, 40) == 1 {
      let condition_argument = next_token(source, operator.start + operator.length)
      while is_symbol(source, condition_argument, 41) == 0 {
        if condition_argument.kind != 1 {
          if condition_argument.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, condition_argument.start, 13)
          }
        }
        let condition_separator = next_token(source, condition_argument.start + condition_argument.length)
        if is_symbol(source, condition_separator, 46) == 1 {
          let condition_field = next_token(source, condition_separator.start + condition_separator.length)
          if condition_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, condition_field.start, 2)
          }
          condition_separator = next_token(source, condition_field.start + condition_field.length)
          while is_arithmetic_operator(source, condition_separator) == 1 {
            let condition_arithmetic_operand = next_token(source, condition_separator.start + condition_separator.length)
            if condition_arithmetic_operand.kind != 1 {
              if condition_arithmetic_operand.kind != 2 {
                return function_definition(0, 0, 0, 0, offset, condition_arithmetic_operand.start, 13)
              }
            }
            condition_separator = next_token(source, condition_arithmetic_operand.start + condition_arithmetic_operand.length)
          }
        } else {
          if is_symbol(source, condition_separator, 40) == 1 {
            let nested_condition_argument = next_token(source, condition_separator.start + condition_separator.length)
            while is_symbol(source, nested_condition_argument, 41) == 0 {
              if nested_condition_argument.kind != 1 {
                if nested_condition_argument.kind != 2 {
                  return function_definition(0, 0, 0, 0, offset, nested_condition_argument.start, 13)
                }
              }
              let nested_condition_separator = next_token(source, nested_condition_argument.start + nested_condition_argument.length)
              if is_symbol(source, nested_condition_separator, 44) == 1 {
                nested_condition_argument = next_token(source, nested_condition_separator.start + nested_condition_separator.length)
              } else {
                nested_condition_argument = nested_condition_separator
              }
            }
            condition_separator = next_token(source, nested_condition_argument.start + nested_condition_argument.length)
          }
        }
        if is_symbol(source, condition_separator, 44) == 1 {
          condition_argument = next_token(source, condition_separator.start + condition_separator.length)
        } else {
          condition_argument = condition_separator
        }
      }
      operator = next_token(source, condition_argument.start + condition_argument.length)
    }
  }
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  if right.kind != 1 {
    if right.kind != 2 {
      return function_definition(0, 0, 0, 0, offset, right.start, 13)
    }
  }
  let right_end = next_token(source, right.start + right.length)
  if is_symbol(source, right_end, 46) == 1 {
    let right_field = next_token(source, right_end.start + right_end.length)
    if right_field.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, right_field.start, 2)
    }
    right_end = next_token(source, right_field.start + right_field.length)
  }
  let open = right_end
  if is_symbol(source, open, 123) == 0 {
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
  }
  let body_statement = next_token(source, open.start + open.length)
  while is_return_keyword(source, body_statement) == 0 {
    if is_symbol(source, body_statement, 125) == 1 {
      let body_after_then = next_token(source, body_statement.start + body_statement.length)
      if is_else_keyword(source, body_after_then) == 1 {
        let body_else_open = next_token(source, body_after_then.start + body_after_then.length)
        if is_symbol(source, body_else_open, 123) == 0 {
          return function_definition(0, 0, 0, 0, offset, body_else_open.start, 10)
        }
        let body_else_current = next_token(source, body_else_open.start + body_else_open.length)
        let body_else_depth = 1
        while body_else_depth > 0 {
          if is_symbol(source, body_else_current, 123) == 1 {
            body_else_depth = body_else_depth + 1
          } else {
            if is_symbol(source, body_else_current, 125) == 1 {
              body_else_depth = body_else_depth - 1
            }
          }
          if body_else_depth > 0 {
            body_else_current = next_token(source, body_else_current.start + body_else_current.length)
          }
        }
        return function_definition(1, 0, 0, 0, body_else_current.start + body_else_current.length, 0, 0)
      }
      return function_definition(1, 0, 0, 0, body_statement.start + body_statement.length, 0, 0)
    }
    if is_if_keyword(source, body_statement) == 1 {
      let body_conditional = parse_local_return_conditional(source, body_statement.start)
      if body_conditional.status == 0 {
        return body_conditional
      }
      body_statement = next_token(source, body_conditional.position)
    } else {
      if is_while_keyword(source, body_statement) == 1 {
      let body_while = parse_while_statement(source, body_statement.start)
      if body_while.status == 0 {
        return body_while
      }
      body_statement = next_token(source, body_while.position)
      } else {
        if body_statement.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, body_statement.start, 2)
        }
        if is_let_keyword(source, body_statement) == 1 {
          body_statement = next_token(source, body_statement.start + body_statement.length)
        }
        let body_equals = next_token(source, body_statement.start + body_statement.length)
        if is_symbol(source, body_equals, 61) == 0 {
          return function_definition(0, 0, 0, 0, offset, body_equals.start, 13)
        }
        let body_operand = next_token(source, body_equals.start + body_equals.length)
        if body_operand.kind != 1 {
          if body_operand.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, body_operand.start, 13)
          }
        }
        body_statement = expression_end(source, body_operand)
      }
    }
  }
  let returned = body_statement
  let value = next_token(source, returned.start + returned.length)
  if value.kind != 1 {
    if value.kind != 2 {
      return function_definition(0, 0, 0, 0, offset, value.start, 13)
    }
  }
  let close = next_token(source, value.start + value.length)
  if is_symbol(source, close, 40) == 1 {
    let argument = next_token(source, close.start + close.length)
    while is_symbol(source, argument, 41) == 0 {
      if argument.kind != 1 {
        if argument.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, argument.start, 13)
        }
      }
      let separator = next_token(source, argument.start + argument.length)
      if is_symbol(source, separator, 46) == 1 {
        let argument_field = next_token(source, separator.start + separator.length)
        if argument_field.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, argument_field.start, 2)
        }
        separator = next_token(source, argument_field.start + argument_field.length)
      }
      while is_arithmetic_operator(source, separator) == 1 {
        let return_arithmetic_operand = next_token(source, separator.start + separator.length)
        if return_arithmetic_operand.kind != 1 {
          if return_arithmetic_operand.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, return_arithmetic_operand.start, 13)
          }
        }
        separator = next_token(source, return_arithmetic_operand.start + return_arithmetic_operand.length)
        if is_symbol(source, separator, 46) == 1 {
          let return_arithmetic_field = next_token(source, separator.start + separator.length)
          if return_arithmetic_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, return_arithmetic_field.start, 2)
          }
          separator = next_token(source, return_arithmetic_field.start + return_arithmetic_field.length)
        }
      }
      if is_symbol(source, separator, 44) == 1 {
        argument = next_token(source, separator.start + separator.length)
      } else {
        argument = separator
      }
    }
    close = next_token(source, argument.start + argument.length)
  }
  if is_symbol(source, close, 125) == 0 {
    return function_definition(0, 0, 0, 0, offset, close.start, 15)
  }
  let local_after_then = next_token(source, close.start + close.length)
  if is_else_keyword(source, local_after_then) == 1 {
    let local_else_open = next_token(source, local_after_then.start + local_after_then.length)
    if is_symbol(source, local_else_open, 123) == 0 {
      return function_definition(0, 0, 0, 0, offset, local_else_open.start, 10)
    }
    let local_else_statement = next_token(source, local_else_open.start + local_else_open.length)
    while is_symbol(source, local_else_statement, 125) == 0 {
      if is_if_keyword(source, local_else_statement) == 1 {
        let local_else_nested = parse_local_return_conditional(source, local_else_statement.start)
        if local_else_nested.status == 0 {
          return local_else_nested
        }
        local_else_statement = next_token(source, local_else_nested.position)
      } else {
        if is_while_keyword(source, local_else_statement) == 1 {
          let local_else_while = parse_while_statement(source, local_else_statement.start)
          if local_else_while.status == 0 {
            return local_else_while
          }
          local_else_statement = next_token(source, local_else_while.position)
        } else {
          if is_return_keyword(source, local_else_statement) == 1 {
            let local_else_value = next_token(source, local_else_statement.start + local_else_statement.length)
            local_else_statement = expression_end(source, local_else_value)
          } else {
            if is_let_keyword(source, local_else_statement) == 1 {
              local_else_statement = next_token(source, local_else_statement.start + local_else_statement.length)
            }
            let local_else_equals = next_token(source, local_else_statement.start + local_else_statement.length)
            if is_symbol(source, local_else_equals, 61) == 0 {
              return function_definition(0, 0, 0, 0, offset, local_else_equals.start, 13)
            }
            let local_else_assignment_value = next_token(source, local_else_equals.start + local_else_equals.length)
            local_else_statement = expression_end(source, local_else_assignment_value)
          }
        }
      }
    }
    return function_definition(1, 0, 0, 0, local_else_statement.start + local_else_statement.length, 0, 0)
  }
  return function_definition(1, 0, 0, 0, close.start + close.length, 0, 0)
}

fn parse_local_body(source: bytes, offset: i32, name: token) -> function_definition {
  let current = next_token(source, offset)
  while is_let_keyword(source, current) == 1 {
    let local_name = next_token(source, current.start + current.length)
    if local_name.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, local_name.start, 2)
    }
    let equals = next_token(source, local_name.start + local_name.length)
    if is_symbol(source, equals, 61) == 0 {
      return function_definition(0, 0, 0, 0, offset, equals.start, 13)
    }
    let operand = next_token(source, equals.start + equals.length)
    if operand.kind != 1 {
      if operand.kind != 2 {
        return function_definition(0, 0, 0, 0, offset, operand.start, 13)
      }
    }
    current = next_token(source, operand.start + operand.length)
    if is_symbol(source, current, 46) == 1 {
      let field = next_token(source, current.start + current.length)
      if field.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, field.start, 2)
      }
      current = next_token(source, field.start + field.length)
    }
    if is_symbol(source, current, 40) == 1 {
      let argument = next_token(source, current.start + current.length)
      while is_symbol(source, argument, 41) == 0 {
        if argument.kind != 1 {
          if argument.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, argument.start, 13)
          }
        }
        let argument_separator = next_token(source, argument.start + argument.length)
        if is_symbol(source, argument_separator, 46) == 1 {
          let argument_field = next_token(source, argument_separator.start + argument_separator.length)
          if argument_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, argument_field.start, 2)
          }
          argument_separator = next_token(source, argument_field.start + argument_field.length)
        }
        while is_arithmetic_operator(source, argument_separator) == 1 {
          let argument_next_operand = next_token(source, argument_separator.start + argument_separator.length)
          if argument_next_operand.kind != 1 {
            if argument_next_operand.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, argument_next_operand.start, 13)
            }
          }
          argument_separator = next_token(source, argument_next_operand.start + argument_next_operand.length)
          if is_symbol(source, argument_separator, 46) == 1 {
            let argument_next_field = next_token(source, argument_separator.start + argument_separator.length)
            if argument_next_field.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, argument_next_field.start, 2)
            }
            argument_separator = next_token(source, argument_next_field.start + argument_next_field.length)
          }
        }
        if is_symbol(source, argument_separator, 44) == 1 {
          argument = next_token(source, argument_separator.start + argument_separator.length)
        } else {
          argument = argument_separator
        }
      }
      current = next_token(source, argument.start + argument.length)
    }
    while is_arithmetic_operator(source, current) == 1 {
      let next_operand = next_token(source, current.start + current.length)
      if next_operand.kind != 1 {
        if next_operand.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, next_operand.start, 13)
        }
      }
      current = next_token(source, next_operand.start + next_operand.length)
      if is_symbol(source, current, 46) == 1 {
        let next_field = next_token(source, current.start + current.length)
        if next_field.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, next_field.start, 2)
        }
        current = next_token(source, next_field.start + next_field.length)
      }
    }
  }
  if is_while_keyword(source, current) == 1 {
    let statement = parse_while_statement(source, current.start)
    if statement.status == 0 {
      return statement
    }
    current = next_token(source, statement.position)
  }
  while is_if_keyword(source, current) == 1 {
    let conditional_left = next_token(source, current.start + current.length)
    let conditional_operator = next_token(source, conditional_left.start + conditional_left.length)
    let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
    if is_symbol(source, conditional_operator, 40) == 1 {
      let call_conditional_open = next_token(source, conditional_operator.start + conditional_operator.length)
      let call_conditional_first = next_token(source, call_conditional_open.start + call_conditional_open.length)
      if is_return_keyword(source, call_conditional_first) == 1 {
        conditional = parse_local_return_conditional(source, current.start)
      } else {
        conditional = parse_loop_conditional(source, current.start)
      }
    } else {
      if is_symbol(source, conditional_operator, 46) == 1 {
        let conditional_field = next_token(source, conditional_operator.start + conditional_operator.length)
        let conditional_comparison = next_token(source, conditional_field.start + conditional_field.length)
        let conditional_right = next_token(source, conditional_comparison.start + conditional_comparison.length)
        if is_symbol(source, conditional_right, 61) == 1 {
          conditional_right = next_token(source, conditional_right.start + conditional_right.length)
        }
        let conditional_open = next_token(source, conditional_right.start + conditional_right.length)
        let conditional_first = next_token(source, conditional_open.start + conditional_open.length)
        if is_return_keyword(source, conditional_first) == 1 {
          conditional = parse_conditional_statement(source, current.start, name)
        } else {
          conditional = parse_local_return_conditional(source, current.start)
        }
      } else {
        conditional = parse_conditional_statement(source, current.start, name)
      }
    }
    if conditional.status == 0 {
      return conditional
    }
    current = next_token(source, conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let trailing_local_name = next_token(source, current.start + current.length)
    if trailing_local_name.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, trailing_local_name.start, 2)
    }
    let trailing_equals = next_token(source, trailing_local_name.start + trailing_local_name.length)
    if is_symbol(source, trailing_equals, 61) == 0 {
      return function_definition(0, 0, 0, 0, offset, trailing_equals.start, 13)
    }
    let trailing_operand = next_token(source, trailing_equals.start + trailing_equals.length)
    if trailing_operand.kind != 1 {
      if trailing_operand.kind != 2 {
        return function_definition(0, 0, 0, 0, offset, trailing_operand.start, 13)
      }
    }
    current = next_token(source, trailing_operand.start + trailing_operand.length)
    if is_symbol(source, current, 46) == 1 {
      let trailing_field = next_token(source, current.start + current.length)
      if trailing_field.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, trailing_field.start, 2)
      }
      current = next_token(source, trailing_field.start + trailing_field.length)
    }
    if is_symbol(source, current, 40) == 1 {
      let trailing_argument = next_token(source, current.start + current.length)
      while is_symbol(source, trailing_argument, 41) == 0 {
        if trailing_argument.kind != 1 {
          if trailing_argument.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, trailing_argument.start, 13)
          }
        }
        let trailing_separator = next_token(source, trailing_argument.start + trailing_argument.length)
        if is_symbol(source, trailing_separator, 46) == 1 {
          let trailing_argument_field = next_token(source, trailing_separator.start + trailing_separator.length)
          if trailing_argument_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, trailing_argument_field.start, 2)
          }
          trailing_separator = next_token(source, trailing_argument_field.start + trailing_argument_field.length)
        }
        while is_arithmetic_operator(source, trailing_separator) == 1 {
          let trailing_argument_operand = next_token(source, trailing_separator.start + trailing_separator.length)
          if trailing_argument_operand.kind != 1 {
            if trailing_argument_operand.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, trailing_argument_operand.start, 13)
            }
          }
          trailing_separator = next_token(source, trailing_argument_operand.start + trailing_argument_operand.length)
          if is_symbol(source, trailing_separator, 46) == 1 {
            let trailing_argument_next_field = next_token(source, trailing_separator.start + trailing_separator.length)
            if trailing_argument_next_field.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, trailing_argument_next_field.start, 2)
            }
            trailing_separator = next_token(source, trailing_argument_next_field.start + trailing_argument_next_field.length)
          }
        }
        if is_symbol(source, trailing_separator, 44) == 1 {
          trailing_argument = next_token(source, trailing_separator.start + trailing_separator.length)
        } else {
          trailing_argument = trailing_separator
        }
      }
      current = next_token(source, trailing_argument.start + trailing_argument.length)
    }
    while is_arithmetic_operator(source, current) == 1 {
      let trailing_next_operand = next_token(source, current.start + current.length)
      if trailing_next_operand.kind != 1 {
        if trailing_next_operand.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, trailing_next_operand.start, 13)
        }
      }
      current = next_token(source, trailing_next_operand.start + trailing_next_operand.length)
    }
  }
  if is_while_keyword(source, current) == 1 {
    let trailing_while = parse_while_statement(source, current.start)
    if trailing_while.status == 0 {
      return trailing_while
    }
    current = next_token(source, trailing_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    let final_conditional = parse_local_return_conditional(source, current.start)
    if final_conditional.status == 0 {
      return final_conditional
    }
    current = next_token(source, final_conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let post_conditional_local_name = next_token(source, current.start + current.length)
    if post_conditional_local_name.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, post_conditional_local_name.start, 2)
    }
    let post_conditional_equals = next_token(source, post_conditional_local_name.start + post_conditional_local_name.length)
    if is_symbol(source, post_conditional_equals, 61) == 0 {
      return function_definition(0, 0, 0, 0, offset, post_conditional_equals.start, 13)
    }
    let post_conditional_operand = next_token(source, post_conditional_equals.start + post_conditional_equals.length)
    if post_conditional_operand.kind != 1 {
      if post_conditional_operand.kind != 2 {
        return function_definition(0, 0, 0, 0, offset, post_conditional_operand.start, 13)
      }
    }
    current = next_token(source, post_conditional_operand.start + post_conditional_operand.length)
    if is_symbol(source, current, 46) == 1 {
      let post_conditional_field = next_token(source, current.start + current.length)
      if post_conditional_field.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, post_conditional_field.start, 2)
      }
      current = next_token(source, post_conditional_field.start + post_conditional_field.length)
    }
    if is_symbol(source, current, 40) == 1 {
      let post_conditional_argument = next_token(source, current.start + current.length)
      while is_symbol(source, post_conditional_argument, 41) == 0 {
        if post_conditional_argument.kind != 1 {
          if post_conditional_argument.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, post_conditional_argument.start, 13)
          }
        }
        let post_conditional_separator = next_token(source, post_conditional_argument.start + post_conditional_argument.length)
        if is_symbol(source, post_conditional_separator, 46) == 1 {
          let post_conditional_argument_field = next_token(source, post_conditional_separator.start + post_conditional_separator.length)
          if post_conditional_argument_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, post_conditional_argument_field.start, 2)
          }
          post_conditional_separator = next_token(source, post_conditional_argument_field.start + post_conditional_argument_field.length)
        }
        while is_arithmetic_operator(source, post_conditional_separator) == 1 {
          let post_conditional_argument_operand = next_token(source, post_conditional_separator.start + post_conditional_separator.length)
          if post_conditional_argument_operand.kind != 1 {
            if post_conditional_argument_operand.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, post_conditional_argument_operand.start, 13)
            }
          }
          post_conditional_separator = next_token(source, post_conditional_argument_operand.start + post_conditional_argument_operand.length)
          if is_symbol(source, post_conditional_separator, 46) == 1 {
            let post_conditional_argument_next_field = next_token(source, post_conditional_separator.start + post_conditional_separator.length)
            if post_conditional_argument_next_field.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, post_conditional_argument_next_field.start, 2)
            }
            post_conditional_separator = next_token(source, post_conditional_argument_next_field.start + post_conditional_argument_next_field.length)
          }
        }
        if is_symbol(source, post_conditional_separator, 44) == 1 {
          post_conditional_argument = next_token(source, post_conditional_separator.start + post_conditional_separator.length)
        } else {
          post_conditional_argument = post_conditional_separator
        }
      }
      current = next_token(source, post_conditional_argument.start + post_conditional_argument.length)
    }
    while is_arithmetic_operator(source, current) == 1 {
      let post_conditional_next_operand = next_token(source, current.start + current.length)
      if post_conditional_next_operand.kind != 1 {
        if post_conditional_next_operand.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, post_conditional_next_operand.start, 13)
        }
      }
      current = next_token(source, post_conditional_next_operand.start + post_conditional_next_operand.length)
    }
  }
  if is_while_keyword(source, current) == 1 {
    let post_conditional_while = parse_while_statement(source, current.start)
    if post_conditional_while.status == 0 {
      return post_conditional_while
    }
    current = next_token(source, post_conditional_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    let post_conditional_if = parse_local_return_conditional(source, current.start)
    if post_conditional_if.status == 0 {
      return post_conditional_if
    }
    current = next_token(source, post_conditional_if.position)
  }
  while is_let_keyword(source, current) == 1 {
    let continuation_name = next_token(source, current.start + current.length)
    if continuation_name.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, continuation_name.start, 2)
    }
    let continuation_equals = next_token(source, continuation_name.start + continuation_name.length)
    if is_symbol(source, continuation_equals, 61) == 0 {
      return function_definition(0, 0, 0, 0, offset, continuation_equals.start, 13)
    }
    let continuation_operand = next_token(source, continuation_equals.start + continuation_equals.length)
    if continuation_operand.kind != 1 {
      if continuation_operand.kind != 2 {
        return function_definition(0, 0, 0, 0, offset, continuation_operand.start, 13)
      }
    }
    current = next_token(source, continuation_operand.start + continuation_operand.length)
    if is_symbol(source, current, 46) == 1 {
      let continuation_field = next_token(source, current.start + current.length)
      if continuation_field.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, continuation_field.start, 2)
      }
      current = next_token(source, continuation_field.start + continuation_field.length)
    }
    if is_symbol(source, current, 40) == 1 {
      let continuation_argument = next_token(source, current.start + current.length)
      while is_symbol(source, continuation_argument, 41) == 0 {
        if continuation_argument.kind != 1 {
          if continuation_argument.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, continuation_argument.start, 13)
          }
        }
        let continuation_separator = next_token(source, continuation_argument.start + continuation_argument.length)
        if is_symbol(source, continuation_separator, 46) == 1 {
          let continuation_argument_field = next_token(source, continuation_separator.start + continuation_separator.length)
          if continuation_argument_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, continuation_argument_field.start, 2)
          }
          continuation_separator = next_token(source, continuation_argument_field.start + continuation_argument_field.length)
        }
        while is_arithmetic_operator(source, continuation_separator) == 1 {
          let continuation_operand_after_operator = next_token(source, continuation_separator.start + continuation_separator.length)
          if continuation_operand_after_operator.kind != 1 {
            if continuation_operand_after_operator.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, continuation_operand_after_operator.start, 13)
            }
          }
          continuation_separator = next_token(source, continuation_operand_after_operator.start + continuation_operand_after_operator.length)
          if is_symbol(source, continuation_separator, 46) == 1 {
            let continuation_next_field = next_token(source, continuation_separator.start + continuation_separator.length)
            if continuation_next_field.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, continuation_next_field.start, 2)
            }
            continuation_separator = next_token(source, continuation_next_field.start + continuation_next_field.length)
          }
        }
        if is_symbol(source, continuation_separator, 44) == 1 {
          continuation_argument = next_token(source, continuation_separator.start + continuation_separator.length)
        } else {
          continuation_argument = continuation_separator
        }
      }
      current = next_token(source, continuation_argument.start + continuation_argument.length)
    }
    while is_arithmetic_operator(source, current) == 1 {
      let continuation_next_operand = next_token(source, current.start + current.length)
      if continuation_next_operand.kind != 1 {
        if continuation_next_operand.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, continuation_next_operand.start, 13)
        }
      }
      current = next_token(source, continuation_next_operand.start + continuation_next_operand.length)
    }
  }
  if is_while_keyword(source, current) == 1 {
    let continuation_while = parse_while_statement(source, current.start)
    if continuation_while.status == 0 {
      return continuation_while
    }
    current = next_token(source, continuation_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    let continuation_if = parse_local_return_conditional(source, current.start)
    if continuation_if.status == 0 {
      return continuation_if
    }
    current = next_token(source, continuation_if.position)
  }
  if is_while_keyword(source, current) == 1 {
    let second_continuation_while = parse_while_statement(source, current.start)
    if second_continuation_while.status == 0 {
      return second_continuation_while
    }
    current = next_token(source, second_continuation_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    let second_continuation_if = parse_local_return_conditional(source, current.start)
    if second_continuation_if.status == 0 {
      return second_continuation_if
    }
    current = next_token(source, second_continuation_if.position)
  }
  while is_let_keyword(source, current) == 1 {
    let third_local_name = next_token(source, current.start + current.length)
    if third_local_name.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, third_local_name.start, 2)
    }
    let third_equals = next_token(source, third_local_name.start + third_local_name.length)
    if is_symbol(source, third_equals, 61) == 0 {
      return function_definition(0, 0, 0, 0, offset, third_equals.start, 13)
    }
    let third_operand = next_token(source, third_equals.start + third_equals.length)
    if third_operand.kind != 1 {
      if third_operand.kind != 2 {
        return function_definition(0, 0, 0, 0, offset, third_operand.start, 13)
      }
    }
    current = next_token(source, third_operand.start + third_operand.length)
    if is_symbol(source, current, 46) == 1 {
      let third_field = next_token(source, current.start + current.length)
      if third_field.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, third_field.start, 2)
      }
      current = next_token(source, third_field.start + third_field.length)
    }
    if is_symbol(source, current, 40) == 1 {
      let third_argument = next_token(source, current.start + current.length)
      while is_symbol(source, third_argument, 41) == 0 {
        if third_argument.kind != 1 {
          if third_argument.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, third_argument.start, 13)
          }
        }
        let third_separator = next_token(source, third_argument.start + third_argument.length)
        if is_symbol(source, third_separator, 46) == 1 {
          let third_argument_field = next_token(source, third_separator.start + third_separator.length)
          if third_argument_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, third_argument_field.start, 2)
          }
          third_separator = next_token(source, third_argument_field.start + third_argument_field.length)
        }
        while is_arithmetic_operator(source, third_separator) == 1 {
          let third_argument_operand = next_token(source, third_separator.start + third_separator.length)
          if third_argument_operand.kind != 1 {
            if third_argument_operand.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, third_argument_operand.start, 13)
            }
          }
          third_separator = next_token(source, third_argument_operand.start + third_argument_operand.length)
          if is_symbol(source, third_separator, 46) == 1 {
            let third_argument_next_field = next_token(source, third_separator.start + third_separator.length)
            if third_argument_next_field.kind != 1 {
              return function_definition(0, 0, 0, 0, offset, third_argument_next_field.start, 2)
            }
            third_separator = next_token(source, third_argument_next_field.start + third_argument_next_field.length)
          }
        }
        if is_symbol(source, third_separator, 44) == 1 {
          third_argument = next_token(source, third_separator.start + third_separator.length)
        } else {
          third_argument = third_separator
        }
      }
      current = next_token(source, third_argument.start + third_argument.length)
    }
    while is_arithmetic_operator(source, current) == 1 {
      let third_next_operand = next_token(source, current.start + current.length)
      if third_next_operand.kind != 1 {
        if third_next_operand.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, third_next_operand.start, 13)
        }
      }
      current = next_token(source, third_next_operand.start + third_next_operand.length)
      if is_symbol(source, current, 46) == 1 {
        let third_next_field = next_token(source, current.start + current.length)
        if third_next_field.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, third_next_field.start, 2)
        }
        current = next_token(source, third_next_field.start + third_next_field.length)
      }
    }
  }
  if is_while_keyword(source, current) == 1 {
    let third_continuation_while = parse_while_statement(source, current.start)
    if third_continuation_while.status == 0 {
      return third_continuation_while
    }
    current = next_token(source, third_continuation_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    let third_continuation_if = parse_local_return_conditional(source, current.start)
    if third_continuation_if.status == 0 {
      return third_continuation_if
    }
    current = next_token(source, third_continuation_if.position)
  }
  if is_return_keyword(source, current) == 0 {
    return function_definition(0, 0, 0, 0, offset, current.start, 11)
  }
  let returned = next_token(source, current.start + current.length)
  if is_symbol(source, returned, 45) == 1 {
    let negative_returned = next_token(source, returned.start + returned.length)
    if negative_returned.kind != 2 {
      return function_definition(0, 0, 0, 0, offset, negative_returned.start, 12)
    }
    returned = negative_returned
  } else {
    if returned.kind != 1 {
      if returned.kind != 2 {
        return function_definition(0, 0, 0, 0, offset, returned.start, 12)
      }
    }
  }
  let close = next_token(source, returned.start + returned.length)
  if is_symbol(source, close, 40) == 1 {
    let constructor_argument = next_token(source, close.start + close.length)
    while is_symbol(source, constructor_argument, 41) == 0 {
      if constructor_argument.kind != 1 {
        if constructor_argument.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, constructor_argument.start, 13)
        }
      }
      let constructor_separator = next_token(source, constructor_argument.start + constructor_argument.length)
      if is_symbol(source, constructor_separator, 46) == 1 {
        let constructor_field = next_token(source, constructor_separator.start + constructor_separator.length)
        if constructor_field.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, constructor_field.start, 2)
        }
        constructor_separator = next_token(source, constructor_field.start + constructor_field.length)
      }
      while is_arithmetic_operator(source, constructor_separator) == 1 {
        let constructor_arithmetic_operand = next_token(source, constructor_separator.start + constructor_separator.length)
        if constructor_arithmetic_operand.kind != 1 {
          if constructor_arithmetic_operand.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, constructor_arithmetic_operand.start, 13)
          }
        }
        constructor_separator = next_token(source, constructor_arithmetic_operand.start + constructor_arithmetic_operand.length)
        if is_symbol(source, constructor_separator, 46) == 1 {
          let constructor_arithmetic_field = next_token(source, constructor_separator.start + constructor_separator.length)
          if constructor_arithmetic_field.kind != 1 {
            return function_definition(0, 0, 0, 0, offset, constructor_arithmetic_field.start, 2)
          }
          constructor_separator = next_token(source, constructor_arithmetic_field.start + constructor_arithmetic_field.length)
        }
      }
      if is_symbol(source, constructor_separator, 44) == 1 {
        constructor_argument = next_token(source, constructor_separator.start + constructor_separator.length)
      } else {
        constructor_argument = constructor_separator
      }
    }
    close = next_token(source, constructor_argument.start + constructor_argument.length)
  } else {
    if is_symbol(source, close, 46) == 1 {
      let return_field = next_token(source, close.start + close.length)
      if return_field.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, return_field.start, 2)
      }
      close = next_token(source, return_field.start + return_field.length)
    }
    while is_arithmetic_operator(source, close) == 1 {
      let return_operand = next_token(source, close.start + close.length)
      if return_operand.kind != 1 {
        if return_operand.kind != 2 {
          return function_definition(0, 0, 0, 0, offset, return_operand.start, 13)
        }
      }
      close = next_token(source, return_operand.start + return_operand.length)
      if is_symbol(source, close, 46) == 1 {
        let return_operand_field = next_token(source, close.start + close.length)
        if return_operand_field.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, return_operand_field.start, 2)
        }
        close = next_token(source, return_operand_field.start + return_operand_field.length)
      }
    }
  }
  if is_symbol(source, close, 125) == 0 {
    return function_definition(0, 0, 0, 0, offset, close.start, 15)
  }
  return function_definition(1, name.start, name.length, 0, close.start + close.length, 0, 0)
}

fn parse_function(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  if is_export_keyword(source, keyword) == 1 {
    keyword = next_token(source, keyword.start + keyword.length)
  }
  if is_fn_keyword(source, keyword) == 0 {
    return function_definition(0, 0, 0, 0, offset, keyword.start, 3)
  }
  let name = next_token(source, keyword.start + keyword.length)
  if name.kind != 1 {
    return function_definition(0, 0, 0, 0, offset, name.start, 2)
  }
  let open = next_token(source, name.start + name.length)
  if is_symbol(source, open, 40) == 0 {
    return function_definition(0, 0, 0, 0, offset, open.start, 4)
  }
  let parameter = next_token(source, open.start + open.length)
  let close = parameter
  if is_symbol(source, parameter, 41) == 0 {
    let current_parameter = parameter
    while is_symbol(source, close, 41) == 0 {
      if current_parameter.kind != 1 {
        return function_definition(0, 0, 0, 0, offset, current_parameter.start, 5)
      }
      let colon = next_token(source, current_parameter.start + current_parameter.length)
      if is_symbol(source, colon, 58) == 0 {
        return function_definition(0, 0, 0, 0, offset, colon.start, 6)
      }
      let parameter_type = next_token(source, colon.start + colon.length)
      if is_i32_type(source, parameter_type) == 0 {
        if is_bytes_type(source, parameter_type) == 0 {
          if struct_field_count(source, parameter_type) < 0 {
            return function_definition(0, 0, 0, 0, offset, parameter_type.start, 7)
          }
        }
      }
      close = next_token(source, parameter_type.start + parameter_type.length)
      if is_symbol(source, close, 44) == 1 {
        current_parameter = next_token(source, close.start + close.length)
        close = current_parameter
      } else {
        if is_symbol(source, close, 41) == 0 {
          return function_definition(0, 0, 0, 0, offset, close.start, 14)
        }
      }
    }
  }
  let minus = next_token(source, close.start + close.length)
  if is_symbol(source, minus, 45) == 0 {
    return function_definition(0, 0, 0, 0, offset, minus.start, 8)
  }
  let arrow = next_token(source, minus.start + minus.length)
  if is_symbol(source, arrow, 62) == 0 {
    return function_definition(0, 0, 0, 0, offset, arrow.start, 9)
  }
  let result_type = next_token(source, arrow.start + arrow.length)
  if is_i32_type(source, result_type) == 0 {
    if is_bytes_type(source, result_type) == 0 {
      if struct_field_count(source, result_type) < 0 {
        return function_definition(0, 0, 0, 0, offset, result_type.start, 7)
      }
    }
  }
  let open_body = next_token(source, result_type.start + result_type.length)
  if is_symbol(source, open_body, 123) == 0 {
    return function_definition(0, 0, 0, 0, offset, open_body.start, 10)
  }
  let returned = next_token(source, open_body.start + open_body.length)
  if is_let_keyword(source, returned) == 1 {
    return parse_local_body(source, returned.start, name)
  }
  if is_if_keyword(source, returned) == 1 {
    return parse_local_body(source, returned.start, name)
  }
  if is_return_keyword(source, returned) == 0 {
    return function_definition(0, 0, 0, 0, offset, returned.start, 11)
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
      return function_definition(0, 0, 0, 0, offset, value_token.start, 13)
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
            return function_definition(0, 0, 0, 0, offset, argument_value.start, 13)
          }
        } else {
          if argument.kind == 1 {
            if is_symbol(source, parameter, 41) == 1 {
              return function_definition(0, 0, 0, 0, offset, argument.start, 12)
            }
            if same_token(source, parameter, argument) == 0 {
              return function_definition(0, 0, 0, 0, offset, argument.start, 12)
            }
          } else {
            if argument.kind != 2 {
              return function_definition(0, 0, 0, 0, offset, argument.start, 12)
            }
          }
        }
        call_close = next_token(source, argument_value.start + argument_value.length)
        while is_symbol(source, call_close, 44) == 1 {
          let next_argument = next_token(source, call_close.start + call_close.length)
          if next_argument.kind != 2 {
            return function_definition(0, 0, 0, 0, offset, next_argument.start, 13)
          }
          call_close = next_token(source, next_argument.start + next_argument.length)
        }
      }
      if is_symbol(source, call_close, 41) == 0 {
        return function_definition(0, 0, 0, 0, offset, call_close.start, 14)
      }
      let call_body_close = next_token(source, call_close.start + call_close.length)
      if is_symbol(source, call_body_close, 46) == 1 {
        let field = next_token(source, call_body_close.start + call_body_close.length)
        if field.kind != 1 {
          return function_definition(0, 0, 0, 0, offset, field.start, 2)
        }
        call_body_close = next_token(source, field.start + field.length)
      }
      if is_symbol(source, call_body_close, 125) == 0 {
        return function_definition(0, 0, 0, 0, offset, call_body_close.start, 15)
      }
      return function_definition(1, name.start, name.length, -2, call_body_close.start + call_body_close.length, 0, 0)
    }
    if returned_value.kind != 1 {
      return function_definition(0, 0, 0, 0, offset, returned_value.start, 12)
    }
    let current_function = function_definition(1, name.start, name.length, 0, offset, 0, 0)
    if returned_parameter_index(source, current_function, returned_value) < 0 {
      return function_definition(0, 0, 0, 0, offset, returned_value.start, 12)
    }
    return_value = -1
  }
  let close_body = next_token(source, value_token.start + value_token.length)
  if is_symbol(source, close_body, 125) == 0 {
    return function_definition(0, 0, 0, 0, offset, close_body.start, 15)
  }
  let name_start = name.start
  let name_length = name.length
  let next_position = close_body.start + close_body.length
  return function_definition(1, name_start, name_length, return_value, next_position, 0, 0)
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
      if is_struct_keyword(source, keyword) == 1 {
        let definition = parse_struct(source, keyword.start)
        if definition.status == 0 {
          return 0
        }
        position = definition.position
      } else {
        let function = parse_function(source, keyword.start)
        if function.status == 0 {
          return 0
        }
        position = function.position
      }
    }
  }
  return 1
}

fn program_diagnostic(source: bytes) -> compile_diagnostic {
  let first = next_token(source, 0)
  if first.kind != 1 {
    return compile_diagnostic(1, first.start, 1)
  }
  if is_module_keyword(source, first) == 0 {
    return compile_diagnostic(1, first.start, 1)
  }
  let name = next_token(source, first.start + first.length)
  if name.kind != 1 {
    return compile_diagnostic(1, name.start, 2)
  }
  let position = name.start + name.length
  while position < byte_length(source) {
    let keyword = next_token(source, position)
    if keyword.kind == 0 {
      return compile_diagnostic(1, keyword.start, 3)
    }
    if keyword.kind != 1 {
      return compile_diagnostic(1, keyword.start, 3)
    }
    if is_import_keyword(source, keyword) == 1 {
      let imported = next_token(source, keyword.start + keyword.length)
      if imported.kind != 1 {
        return compile_diagnostic(1, imported.start, 2)
      }
      position = imported.start + imported.length
    } else {
      if is_struct_keyword(source, keyword) == 1 {
        let definition = parse_struct(source, keyword.start)
        if definition.status == 0 {
          return compile_diagnostic(1, definition.error_offset, definition.error_expected)
        }
        position = definition.position
      } else {
        let function = parse_function(source, keyword.start)
        if function.status == 0 {
          return compile_diagnostic(1, function.error_offset, function.error_expected)
        }
        position = function.position
      }
    }
  }
  return compile_diagnostic(1, byte_length(source), 3)
}

fn first_function(source: bytes) -> function_definition {
  let module_keyword = next_token(source, 0)
  if module_keyword.kind != 1 {
    return function_definition(0, 0, 0, 0, 0, module_keyword.start, 1)
  }
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  let position = module_name.start + module_name.length
  while position < byte_length(source) {
    let keyword = next_token(source, position)
    if keyword.kind == 0 {
      return function_definition(0, 0, 0, 0, position, keyword.start, 3)
    }
    if is_import_keyword(source, keyword) == 1 {
      let imported = next_token(source, keyword.start + keyword.length)
      position = imported.start + imported.length
    } else {
      if is_struct_keyword(source, keyword) == 1 {
        let definition = parse_struct(source, keyword.start)
        position = definition.position
      } else {
        return parse_function(source, keyword.start)
      }
    }
  }
  return function_definition(0, 0, 0, 0, position, position, 3)
}

fn function_at_index(source: bytes, target: i32) -> function_definition {
  let function = first_function(source)
  let index = 0
  while index < target {
    let next = next_token(source, function.position)
    function = parse_function(source, next.start)
    index = index + 1
  }
  return function
}

fn function_parameter_close(source: bytes, function: function_definition) -> token {
  let name = token(1, function.name_start, function.name_length)
  let open = next_token(source, name.start + name.length)
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 41) == 0 {
    let colon = next_token(source, current.start + current.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    current = next_token(source, parameter_type.start + parameter_type.length)
    if is_symbol(source, current, 44) == 1 {
      current = next_token(source, current.start + current.length)
    }
  }
  return current
}

fn function_parameter_count_of(source: bytes, function: function_definition) -> i32 {
  let name = token(1, function.name_start, function.name_length)
  let open = next_token(source, name.start + name.length)
  let current = next_token(source, open.start + open.length)
  let count = 0
  while is_symbol(source, current, 41) == 0 {
    let colon = next_token(source, current.start + current.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    if is_bytes_type(source, parameter_type) == 1 {
      count = count + 2
    } else {
      count = count + 1
    }
    current = next_token(source, parameter_type.start + parameter_type.length)
    if is_symbol(source, current, 44) == 1 {
      current = next_token(source, current.start + current.length)
    }
  }
  return count
}

fn returned_parameter_index(source: bytes, function: function_definition, returned: token) -> i32 {
  let name = token(1, function.name_start, function.name_length)
  let open = next_token(source, name.start + name.length)
  let current = next_token(source, open.start + open.length)
  let index = 0
  while is_symbol(source, current, 41) == 0 {
    if same_token(source, current, returned) == 1 {
      return index
    }
    let colon = next_token(source, current.start + current.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    if is_bytes_type(source, parameter_type) == 1 {
      index = index + 2
    } else {
      index = index + 1
    }
    current = next_token(source, parameter_type.start + parameter_type.length)
    if is_symbol(source, current, 44) == 1 {
      current = next_token(source, current.start + current.length)
    }
  }
  return -1
}

fn returned_value_token(source: bytes, function: function_definition) -> token {
  let close = function_parameter_close(source, function)
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  let open_body = next_token(source, result_type.start + result_type.length)
  let returned = next_token(source, open_body.start + open_body.length)
  return next_token(source, returned.start + returned.length)
}

fn function_body_first_token(source: bytes, function: function_definition) -> token {
  let close = function_parameter_close(source, function)
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  let open_body = next_token(source, result_type.start + result_type.length)
  return next_token(source, open_body.start + open_body.length)
}

fn function_returns_struct(source: bytes, function: function_definition) -> i32 {
  let close = function_parameter_close(source, function)
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  if struct_field_count(source, result_type) >= 0 {
    return 1
  }
  return 0
}

fn function_body_kind_of(source: bytes, function: function_definition) -> i32 {
  let first = function_body_first_token(source, function)
  if is_let_keyword(source, first) == 1 {
    return 6
  }
  if is_if_keyword(source, first) == 1 {
    return 6
  }
  let value = returned_value_token(source, function)
  if is_symbol(source, value, 45) == 1 {
    return 0
  }
  if value.kind == 2 {
    return 0
  }
  let call_open = next_token(source, value.start + value.length)
  if is_symbol(source, call_open, 40) == 1 {
    let current = next_token(source, call_open.start + call_open.length)
    while is_symbol(source, current, 41) == 0 {
      current = next_token(source, current.start + current.length)
    }
    let after_call = next_token(source, current.start + current.length)
    if is_symbol(source, after_call, 46) == 1 {
      return 3
    }
    if struct_field_count(source, value) >= 0 {
      return 5
    }
    return 2
  }
  return 1
}

fn count_let_tokens_in_range(source: bytes, start: i32, end: i32) -> i32 {
  let current = next_token(source, start)
  let count = 0
  while current.start < end {
    if is_let_keyword(source, current) == 1 {
      count = count + 1
    }
    current = next_token(source, current.start + current.length)
  }
  return count
}

fn let_offset_in_range(source: bytes, start: i32, end: i32, target: token) -> i32 {
  let current = next_token(source, start)
  let offset = 0
  while current.start < end {
    if is_let_keyword(source, current) == 1 {
      let name = next_token(source, current.start + current.length)
      if same_token(source, name, target) == 1 {
        return offset
      }
      offset = offset + 1
    }
    current = next_token(source, current.start + current.length)
  }
  return -1
}

fn local_count_of(source: bytes, function: function_definition) -> i32 {
  let current = function_body_first_token(source, function)
  let count = 0
  while is_let_keyword(source, current) == 1 {
    let name = next_token(source, current.start + current.length)
    let equals = next_token(source, name.start + name.length)
    let operand = next_token(source, equals.start + equals.length)
    current = next_token(source, operand.start + operand.length)
    if is_symbol(source, current, 46) == 1 {
      let field = next_token(source, current.start + current.length)
      current = next_token(source, field.start + field.length)
    }
    if is_symbol(source, current, 40) == 1 {
      let argument = next_token(source, current.start + current.length)
      let close_call = next_token(source, argument.start + argument.length)
      if is_symbol(source, argument, 41) == 1 {
        current = next_token(source, argument.start + argument.length)
      } else {
        while is_symbol(source, argument, 41) == 0 {
          let argument_separator = next_token(source, argument.start + argument.length)
          if is_symbol(source, argument_separator, 44) == 1 {
            argument = next_token(source, argument_separator.start + argument_separator.length)
          } else {
            argument = argument_separator
          }
        }
        current = next_token(source, argument.start + argument.length)
      }
    }
    while is_arithmetic_operator(source, current) == 1 {
      let next_operand = next_token(source, current.start + current.length)
      current = next_token(source, next_operand.start + next_operand.length)
    }
    count = count + 1
  }
  if is_while_keyword(source, current) == 1 {
    let post_conditional_left = next_token(source, current.start + current.length)
    let post_conditional_operator = next_token(source, post_conditional_left.start + post_conditional_left.length)
    let post_conditional_right = next_token(source, post_conditional_operator.start + post_conditional_operator.length)
    let post_conditional_open = expression_end(source, post_conditional_right)
    current = next_token(source, post_conditional_open.start + post_conditional_open.length)
    while is_symbol(source, current, 125) == 0 {
      if is_if_keyword(source, current) == 1 {
        let post_conditional_loop_left = next_token(source, current.start + current.length)
        let post_conditional_loop_open = next_token(source, post_conditional_loop_left.start + post_conditional_loop_left.length)
        let post_conditional_loop_statement = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, post_conditional_loop_open, 40) == 1 {
          post_conditional_loop_statement = parse_loop_conditional(source, current.start)
        } else {
          post_conditional_loop_statement = parse_loop_local_conditional(source, current.start)
        }
        count = count + count_let_tokens_in_range(source, current.start, post_conditional_loop_statement.position)
        current = next_token(source, post_conditional_loop_statement.position)
      } else {
        let post_conditional_target = current
        if is_let_keyword(source, current) == 1 {
          post_conditional_target = next_token(source, current.start + current.length)
          count = count + 1
        }
        let post_conditional_loop_equals = next_token(source, post_conditional_target.start + post_conditional_target.length)
        let post_conditional_loop_operand = next_token(source, post_conditional_loop_equals.start + post_conditional_loop_equals.length)
        current = expression_end(source, post_conditional_loop_operand)
      }
    }
    current = next_token(source, current.start + current.length)
  }
  while is_if_keyword(source, current) == 1 {
    let trailing_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, trailing_conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let trailing_name = next_token(source, current.start + current.length)
    let trailing_equals = next_token(source, trailing_name.start + trailing_name.length)
    let trailing_operand = next_token(source, trailing_equals.start + trailing_equals.length)
    current = expression_end(source, trailing_operand)
    count = count + 1
  }
  while is_if_keyword(source, current) == 1 {
    let post_local_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_local_conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let post_conditional_name = next_token(source, current.start + current.length)
    let post_conditional_equals = next_token(source, post_conditional_name.start + post_conditional_name.length)
    let post_conditional_operand = next_token(source, post_conditional_equals.start + post_conditional_equals.length)
    current = expression_end(source, post_conditional_operand)
    count = count + 1
  }
  if is_while_keyword(source, current) == 1 {
    let left = next_token(source, current.start + current.length)
    let operator = next_token(source, left.start + left.length)
    let right = next_token(source, operator.start + operator.length)
    let open = expression_end(source, right)
    current = next_token(source, open.start + open.length)
    while is_symbol(source, current, 125) == 0 {
      if is_if_keyword(source, current) == 1 {
        let conditional_left = next_token(source, current.start + current.length)
        let conditional_open = next_token(source, conditional_left.start + conditional_left.length)
        let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, conditional_open, 40) == 1 {
          let loop_conditional_first = next_token(source, conditional_open.start + conditional_open.length)
          if is_return_keyword(source, loop_conditional_first) == 1 {
            conditional = parse_local_return_conditional(source, current.start)
          } else {
            conditional = parse_loop_conditional(source, current.start)
          }
        } else {
          conditional = parse_loop_local_conditional(source, current.start)
        }
        count = count + count_let_tokens_in_range(source, current.start, conditional.position)
        current = next_token(source, conditional.position)
      } else {
        let target = current
        if is_let_keyword(source, current) == 1 {
          target = next_token(source, current.start + current.length)
          count = count + 1
        }
        let loop_equals = next_token(source, target.start + target.length)
        let loop_operand = next_token(source, loop_equals.start + loop_equals.length)
        current = expression_end(source, loop_operand)
      }
    }
    current = next_token(source, current.start + current.length)
  }
  while is_if_keyword(source, current) == 1 {
    let post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_conditional_if.position)
  }
  while is_let_keyword(source, current) == 1 {
    let second_trailing_name = next_token(source, current.start + current.length)
    let second_trailing_equals = next_token(source, second_trailing_name.start + second_trailing_name.length)
    let second_trailing_operand = next_token(source, second_trailing_equals.start + second_trailing_equals.length)
    current = expression_end(source, second_trailing_operand)
    count = count + 1
  }
  if is_while_keyword(source, current) == 1 {
    let second_left = next_token(source, current.start + current.length)
    let second_operator = next_token(source, second_left.start + second_left.length)
    let second_right = next_token(source, second_operator.start + second_operator.length)
    let second_open = expression_end(source, second_right)
    current = next_token(source, second_open.start + second_open.length)
    while is_symbol(source, current, 125) == 0 {
      if is_if_keyword(source, current) == 1 {
        let second_conditional_left = next_token(source, current.start + current.length)
        let second_conditional_open = next_token(source, second_conditional_left.start + second_conditional_left.length)
        let second_conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, second_conditional_open, 40) == 1 {
          second_conditional = parse_loop_conditional(source, current.start)
        } else {
          second_conditional = parse_loop_local_conditional(source, current.start)
        }
        count = count + count_let_tokens_in_range(source, current.start, second_conditional.position)
        current = next_token(source, second_conditional.position)
      } else {
        let second_target = current
        if is_let_keyword(source, current) == 1 {
          second_target = next_token(source, current.start + current.length)
          count = count + 1
        }
        let second_loop_equals = next_token(source, second_target.start + second_target.length)
        let second_loop_operand = next_token(source, second_loop_equals.start + second_loop_equals.length)
        current = expression_end(source, second_loop_operand)
      }
    }
    current = next_token(source, current.start + current.length)
  }
  while is_if_keyword(source, current) == 1 {
    let second_post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, second_post_conditional_if.position)
  }
  while is_let_keyword(source, current) == 1 {
    let third_trailing_name = next_token(source, current.start + current.length)
    let third_trailing_equals = next_token(source, third_trailing_name.start + third_trailing_name.length)
    let third_trailing_operand = next_token(source, third_trailing_equals.start + third_trailing_equals.length)
    current = expression_end(source, third_trailing_operand)
    count = count + 1
  }
  while is_if_keyword(source, current) == 1 {
    let third_post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, third_post_conditional_if.position)
  }
  return count
}

fn variable_index(source: bytes, function: function_definition, target: token) -> i32 {
  let parameter_index = returned_parameter_index(source, function, target)
  if parameter_index >= 0 {
    return parameter_index
  }
  let current = function_body_first_token(source, function)
  let index = function_parameter_count_of(source, function)
  while is_let_keyword(source, current) == 1 {
    let name = next_token(source, current.start + current.length)
    if same_token(source, name, target) == 1 {
      return index
    }
    let equals = next_token(source, name.start + name.length)
    let operand = next_token(source, equals.start + equals.length)
    current = next_token(source, operand.start + operand.length)
    if is_symbol(source, current, 46) == 1 {
      let field = next_token(source, current.start + current.length)
      current = next_token(source, field.start + field.length)
    }
    if is_symbol(source, current, 40) == 1 {
      let argument = next_token(source, current.start + current.length)
      let close_call = next_token(source, argument.start + argument.length)
      if is_symbol(source, argument, 41) == 1 {
        current = next_token(source, argument.start + argument.length)
      } else {
        while is_symbol(source, argument, 41) == 0 {
          let argument_separator = next_token(source, argument.start + argument.length)
          if is_symbol(source, argument_separator, 44) == 1 {
            argument = next_token(source, argument_separator.start + argument_separator.length)
          } else {
            argument = argument_separator
          }
        }
        current = next_token(source, argument.start + argument.length)
      }
    }
    while is_arithmetic_operator(source, current) == 1 {
      let next_operand = next_token(source, current.start + current.length)
      current = next_token(source, next_operand.start + next_operand.length)
    }
    index = index + 1
  }
  if is_while_keyword(source, current) == 1 {
    let post_conditional_left = next_token(source, current.start + current.length)
    let post_conditional_operator = next_token(source, post_conditional_left.start + post_conditional_left.length)
    let post_conditional_right = next_token(source, post_conditional_operator.start + post_conditional_operator.length)
    let post_conditional_open = expression_end(source, post_conditional_right)
    current = next_token(source, post_conditional_open.start + post_conditional_open.length)
    while is_symbol(source, current, 125) == 0 {
      if is_if_keyword(source, current) == 1 {
        let post_conditional_loop_left = next_token(source, current.start + current.length)
        let post_conditional_loop_open = next_token(source, post_conditional_loop_left.start + post_conditional_loop_left.length)
        let post_conditional_loop_statement = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, post_conditional_loop_open, 40) == 1 {
          post_conditional_loop_statement = parse_loop_conditional(source, current.start)
        } else {
          post_conditional_loop_statement = parse_loop_local_conditional(source, current.start)
        }
        let post_conditional_loop_offset = let_offset_in_range(source, current.start, post_conditional_loop_statement.position, target)
        if post_conditional_loop_offset >= 0 {
          return index + post_conditional_loop_offset
        }
        index = index + count_let_tokens_in_range(source, current.start, post_conditional_loop_statement.position)
        current = next_token(source, post_conditional_loop_statement.position)
      } else {
        let post_conditional_target_name = current
        if is_let_keyword(source, current) == 1 {
          post_conditional_target_name = next_token(source, current.start + current.length)
          if same_token(source, post_conditional_target_name, target) == 1 {
            return index
          }
          index = index + 1
        }
        let post_conditional_loop_equals = next_token(source, post_conditional_target_name.start + post_conditional_target_name.length)
        let post_conditional_loop_operand = next_token(source, post_conditional_loop_equals.start + post_conditional_loop_equals.length)
        current = expression_end(source, post_conditional_loop_operand)
      }
    }
    current = next_token(source, current.start + current.length)
  }
  while is_if_keyword(source, current) == 1 {
    let trailing_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, trailing_conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let trailing_name = next_token(source, current.start + current.length)
    if same_token(source, trailing_name, target) == 1 {
      return index
    }
    let trailing_equals = next_token(source, trailing_name.start + trailing_name.length)
    let trailing_operand = next_token(source, trailing_equals.start + trailing_equals.length)
    current = expression_end(source, trailing_operand)
    index = index + 1
  }
  while is_if_keyword(source, current) == 1 {
    let post_local_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_local_conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let post_conditional_name = next_token(source, current.start + current.length)
    if same_token(source, post_conditional_name, target) == 1 {
      return index
    }
    let post_conditional_equals = next_token(source, post_conditional_name.start + post_conditional_name.length)
    let post_conditional_operand = next_token(source, post_conditional_equals.start + post_conditional_equals.length)
    current = expression_end(source, post_conditional_operand)
    index = index + 1
  }
  if is_while_keyword(source, current) == 1 {
    let left = next_token(source, current.start + current.length)
    let operator = next_token(source, left.start + left.length)
    let right = next_token(source, operator.start + operator.length)
    let open = expression_end(source, right)
    current = next_token(source, open.start + open.length)
    while is_symbol(source, current, 125) == 0 {
      if is_if_keyword(source, current) == 1 {
        let conditional_left = next_token(source, current.start + current.length)
        let conditional_open = next_token(source, conditional_left.start + conditional_left.length)
        let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, conditional_open, 40) == 1 {
          conditional = parse_loop_conditional(source, current.start)
        } else {
          conditional = parse_loop_local_conditional(source, current.start)
        }
        let conditional_offset = let_offset_in_range(source, current.start, conditional.position, target)
        if conditional_offset >= 0 {
          return index + conditional_offset
        }
        index = index + count_let_tokens_in_range(source, current.start, conditional.position)
        current = next_token(source, conditional.position)
      } else {
        let target_name = current
        if is_let_keyword(source, current) == 1 {
          target_name = next_token(source, current.start + current.length)
          if same_token(source, target_name, target) == 1 {
            return index
          }
          index = index + 1
        }
        let loop_equals = next_token(source, target_name.start + target_name.length)
        let loop_operand = next_token(source, loop_equals.start + loop_equals.length)
        current = expression_end(source, loop_operand)
      }
    }
    current = next_token(source, current.start + current.length)
  }
  while is_if_keyword(source, current) == 1 {
    let post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_conditional_if.position)
  }
  while is_let_keyword(source, current) == 1 {
    let second_trailing_name = next_token(source, current.start + current.length)
    if same_token(source, second_trailing_name, target) == 1 {
      return index
    }
    let second_trailing_equals = next_token(source, second_trailing_name.start + second_trailing_name.length)
    let second_trailing_operand = next_token(source, second_trailing_equals.start + second_trailing_equals.length)
    current = expression_end(source, second_trailing_operand)
    index = index + 1
  }
  if is_while_keyword(source, current) == 1 {
    let second_left = next_token(source, current.start + current.length)
    let second_operator = next_token(source, second_left.start + second_left.length)
    let second_right = next_token(source, second_operator.start + second_operator.length)
    let second_open = expression_end(source, second_right)
    current = next_token(source, second_open.start + second_open.length)
    while is_symbol(source, current, 125) == 0 {
      if is_if_keyword(source, current) == 1 {
        let second_conditional_left = next_token(source, current.start + current.length)
        let second_conditional_open = next_token(source, second_conditional_left.start + second_conditional_left.length)
        let second_conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, second_conditional_open, 40) == 1 {
          second_conditional = parse_loop_conditional(source, current.start)
        } else {
          second_conditional = parse_loop_local_conditional(source, current.start)
        }
        let second_conditional_offset = let_offset_in_range(source, current.start, second_conditional.position, target)
        if second_conditional_offset >= 0 {
          return index + second_conditional_offset
        }
        index = index + count_let_tokens_in_range(source, current.start, second_conditional.position)
        current = next_token(source, second_conditional.position)
      } else {
        let second_target_name = current
        if is_let_keyword(source, current) == 1 {
          second_target_name = next_token(source, current.start + current.length)
          if same_token(source, second_target_name, target) == 1 {
            return index
          }
          index = index + 1
        }
        let second_loop_equals = next_token(source, second_target_name.start + second_target_name.length)
        let second_loop_operand = next_token(source, second_loop_equals.start + second_loop_equals.length)
        current = expression_end(source, second_loop_operand)
      }
    }
    current = next_token(source, current.start + current.length)
  }
  while is_if_keyword(source, current) == 1 {
    let second_post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, second_post_conditional_if.position)
  }
  while is_let_keyword(source, current) == 1 {
    let third_trailing_name = next_token(source, current.start + current.length)
    if same_token(source, third_trailing_name, target) == 1 {
      return index
    }
    let third_trailing_equals = next_token(source, third_trailing_name.start + third_trailing_name.length)
    let third_trailing_operand = next_token(source, third_trailing_equals.start + third_trailing_equals.length)
    current = expression_end(source, third_trailing_operand)
    index = index + 1
  }
  while is_if_keyword(source, current) == 1 {
    let third_post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, third_post_conditional_if.position)
  }
  return -1
}

fn struct_field_index(source: bytes, struct_name: token, field_name: token) -> i32 {
  let module_keyword = next_token(source, 0)
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  let position = module_name.start + module_name.length
  while position < byte_length(source) {
    let keyword = next_token(source, position)
    if is_import_keyword(source, keyword) == 1 {
      let imported = next_token(source, keyword.start + keyword.length)
      position = imported.start + imported.length
    } else {
      if is_struct_keyword(source, keyword) == 0 {
        return -1
      }
      let name = next_token(source, keyword.start + keyword.length)
      let open = next_token(source, name.start + name.length)
      let field = next_token(source, open.start + open.length)
      let index = 0
      while is_symbol(source, field, 125) == 0 {
        if same_token(source, name, struct_name) == 1 {
          if same_token(source, field, field_name) == 1 {
            return index
          }
        }
        let colon = next_token(source, field.start + field.length)
        let field_type = next_token(source, colon.start + colon.length)
        field = next_token(source, field_type.start + field_type.length)
        index = index + 1
      }
      position = field.start + field.length
    }
  }
  return -1
}

fn parameter_struct_field_index(source: bytes, function: function_definition, target: token, field: token) -> i32 {
  let function_name = token(1, function.name_start, function.name_length)
  let open = next_token(source, function_name.start + function_name.length)
  let parameter_name = next_token(source, open.start + open.length)
  while is_symbol(source, parameter_name, 41) == 0 {
    let colon = next_token(source, parameter_name.start + parameter_name.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    if same_token(source, parameter_name, target) == 1 {
      return struct_field_index(source, parameter_type, field)
    }
    parameter_name = next_token(source, parameter_type.start + parameter_type.length)
    if is_symbol(source, parameter_name, 44) == 1 {
      parameter_name = next_token(source, parameter_name.start + parameter_name.length)
    }
  }
  return -1
}

fn local_struct_field_index(source: bytes, table: [i32], function: function_definition, target: token, field: token) -> i32 {
  let parameter_field_index = parameter_struct_field_index(source, function, target, field)
  if parameter_field_index >= 0 {
    return parameter_field_index
  }
  let current = function_body_first_token(source, function)
  while is_let_keyword(source, current) == 1 {
    let local_name = next_token(source, current.start + current.length)
    let equals = next_token(source, local_name.start + local_name.length)
    let initializer = next_token(source, equals.start + equals.length)
    if same_token(source, local_name, target) == 1 {
      let called_index = function_index_in_table(source, table, initializer)
      if called_index < 0 {
        return -1
      }
      let called = function_at_index(source, called_index)
      let called_close = function_parameter_close(source, called)
      let called_minus = next_token(source, called_close.start + called_close.length)
      let called_arrow = next_token(source, called_minus.start + called_minus.length)
      let struct_name = next_token(source, called_arrow.start + called_arrow.length)
      return struct_field_index(source, struct_name, field)
    }
    current = expression_end(source, initializer)
  }
  return -1
}

fn struct_field_value_of(source: bytes, function: function_definition) -> i32 {
  let struct_name = returned_value_token(source, function)
  let open = next_token(source, struct_name.start + struct_name.length)
  let closing = next_token(source, open.start + open.length)
  while is_symbol(source, closing, 41) == 0 {
    closing = next_token(source, closing.start + closing.length)
  }
  let dot = next_token(source, closing.start + closing.length)
  let field_name = next_token(source, dot.start + dot.length)
  let field_index = struct_field_index(source, struct_name, field_name)
  let argument = next_token(source, open.start + open.length)
  let argument_index = 0
  while is_symbol(source, argument, 41) == 0 {
    if field_index == argument_index {
      return read_small_integer(source, argument)
    }
    let comma = next_token(source, argument.start + argument.length)
    if is_symbol(source, comma, 44) == 0 {
      return 0
    }
    argument = next_token(source, comma.start + comma.length)
    argument_index = argument_index + 1
  }
  return 0
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
      if is_struct_keyword(source, keyword) == 1 {
        let definition = parse_struct(source, keyword.start)
        if definition.status == 0 {
          return -1
        }
        position = definition.position
      } else {
        let function = parse_function(source, keyword.start)
        if function.status == 0 {
          return -1
        }
        count = count + 1
        position = function.position
      }
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
      if is_struct_keyword(source, keyword) == 1 {
        let definition = parse_struct(source, keyword.start)
        position = definition.position
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
          body_value = returned_parameter_index(source, function, returned_value_token(source, function))
        }
        if body_kind == 2 {
          body_value = -1
        }
        if body_kind == 3 {
          body_value = struct_field_value_of(source, function)
        }
        if body_kind == 5 {
          body_value = struct_field_count(source, returned_value_token(source, function))
        }
        if body_kind == 6 {
          body_value = local_count_of(source, function)
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

fn comparison_opcode(source: bytes, operator: token) -> i32 {
  let value = byte_at(source, operator.start)
  if value == 61 {
    return 70
  }
  if value == 33 {
    return 71
  }
  let next = next_token(source, operator.start + operator.length)
  if value == 60 {
    if is_symbol(source, next, 61) == 1 {
      return 76
    }
    return 72
  }
  if is_symbol(source, next, 61) == 1 {
    return 78
  }
  return 74
}

fn conditional_statement_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let left = next_token(source, statement.start + statement.length)
  let operator = next_token(source, left.start + left.length)
  let field_load_length = 0
  if is_symbol(source, operator, 46) == 1 {
    let left_field = next_token(source, operator.start + operator.length)
    let left_field_index = parameter_struct_field_index(source, function, left, left_field)
    field_load_length = 2 + u32_leb_length(left_field_index * 4)
    operator = next_token(source, left_field.start + left_field.length)
  }
  if is_symbol(source, operator, 40) == 1 {
    let condition_argument = next_token(source, operator.start + operator.length)
    while is_symbol(source, condition_argument, 41) == 0 {
      let condition_separator = next_token(source, condition_argument.start + condition_argument.length)
      if is_symbol(source, condition_separator, 46) == 1 {
        let condition_field = next_token(source, condition_separator.start + condition_separator.length)
        let condition_field_index = local_struct_field_index(source, table, function, condition_argument, condition_field)
        field_load_length = field_load_length + operand_length(source, function, condition_argument) + 2 + u32_leb_length(condition_field_index * 4)
        condition_separator = next_token(source, condition_field.start + condition_field.length)
      } else {
        field_load_length = field_load_length + operand_length(source, function, condition_argument)
      }
      while is_arithmetic_operator(source, condition_separator) == 1 {
        let call_arithmetic_operand = next_token(source, condition_separator.start + condition_separator.length)
        field_load_length = field_load_length + operand_length(source, function, call_arithmetic_operand) + 1
        condition_separator = next_token(source, call_arithmetic_operand.start + call_arithmetic_operand.length)
        if is_symbol(source, condition_separator, 46) == 1 {
          let call_arithmetic_field = next_token(source, condition_separator.start + condition_separator.length)
          let call_arithmetic_field_index = local_struct_field_index(source, table, function, call_arithmetic_operand, call_arithmetic_field)
          field_load_length = field_load_length + 2 + u32_leb_length(call_arithmetic_field_index * 4)
          condition_separator = next_token(source, call_arithmetic_field.start + call_arithmetic_field.length)
        }
      }
      if is_symbol(source, condition_separator, 44) == 1 {
        condition_argument = next_token(source, condition_separator.start + condition_separator.length)
      } else {
        condition_argument = condition_separator
      }
    }
    field_load_length = field_load_length + 1 + u32_leb_length(function_index_in_table(source, table, left))
    operator = next_token(source, condition_argument.start + condition_argument.length)
  }
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  let right_end = next_token(source, right.start + right.length)
  if is_symbol(source, right_end, 46) == 1 {
    let right_field = next_token(source, right_end.start + right_end.length)
    let right_field_index = parameter_struct_field_index(source, function, right, right_field)
    field_load_length = field_load_length + 2 + u32_leb_length(right_field_index * 4)
    right_end = next_token(source, right_field.start + right_field.length)
  }
  if is_symbol(source, right_end, 40) == 1 {
    let condition_call_argument = next_token(source, right_end.start + right_end.length)
    while is_symbol(source, condition_call_argument, 41) == 0 {
      let condition_call_separator = next_token(source, condition_call_argument.start + condition_call_argument.length)
      if is_symbol(source, condition_call_separator, 46) == 1 {
        let condition_call_field = next_token(source, condition_call_separator.start + condition_call_separator.length)
        let condition_call_field_index = local_struct_field_index(source, table, function, condition_call_argument, condition_call_field)
        field_load_length = field_load_length + operand_length(source, function, condition_call_argument) + 2 + u32_leb_length(condition_call_field_index * 4)
        condition_call_separator = next_token(source, condition_call_field.start + condition_call_field.length)
      } else {
        field_load_length = field_load_length + operand_length(source, function, condition_call_argument)
      }
      while is_arithmetic_operator(source, condition_call_separator) == 1 {
        let right_call_arithmetic_operand = next_token(source, condition_call_separator.start + condition_call_separator.length)
        field_load_length = field_load_length + operand_length(source, function, right_call_arithmetic_operand) + 1
        condition_call_separator = next_token(source, right_call_arithmetic_operand.start + right_call_arithmetic_operand.length)
        if is_symbol(source, condition_call_separator, 46) == 1 {
          let right_call_arithmetic_field = next_token(source, condition_call_separator.start + condition_call_separator.length)
          let right_call_arithmetic_field_index = local_struct_field_index(source, table, function, right_call_arithmetic_operand, right_call_arithmetic_field)
          field_load_length = field_load_length + 2 + u32_leb_length(right_call_arithmetic_field_index * 4)
          condition_call_separator = next_token(source, right_call_arithmetic_field.start + right_call_arithmetic_field.length)
        }
      }
      if is_symbol(source, condition_call_separator, 44) == 1 {
        condition_call_argument = next_token(source, condition_call_separator.start + condition_call_separator.length)
      } else {
        condition_call_argument = condition_call_separator
      }
    }
    field_load_length = field_load_length + 1 + u32_leb_length(function_index_in_table(source, table, right))
    right_end = next_token(source, condition_call_argument.start + condition_call_argument.length)
  }
  while is_arithmetic_operator(source, right_end) == 1 {
    let right_arithmetic_operand = next_token(source, right_end.start + right_end.length)
    field_load_length = field_load_length + operand_length(source, function, right_arithmetic_operand) + 1
    right_end = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
    if is_symbol(source, right_end, 46) == 1 {
      let right_arithmetic_field = next_token(source, right_end.start + right_end.length)
      let right_arithmetic_field_index = local_struct_field_index(source, table, function, right_arithmetic_operand, right_arithmetic_field)
      field_load_length = field_load_length + 2 + u32_leb_length(right_arithmetic_field_index * 4)
      right_end = next_token(source, right_arithmetic_field.start + right_arithmetic_field.length)
    }
  }
  let open = right_end
  let current = next_token(source, open.start + open.length)
  let left_index = returned_parameter_index(source, function, left)
  let length = 6 + u32_leb_length(left_index) + field_load_length + i32_leb_length(read_small_integer(source, right))
  while is_symbol(source, current, 125) == 0 {
    if is_if_keyword(source, current) == 1 {
      length = length + conditional_statement_length(source, table, function, current)
      let nested = parse_conditional_statement(source, current.start, left)
      current = next_token(source, nested.position)
    } else {
      let returned_value = next_token(source, current.start + current.length)
      length = length + 2 + i32_leb_length(read_small_integer(source, returned_value))
      current = next_token(source, returned_value.start + returned_value.length)
    }
  }
  return length
}

fn conditional_body_length(source: bytes, table: [i32], function: function_definition) -> i32 {
  let current = function_body_first_token(source, function)
  let length = 1
  while is_if_keyword(source, current) == 1 {
    let conditional_left = next_token(source, current.start + current.length)
    let conditional_operator = next_token(source, conditional_left.start + conditional_left.length)
    let statement = function_definition(0, 0, 0, 0, current.start, 0, 0)
    if is_symbol(source, conditional_operator, 40) == 1 {
      length = length + local_return_conditional_length(source, table, function, current)
      statement = parse_local_return_conditional(source, current.start)
    } else {
      if is_symbol(source, conditional_operator, 46) == 1 {
        length = length + local_return_conditional_length(source, table, function, current)
        statement = parse_local_return_conditional(source, current.start)
      } else {
        length = length + conditional_statement_length(source, table, function, current)
        let parameter = next_token(source, current.start + current.length)
        statement = parse_conditional_statement(source, current.start, parameter)
      }
    }
    current = next_token(source, statement.position)
  }
  let final_value = next_token(source, current.start + current.length)
  return length + 2 + i32_leb_length(read_small_integer(source, final_value))
}

fn write_conditional_statement(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let position = index
  let left = next_token(source, statement.start + statement.length)
  let operator = next_token(source, left.start + left.length)
  let left_field_index = -1
  if is_symbol(source, operator, 46) == 1 {
    let left_field = next_token(source, operator.start + operator.length)
    left_field_index = parameter_struct_field_index(source, function, left, left_field)
    operator = next_token(source, left_field.start + left_field.length)
  }
  if is_symbol(source, operator, 40) == 1 {
    let condition_argument = next_token(source, operator.start + operator.length)
    while is_symbol(source, condition_argument, 41) == 0 {
      position = write_operand(buffer, position, source, function, condition_argument)
      let condition_separator = next_token(source, condition_argument.start + condition_argument.length)
      if is_symbol(source, condition_separator, 46) == 1 {
        let condition_field = next_token(source, condition_separator.start + condition_separator.length)
        let condition_field_index = local_struct_field_index(source, table, function, condition_argument, condition_field)
        byte_set(buffer, position, 40)
        byte_set(buffer, position + 1, 2)
        position = position + 2
        let condition_field_offset_written = write_u32_leb(buffer, position, condition_field_index * 4)
        position = position + u32_leb_length(condition_field_index * 4)
        condition_separator = next_token(source, condition_field.start + condition_field.length)
      }
      while is_arithmetic_operator(source, condition_separator) == 1 {
        let condition_arithmetic = condition_separator
        let condition_arithmetic_operand = next_token(source, condition_arithmetic.start + condition_arithmetic.length)
        position = write_operand(buffer, position, source, function, condition_arithmetic_operand)
        condition_separator = next_token(source, condition_arithmetic_operand.start + condition_arithmetic_operand.length)
        if is_symbol(source, condition_separator, 46) == 1 {
          let condition_arithmetic_field = next_token(source, condition_separator.start + condition_separator.length)
          let condition_arithmetic_field_index = local_struct_field_index(source, table, function, condition_arithmetic_operand, condition_arithmetic_field)
          byte_set(buffer, position, 40)
          byte_set(buffer, position + 1, 2)
          position = position + 2
          let condition_arithmetic_field_offset_written = write_u32_leb(buffer, position, condition_arithmetic_field_index * 4)
          position = position + u32_leb_length(condition_arithmetic_field_index * 4)
          condition_separator = next_token(source, condition_arithmetic_field.start + condition_arithmetic_field.length)
        }
        byte_set(buffer, position, arithmetic_opcode(source, condition_arithmetic))
        position = position + 1
      }
      if is_symbol(source, condition_separator, 44) == 1 {
        condition_argument = next_token(source, condition_separator.start + condition_separator.length)
      } else {
        condition_argument = condition_separator
      }
    }
    byte_set(buffer, position, 16)
    position = position + 1
    let condition_called_index = function_index_in_table(source, table, left)
    let condition_call_written = write_u32_leb(buffer, position, condition_called_index)
    position = position + u32_leb_length(condition_called_index)
    operator = next_token(source, condition_argument.start + condition_argument.length)
  }
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  let open = next_token(source, right.start + right.length)
  position = write_operand(buffer, position, source, function, left)
  if left_field_index >= 0 {
    byte_set(buffer, position, 40)
    byte_set(buffer, position + 1, 2)
    position = position + 2
    let left_field_offset_written = write_u32_leb(buffer, position, left_field_index * 4)
    position = position + u32_leb_length(left_field_index * 4)
  }
  byte_set(buffer, position, 65)
  position = position + 1
  if right.kind == 2 {
    let right_value = read_small_integer(source, right)
    let right_written = write_i32_leb(buffer, position, right_value)
    position = position + i32_leb_length(right_value)
  } else {
    position = write_operand(buffer, position, source, function, right)
  }
  byte_set(right_written, position, comparison_opcode(source, operator))
  byte_set(right_written, position + 1, 4)
  byte_set(right_written, position + 2, 64)
  position = position + 3
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 125) == 0 {
    if is_if_keyword(source, current) == 1 {
      position = write_conditional_statement(buffer, position, source, table, function, current)
      let nested = parse_conditional_statement(source, current.start, left)
      current = next_token(source, nested.position)
    } else {
      let returned_value = next_token(source, current.start + current.length)
      let return_value = read_small_integer(source, returned_value)
      byte_set(buffer, position, 65)
      position = position + 1
      let return_written = write_i32_leb(buffer, position, return_value)
      position = position + i32_leb_length(return_value)
      byte_set(return_written, position, 15)
      position = position + 1
      current = next_token(source, returned_value.start + returned_value.length)
    }
  }
  byte_set(buffer, position, 11)
  return position + 1
}

fn write_conditional_body(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition) -> bytes {
  let position = index
  byte_set(buffer, position, 0)
  position = position + 1
  let current = function_body_first_token(source, function)
  while is_if_keyword(source, current) == 1 {
    let conditional_left = next_token(source, current.start + current.length)
    let conditional_operator = next_token(source, conditional_left.start + conditional_left.length)
    let statement = function_definition(0, 0, 0, 0, current.start, 0, 0)
    if is_symbol(source, conditional_operator, 40) == 1 {
      position = write_local_return_conditional(buffer, position, source, table, function, current)
      statement = parse_local_return_conditional(source, current.start)
    } else {
      if is_symbol(source, conditional_operator, 46) == 1 {
        position = write_local_return_conditional(buffer, position, source, table, function, current)
        statement = parse_local_return_conditional(source, current.start)
      } else {
        position = write_conditional_statement(buffer, position, source, table, function, current)
        let parameter = next_token(source, current.start + current.length)
        statement = parse_conditional_statement(source, current.start, parameter)
      }
    }
    current = next_token(source, statement.position)
  }
  let final_value = next_token(source, current.start + current.length)
  let final_integer = read_small_integer(source, final_value)
  byte_set(buffer, position, 65)
  position = position + 1
  let final_written = write_i32_leb(buffer, position, final_integer)
  position = position + i32_leb_length(final_integer)
  byte_set(final_written, position, 11)
  return buffer
}

fn struct_constructor_body_length(source: bytes, function: function_definition) -> i32 {
  let constructor = returned_value_token(source, function)
  let open = next_token(source, constructor.start + constructor.length)
  let argument = next_token(source, open.start + open.length)
  let offset = 0
  let length = 4
  while is_symbol(source, argument, 41) == 0 {
    length = length + 5 + i32_leb_length(read_small_integer(source, argument)) + u32_leb_length(offset)
    let separator = next_token(source, argument.start + argument.length)
    if is_symbol(source, separator, 44) == 1 {
      argument = next_token(source, separator.start + separator.length)
    } else {
      argument = separator
    }
    offset = offset + 4
  }
  return length
}

fn write_struct_constructor_body(buffer: bytes, index: i32, source: bytes, function: function_definition) -> bytes {
  let position = index
  byte_set(buffer, position, 0)
  position = position + 1
  let constructor = returned_value_token(source, function)
  let open = next_token(source, constructor.start + constructor.length)
  let argument = next_token(source, open.start + open.length)
  let offset = 0
  while is_symbol(source, argument, 41) == 0 {
    byte_set(buffer, position, 65)
    byte_set(buffer, position + 1, 0)
    byte_set(buffer, position + 2, 65)
    position = position + 3
    let value = read_small_integer(source, argument)
    let value_written = write_i32_leb(buffer, position, value)
    position = position + i32_leb_length(value)
    byte_set(value_written, position, 54)
    byte_set(value_written, position + 1, 2)
    position = position + 2
    let offset_written = write_u32_leb(buffer, position, offset)
    position = position + u32_leb_length(offset)
    let separator = next_token(source, argument.start + argument.length)
    if is_symbol(source, separator, 44) == 1 {
      argument = next_token(source, separator.start + separator.length)
    } else {
      argument = separator
    }
    offset = offset + 4
  }
  byte_set(buffer, position, 65)
  byte_set(buffer, position + 1, 0)
  byte_set(buffer, position + 2, 11)
  return buffer
}

fn arithmetic_opcode(source: bytes, operator: token) -> i32 {
  let value = byte_at(source, operator.start)
  if value == 43 {
    return 106
  }
  if value == 45 {
    return 107
  }
  if value == 42 {
    return 108
  }
  return 109
}

fn operand_length(source: bytes, function: function_definition, operand: token) -> i32 {
  if operand.kind == 2 {
    return 1 + i32_leb_length(read_small_integer(source, operand))
  }
  return 1 + u32_leb_length(variable_index(source, function, operand))
}

fn while_statement_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let left = next_token(source, statement.start + statement.length)
  let operator = next_token(source, left.start + left.length)
  let length = 12
  if is_symbol(source, operator, 40) == 1 {
    let condition_argument = next_token(source, operator.start + operator.length)
    while is_symbol(source, condition_argument, 41) == 0 {
      let condition_separator = next_token(source, condition_argument.start + condition_argument.length)
      if is_symbol(source, condition_separator, 46) == 1 {
        let condition_field = next_token(source, condition_separator.start + condition_separator.length)
        let condition_field_index = local_struct_field_index(source, table, function, condition_argument, condition_field)
        length = length + operand_length(source, function, condition_argument) + 2 + u32_leb_length(condition_field_index * 4)
        condition_separator = next_token(source, condition_field.start + condition_field.length)
      } else {
        length = length + operand_length(source, function, condition_argument)
      }
      while is_arithmetic_operator(source, condition_separator) == 1 {
        let condition_arithmetic_operand = next_token(source, condition_separator.start + condition_separator.length)
        length = length + operand_length(source, function, condition_arithmetic_operand) + 1
        condition_separator = next_token(source, condition_arithmetic_operand.start + condition_arithmetic_operand.length)
        if is_symbol(source, condition_separator, 46) == 1 {
          let condition_arithmetic_field = next_token(source, condition_separator.start + condition_separator.length)
          let condition_arithmetic_field_index = local_struct_field_index(source, table, function, condition_arithmetic_operand, condition_arithmetic_field)
          length = length + 2 + u32_leb_length(condition_arithmetic_field_index * 4)
          condition_separator = next_token(source, condition_arithmetic_field.start + condition_arithmetic_field.length)
        }
      }
      if is_symbol(source, condition_separator, 44) == 1 {
        condition_argument = next_token(source, condition_separator.start + condition_separator.length)
      } else {
        condition_argument = condition_separator
      }
    }
    length = length + 1 + u32_leb_length(function_index_in_table(source, table, left))
    operator = next_token(source, condition_argument.start + condition_argument.length)
  } else {
    length = length + operand_length(source, function, left)
  }
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  length = length + operand_length(source, function, right)
  let right_end = next_token(source, right.start + right.length)
  if is_symbol(source, right_end, 46) == 1 {
    let right_field = next_token(source, right_end.start + right_end.length)
    let right_field_index = local_struct_field_index(source, table, function, right, right_field)
    length = length + 2 + u32_leb_length(right_field_index * 4)
    right_end = next_token(source, right_field.start + right_field.length)
  }
  if is_symbol(source, right_end, 40) == 1 {
    let condition_call_argument = next_token(source, right_end.start + right_end.length)
    while is_symbol(source, condition_call_argument, 41) == 0 {
      length = length + operand_length(source, function, condition_call_argument)
      let condition_call_separator = next_token(source, condition_call_argument.start + condition_call_argument.length)
      if is_symbol(source, condition_call_separator, 44) == 1 {
        condition_call_argument = next_token(source, condition_call_separator.start + condition_call_separator.length)
      } else {
        condition_call_argument = condition_call_separator
      }
    }
    length = length + 1 + u32_leb_length(function_index_in_table(source, table, right))
    right_end = next_token(source, condition_call_argument.start + condition_call_argument.length)
  }
  while is_arithmetic_operator(source, right_end) == 1 {
    let right_arithmetic_operand = next_token(source, right_end.start + right_end.length)
    length = length + operand_length(source, function, right_arithmetic_operand) + 1
    right_end = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
    if is_symbol(source, right_end, 46) == 1 {
      let right_arithmetic_field = next_token(source, right_end.start + right_end.length)
      let right_arithmetic_field_index = local_struct_field_index(source, table, function, right_arithmetic_operand, right_arithmetic_field)
      length = length + 2 + u32_leb_length(right_arithmetic_field_index * 4)
      right_end = next_token(source, right_arithmetic_field.start + right_arithmetic_field.length)
    }
  }
  let open = right_end
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 125) == 0 {
    if is_while_keyword(source, current) == 1 {
      length = length + while_statement_length(source, table, function, current)
      let nested_while = parse_while_statement(source, current.start)
      current = next_token(source, nested_while.position)
    } else {
    if is_if_keyword(source, current) == 1 {
      let conditional_left = next_token(source, current.start + current.length)
      let conditional_open = next_token(source, conditional_left.start + conditional_left.length)
      let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
      if is_symbol(source, conditional_open, 40) == 1 {
        length = length + loop_conditional_length(source, table, function, current)
        conditional = parse_loop_conditional(source, current.start)
      } else {
        length = length + loop_local_conditional_length(source, table, function, current)
        conditional = parse_loop_local_conditional(source, current.start)
      }
      current = next_token(source, conditional.position)
    } else {
      let target = current
      if is_let_keyword(source, current) == 1 {
        target = next_token(source, current.start + current.length)
      }
      let equals = next_token(source, target.start + target.length)
      let operand = next_token(source, equals.start + equals.length)
      let after_operand = next_token(source, operand.start + operand.length)
      if is_symbol(source, after_operand, 40) == 1 {
        let argument = next_token(source, after_operand.start + after_operand.length)
        while is_symbol(source, argument, 41) == 0 {
          let separator = next_token(source, argument.start + argument.length)
          if is_symbol(source, separator, 46) == 1 {
            let argument_field = next_token(source, separator.start + separator.length)
            let argument_field_index = local_struct_field_index(source, table, function, argument, argument_field)
            length = length + operand_length(source, function, argument) + 2 + u32_leb_length(argument_field_index * 4)
            separator = next_token(source, argument_field.start + argument_field.length)
          } else {
            length = length + operand_length(source, function, argument)
          }
          while is_arithmetic_operator(source, separator) == 1 {
            let argument_arithmetic_operand = next_token(source, separator.start + separator.length)
            length = length + operand_length(source, function, argument_arithmetic_operand) + 1
            separator = next_token(source, argument_arithmetic_operand.start + argument_arithmetic_operand.length)
            if is_symbol(source, separator, 46) == 1 {
              let argument_arithmetic_field = next_token(source, separator.start + separator.length)
              let argument_arithmetic_field_index = local_struct_field_index(source, table, function, argument_arithmetic_operand, argument_arithmetic_field)
              length = length + 2 + u32_leb_length(argument_arithmetic_field_index * 4)
              separator = next_token(source, argument_arithmetic_field.start + argument_arithmetic_field.length)
            }
          }
          if is_symbol(source, separator, 44) == 1 {
            argument = next_token(source, separator.start + separator.length)
          } else {
            argument = separator
          }
        }
        length = length + 1 + u32_leb_length(function_index_in_table(source, table, operand))
        after_operand = next_token(source, argument.start + argument.length)
      } else {
        length = length + operand_length(source, function, operand)
        while is_arithmetic_operator(source, after_operand) == 1 {
          let next_operand = next_token(source, after_operand.start + after_operand.length)
          after_operand = next_token(source, next_operand.start + next_operand.length)
          if is_symbol(source, after_operand, 40) == 1 {
            let arithmetic_argument = next_token(source, after_operand.start + after_operand.length)
            while is_symbol(source, arithmetic_argument, 41) == 0 {
              length = length + operand_length(source, function, arithmetic_argument)
              let arithmetic_separator = next_token(source, arithmetic_argument.start + arithmetic_argument.length)
              if is_symbol(source, arithmetic_separator, 44) == 1 {
                arithmetic_argument = next_token(source, arithmetic_separator.start + arithmetic_separator.length)
              } else {
                arithmetic_argument = arithmetic_separator
              }
            }
            length = length + 1 + u32_leb_length(function_index_in_table(source, table, next_operand))
            after_operand = next_token(source, arithmetic_argument.start + arithmetic_argument.length)
          } else {
            length = length + operand_length(source, function, next_operand)
          }
          length = length + 1
        }
      }
      length = length + 1 + u32_leb_length(variable_index(source, function, target))
      current = after_operand
    }
    }
  }
  return length
}

fn loop_conditional_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let called = next_token(source, statement.start + statement.length)
  let call_open = next_token(source, called.start + called.length)
  let argument = next_token(source, call_open.start + call_open.length)
  let length = 5 + u32_leb_length(function_index_in_table(source, table, called))
  while is_symbol(source, argument, 41) == 0 {
    let separator = next_token(source, argument.start + argument.length)
    if is_symbol(source, separator, 46) == 1 {
      let argument_field = next_token(source, separator.start + separator.length)
      let argument_field_index = local_struct_field_index(source, table, function, argument, argument_field)
      length = length + operand_length(source, function, argument) + 2 + u32_leb_length(argument_field_index * 4)
      separator = next_token(source, argument_field.start + argument_field.length)
    } else {
      if is_symbol(source, separator, 40) == 1 {
        let nested_argument_operand = next_token(source, separator.start + separator.length)
        while is_symbol(source, nested_argument_operand, 41) == 0 {
          length = length + operand_length(source, function, nested_argument_operand)
          let nested_argument_separator = next_token(source, nested_argument_operand.start + nested_argument_operand.length)
          if is_symbol(source, nested_argument_separator, 44) == 1 {
            nested_argument_operand = next_token(source, nested_argument_separator.start + nested_argument_separator.length)
          } else {
            nested_argument_operand = nested_argument_separator
          }
        }
        length = length + 1 + u32_leb_length(function_index_in_table(source, table, argument))
        separator = next_token(source, nested_argument_operand.start + nested_argument_operand.length)
      } else {
        length = length + operand_length(source, function, argument)
      }
    }
    while is_arithmetic_operator(source, separator) == 1 {
      let arithmetic_operand = next_token(source, separator.start + separator.length)
      length = length + operand_length(source, function, arithmetic_operand) + 1
      separator = next_token(source, arithmetic_operand.start + arithmetic_operand.length)
    }
    if is_symbol(source, separator, 44) == 1 {
      argument = next_token(source, separator.start + separator.length)
    } else {
      argument = separator
    }
  }
  let operator = next_token(source, argument.start + argument.length)
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  let open = next_token(source, right.start + right.length)
  if is_symbol(source, open, 40) == 1 {
    let right_argument = next_token(source, open.start + open.length)
    while is_symbol(source, right_argument, 41) == 0 {
      let right_separator = next_token(source, right_argument.start + right_argument.length)
      if is_symbol(source, right_separator, 46) == 1 {
        let right_argument_field = next_token(source, right_separator.start + right_separator.length)
        let right_argument_field_index = local_struct_field_index(source, table, function, right_argument, right_argument_field)
        length = length + operand_length(source, function, right_argument) + 2 + u32_leb_length(right_argument_field_index * 4)
        right_separator = next_token(source, right_argument_field.start + right_argument_field.length)
      } else {
        length = length + operand_length(source, function, right_argument)
      }
      while is_arithmetic_operator(source, right_separator) == 1 {
        let right_arithmetic_operand = next_token(source, right_separator.start + right_separator.length)
        length = length + operand_length(source, function, right_arithmetic_operand) + 1
        right_separator = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
      }
      if is_symbol(source, right_separator, 44) == 1 {
        right_argument = next_token(source, right_separator.start + right_separator.length)
      } else {
        right_argument = right_separator
      }
    }
    length = length + 1 + u32_leb_length(function_index_in_table(source, table, right))
    open = next_token(source, right_argument.start + right_argument.length)
  } else {
    length = length + operand_length(source, function, right)
  }
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 125) == 0 {
    if is_break_keyword(source, current) == 1 {
      length = length + 2
      current = next_token(source, current.start + current.length)
    } else {
      if is_if_keyword(source, current) == 1 {
        let nested_left = next_token(source, current.start + current.length)
        let nested_open = next_token(source, nested_left.start + nested_left.length)
        let nested = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, nested_open, 40) == 1 {
          length = length + loop_conditional_length(source, table, function, current)
          nested = parse_loop_conditional(source, current.start)
        } else {
          length = length + loop_local_conditional_length(source, table, function, current)
          nested = parse_loop_local_conditional(source, current.start)
        }
        current = next_token(source, nested.position)
      } else {
        if is_while_keyword(source, current) == 1 {
          length = length + while_statement_length(source, table, function, current)
          let nested_while = parse_while_statement(source, current.start)
          current = next_token(source, nested_while.position)
        } else {
          if is_return_keyword(source, current) == 1 {
            let return_value = next_token(source, current.start + current.length)
            let return_end = next_token(source, return_value.start + return_value.length)
            if is_symbol(source, return_end, 40) == 1 {
              let return_argument = next_token(source, return_end.start + return_end.length)
              while is_symbol(source, return_argument, 41) == 0 {
                length = length + operand_length(source, function, return_argument)
                let return_separator = next_token(source, return_argument.start + return_argument.length)
                if is_symbol(source, return_separator, 44) == 1 {
                  return_argument = next_token(source, return_separator.start + return_separator.length)
                } else {
                  return_argument = return_separator
                }
              }
              length = length + 1 + u32_leb_length(function_index_in_table(source, table, return_value)) + 1
              current = next_token(source, return_argument.start + return_argument.length)
            } else {
              length = length + operand_length(source, function, return_value) + 1
              current = return_end
            }
          } else {
            let equals = next_token(source, current.start + current.length)
            let operand = next_token(source, equals.start + equals.length)
            length = length + operand_length(source, function, operand)
            let after_operand = next_token(source, operand.start + operand.length)
            while is_arithmetic_operator(source, after_operand) == 1 {
              let next_operand = next_token(source, after_operand.start + after_operand.length)
              length = length + operand_length(source, function, next_operand) + 1
              after_operand = next_token(source, next_operand.start + next_operand.length)
            }
            length = length + 1 + u32_leb_length(variable_index(source, function, current))
            current = after_operand
          }
        }
      }
    }
  }
  let after_then = next_token(source, current.start + current.length)
  if is_else_keyword(source, after_then) == 1 {
    length = length + 1
    let else_open = next_token(source, after_then.start + after_then.length)
    let else_statement = next_token(source, else_open.start + else_open.length)
    while is_symbol(source, else_statement, 125) == 0 {
      if is_break_keyword(source, else_statement) == 1 {
        length = length + 2
        else_statement = next_token(source, else_statement.start + else_statement.length)
      } else {
        if is_if_keyword(source, else_statement) == 1 {
          let else_nested_left = next_token(source, else_statement.start + else_statement.length)
          let else_nested_open = next_token(source, else_nested_left.start + else_nested_left.length)
          let else_nested = function_definition(0, 0, 0, 0, else_statement.start, 0, 0)
          if is_symbol(source, else_nested_open, 40) == 1 {
            length = length + loop_conditional_length(source, table, function, else_statement)
            else_nested = parse_loop_conditional(source, else_statement.start)
          } else {
            length = length + loop_local_conditional_length(source, table, function, else_statement)
            else_nested = parse_loop_local_conditional(source, else_statement.start)
          }
          else_statement = next_token(source, else_nested.position)
        } else {
          if is_while_keyword(source, else_statement) == 1 {
            length = length + while_statement_length(source, table, function, else_statement)
            let else_nested_while = parse_while_statement(source, else_statement.start)
            else_statement = next_token(source, else_nested_while.position)
          } else {
            if is_return_keyword(source, else_statement) == 1 {
              let else_return_value = next_token(source, else_statement.start + else_statement.length)
              let else_return_end = next_token(source, else_return_value.start + else_return_value.length)
              if is_symbol(source, else_return_end, 40) == 1 {
                let else_return_argument = next_token(source, else_return_end.start + else_return_end.length)
                while is_symbol(source, else_return_argument, 41) == 0 {
                  length = length + operand_length(source, function, else_return_argument)
                  let else_return_separator = next_token(source, else_return_argument.start + else_return_argument.length)
                  if is_symbol(source, else_return_separator, 44) == 1 {
                    else_return_argument = next_token(source, else_return_separator.start + else_return_separator.length)
                  } else {
                    else_return_argument = else_return_separator
                  }
                }
                length = length + 1 + u32_leb_length(function_index_in_table(source, table, else_return_value)) + 1
                else_statement = next_token(source, else_return_argument.start + else_return_argument.length)
              } else {
                length = length + operand_length(source, function, else_return_value) + 1
                else_statement = else_return_end
              }
            } else {
            let else_equals = next_token(source, else_statement.start + else_statement.length)
            let else_operand = next_token(source, else_equals.start + else_equals.length)
            length = length + operand_length(source, function, else_operand)
            let else_after_operand = next_token(source, else_operand.start + else_operand.length)
            while is_arithmetic_operator(source, else_after_operand) == 1 {
              let else_next_operand = next_token(source, else_after_operand.start + else_after_operand.length)
              length = length + operand_length(source, function, else_next_operand) + 1
              else_after_operand = next_token(source, else_next_operand.start + else_next_operand.length)
            }
            length = length + 1 + u32_leb_length(variable_index(source, function, else_statement))
            else_statement = else_after_operand
          }
          }
        }
      }
    }
  }
  return length
}

fn loop_local_conditional_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let left = next_token(source, statement.start + statement.length)
  let left_operator = next_token(source, left.start + left.length)
  let operator = left_operator
  let right = next_token(source, operator.start + operator.length)
  let length = operand_length(source, function, left) + 4
  if is_symbol(source, left_operator, 46) == 1 {
    let left_field = next_token(source, left_operator.start + left_operator.length)
    let left_field_index = local_struct_field_index(source, table, function, left, left_field)
    length = length + 2 + u32_leb_length(left_field_index * 4)
    operator = next_token(source, left_field.start + left_field.length)
    right = next_token(source, operator.start + operator.length)
  }
  if is_arithmetic_operator(source, left_operator) == 1 {
    length = length + operand_length(source, function, right) + 1
    operator = next_token(source, right.start + right.length)
    right = next_token(source, operator.start + operator.length)
  }
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  length = length + operand_length(source, function, right)
  let right_end = next_token(source, right.start + right.length)
  if is_symbol(source, right_end, 46) == 1 {
    let right_field = next_token(source, right_end.start + right_end.length)
    let right_field_index = local_struct_field_index(source, table, function, right, right_field)
    length = length + 2 + u32_leb_length(right_field_index * 4)
    right_end = next_token(source, right_field.start + right_field.length)
  }
  let open = right_end
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 125) == 0 {
    if is_break_keyword(source, current) == 1 {
      length = length + 2
      current = next_token(source, current.start + current.length)
    } else {
      if is_if_keyword(source, current) == 1 {
        let nested_left = next_token(source, current.start + current.length)
        let nested_open = next_token(source, nested_left.start + nested_left.length)
        let nested = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, nested_open, 40) == 1 {
          length = length + loop_conditional_length(source, table, function, current)
          nested = parse_loop_conditional(source, current.start)
        } else {
          length = length + loop_local_conditional_length(source, table, function, current)
          nested = parse_loop_local_conditional(source, current.start)
        }
        current = next_token(source, nested.position)
      } else {
        if is_while_keyword(source, current) == 1 {
          length = length + while_statement_length(source, table, function, current)
          let nested_while = parse_while_statement(source, current.start)
          current = next_token(source, nested_while.position)
        } else {
          if is_return_keyword(source, current) == 1 {
            let return_value = next_token(source, current.start + current.length)
            let return_end = next_token(source, return_value.start + return_value.length)
            if is_symbol(source, return_end, 40) == 1 {
              let return_argument = next_token(source, return_end.start + return_end.length)
              while is_symbol(source, return_argument, 41) == 0 {
                length = length + operand_length(source, function, return_argument)
                let return_separator = next_token(source, return_argument.start + return_argument.length)
                if is_symbol(source, return_separator, 44) == 1 {
                  return_argument = next_token(source, return_separator.start + return_separator.length)
                } else {
                  return_argument = return_separator
                }
              }
              length = length + 1 + u32_leb_length(function_index_in_table(source, table, return_value)) + 1
              current = next_token(source, return_argument.start + return_argument.length)
            } else {
              length = length + operand_length(source, function, return_value) + 1
              current = return_end
            }
          } else {
            let equals = next_token(source, current.start + current.length)
            let operand = next_token(source, equals.start + equals.length)
            length = length + operand_length(source, function, operand)
            let after_operand = next_token(source, operand.start + operand.length)
            while is_arithmetic_operator(source, after_operand) == 1 {
              let next_operand = next_token(source, after_operand.start + after_operand.length)
              length = length + operand_length(source, function, next_operand) + 1
              after_operand = next_token(source, next_operand.start + next_operand.length)
            }
            length = length + 1 + u32_leb_length(variable_index(source, function, current))
            current = after_operand
          }
        }
      }
    }
  }
  let after_then = next_token(source, current.start + current.length)
  if is_else_keyword(source, after_then) == 1 {
    length = length + 1
    let else_open = next_token(source, after_then.start + after_then.length)
    let else_statement = next_token(source, else_open.start + else_open.length)
    while is_symbol(source, else_statement, 125) == 0 {
      if is_break_keyword(source, else_statement) == 1 {
        length = length + 2
        else_statement = next_token(source, else_statement.start + else_statement.length)
      } else {
        if is_if_keyword(source, else_statement) == 1 {
          let else_nested_left = next_token(source, else_statement.start + else_statement.length)
          let else_nested_open = next_token(source, else_nested_left.start + else_nested_left.length)
          let else_nested = function_definition(0, 0, 0, 0, else_statement.start, 0, 0)
          if is_symbol(source, else_nested_open, 40) == 1 {
            length = length + loop_conditional_length(source, table, function, else_statement)
            else_nested = parse_loop_conditional(source, else_statement.start)
          } else {
            length = length + loop_local_conditional_length(source, table, function, else_statement)
            else_nested = parse_loop_local_conditional(source, else_statement.start)
          }
          else_statement = next_token(source, else_nested.position)
        } else {
          if is_while_keyword(source, else_statement) == 1 {
            length = length + while_statement_length(source, table, function, else_statement)
            let else_nested_while = parse_while_statement(source, else_statement.start)
            else_statement = next_token(source, else_nested_while.position)
          } else {
            if is_return_keyword(source, else_statement) == 1 {
              let else_return_value = next_token(source, else_statement.start + else_statement.length)
              let else_return_end = next_token(source, else_return_value.start + else_return_value.length)
              if is_symbol(source, else_return_end, 40) == 1 {
                let else_return_argument = next_token(source, else_return_end.start + else_return_end.length)
                while is_symbol(source, else_return_argument, 41) == 0 {
                  length = length + operand_length(source, function, else_return_argument)
                  let else_return_separator = next_token(source, else_return_argument.start + else_return_argument.length)
                  if is_symbol(source, else_return_separator, 44) == 1 {
                    else_return_argument = next_token(source, else_return_separator.start + else_return_separator.length)
                  } else {
                    else_return_argument = else_return_separator
                  }
                }
                length = length + 1 + u32_leb_length(function_index_in_table(source, table, else_return_value)) + 1
                else_statement = next_token(source, else_return_argument.start + else_return_argument.length)
              } else {
                length = length + operand_length(source, function, else_return_value) + 1
                else_statement = else_return_end
              }
            } else {
            let else_equals = next_token(source, else_statement.start + else_statement.length)
            let else_operand = next_token(source, else_equals.start + else_equals.length)
            length = length + operand_length(source, function, else_operand)
            let else_after_operand = next_token(source, else_operand.start + else_operand.length)
            while is_arithmetic_operator(source, else_after_operand) == 1 {
              let else_next_operand = next_token(source, else_after_operand.start + else_after_operand.length)
              length = length + operand_length(source, function, else_next_operand) + 1
              else_after_operand = next_token(source, else_next_operand.start + else_next_operand.length)
            }
            length = length + 1 + u32_leb_length(variable_index(source, function, else_statement))
            else_statement = else_after_operand
          }
          }
        }
      }
    }
  }
  return length
}

fn local_return_conditional_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let left = next_token(source, statement.start + statement.length)
  let operator = next_token(source, left.start + left.length)
  let length = 5
  if is_symbol(source, operator, 46) == 1 {
    let left_field = next_token(source, operator.start + operator.length)
    let left_field_index = local_struct_field_index(source, table, function, left, left_field)
    length = length + operand_length(source, function, left) + 2 + u32_leb_length(left_field_index * 4)
    operator = next_token(source, left_field.start + left_field.length)
  } else {
    if is_symbol(source, operator, 40) == 1 {
      let condition_argument = next_token(source, operator.start + operator.length)
      while is_symbol(source, condition_argument, 41) == 0 {
        let condition_separator = next_token(source, condition_argument.start + condition_argument.length)
        if is_symbol(source, condition_separator, 46) == 1 {
          let condition_field = next_token(source, condition_separator.start + condition_separator.length)
          let condition_field_index = local_struct_field_index(source, table, function, condition_argument, condition_field)
          length = length + operand_length(source, function, condition_argument) + 2 + u32_leb_length(condition_field_index * 4)
          condition_separator = next_token(source, condition_field.start + condition_field.length)
          while is_arithmetic_operator(source, condition_separator) == 1 {
            let condition_arithmetic_operand = next_token(source, condition_separator.start + condition_separator.length)
            length = length + operand_length(source, function, condition_arithmetic_operand) + 1
            condition_separator = next_token(source, condition_arithmetic_operand.start + condition_arithmetic_operand.length)
          }
        } else {
          if is_symbol(source, condition_separator, 40) == 1 {
            let nested_condition_argument = next_token(source, condition_separator.start + condition_separator.length)
            while is_symbol(source, nested_condition_argument, 41) == 0 {
              length = length + operand_length(source, function, nested_condition_argument)
              let nested_condition_separator = next_token(source, nested_condition_argument.start + nested_condition_argument.length)
              if is_symbol(source, nested_condition_separator, 44) == 1 {
                nested_condition_argument = next_token(source, nested_condition_separator.start + nested_condition_separator.length)
              } else {
                nested_condition_argument = nested_condition_separator
              }
            }
            length = length + 1 + u32_leb_length(function_index_in_table(source, table, condition_argument))
            condition_separator = next_token(source, nested_condition_argument.start + nested_condition_argument.length)
          } else {
            length = length + operand_length(source, function, condition_argument)
          }
        }
        if is_symbol(source, condition_separator, 44) == 1 {
          condition_argument = next_token(source, condition_separator.start + condition_separator.length)
        } else {
          condition_argument = condition_separator
        }
      }
      length = length + 1 + u32_leb_length(function_index_in_table(source, table, left))
      operator = next_token(source, condition_argument.start + condition_argument.length)
    } else {
      length = length + operand_length(source, function, left)
    }
  }
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  length = length + operand_length(source, function, right)
  let right_end = next_token(source, right.start + right.length)
  if is_symbol(source, right_end, 46) == 1 {
    let right_field = next_token(source, right_end.start + right_end.length)
    let right_field_index = local_struct_field_index(source, table, function, right, right_field)
    length = length + 2 + u32_leb_length(right_field_index * 4)
    right_end = next_token(source, right_field.start + right_field.length)
  }
  let open = right_end
  let body_statement = next_token(source, open.start + open.length)
  while is_return_keyword(source, body_statement) == 0 {
    if is_symbol(source, body_statement, 125) == 1 {
      return length - 1
    }
    if is_if_keyword(source, body_statement) == 1 {
      length = length + local_return_conditional_length(source, table, function, body_statement)
      let body_conditional = parse_local_return_conditional(source, body_statement.start)
      body_statement = next_token(source, body_conditional.position)
    } else {
      if is_while_keyword(source, body_statement) == 1 {
      length = length + while_statement_length(source, table, function, body_statement)
      let body_while = parse_while_statement(source, body_statement.start)
      body_statement = next_token(source, body_while.position)
      } else {
        let body_equals = next_token(source, body_statement.start + body_statement.length)
        let body_operand = next_token(source, body_equals.start + body_equals.length)
        length = length + operand_length(source, function, body_operand)
        let body_after_operand = next_token(source, body_operand.start + body_operand.length)
        while is_arithmetic_operator(source, body_after_operand) == 1 {
          let body_next_operand = next_token(source, body_after_operand.start + body_after_operand.length)
          length = length + operand_length(source, function, body_next_operand) + 1
          body_after_operand = next_token(source, body_next_operand.start + body_next_operand.length)
        }
        length = length + 1 + u32_leb_length(variable_index(source, function, body_statement))
        body_statement = body_after_operand
      }
    }
  }
  let returned = body_statement
  let value = next_token(source, returned.start + returned.length)
  let after_value = next_token(source, value.start + value.length)
  if is_symbol(source, after_value, 40) == 1 {
    let argument = next_token(source, after_value.start + after_value.length)
    let constructor_offset = 0
    while is_symbol(source, argument, 41) == 0 {
      let separator = next_token(source, argument.start + argument.length)
      if is_symbol(source, separator, 46) == 1 {
        let argument_field = next_token(source, separator.start + separator.length)
        let argument_field_index = local_struct_field_index(source, table, function, argument, argument_field)
        if struct_field_count(source, value) >= 0 {
          length = length + 4 + operand_length(source, function, argument) + 2 + u32_leb_length(argument_field_index * 4) + u32_leb_length(constructor_offset)
        } else {
          length = length + operand_length(source, function, argument) + 2 + u32_leb_length(argument_field_index * 4)
        }
        separator = next_token(source, argument_field.start + argument_field.length)
      } else {
        if struct_field_count(source, value) >= 0 {
          length = length + 4 + operand_length(source, function, argument) + u32_leb_length(constructor_offset)
        } else {
          length = length + operand_length(source, function, argument)
        }
      }
      while is_arithmetic_operator(source, separator) == 1 {
        let return_arithmetic_operand = next_token(source, separator.start + separator.length)
        length = length + operand_length(source, function, return_arithmetic_operand) + 1
        let return_after_operand = next_token(source, return_arithmetic_operand.start + return_arithmetic_operand.length)
        if is_symbol(source, return_after_operand, 46) == 1 {
          let return_arithmetic_field = next_token(source, return_after_operand.start + return_after_operand.length)
          let return_arithmetic_field_index = local_struct_field_index(source, table, function, return_arithmetic_operand, return_arithmetic_field)
          length = length + 2 + u32_leb_length(return_arithmetic_field_index * 4)
          separator = next_token(source, return_arithmetic_field.start + return_arithmetic_field.length)
        } else {
          separator = return_after_operand
        }
      }
      if is_symbol(source, separator, 44) == 1 {
        argument = next_token(source, separator.start + separator.length)
      } else {
        argument = separator
      }
      constructor_offset = constructor_offset + 4
    }
    if struct_field_count(source, value) < 0 {
      length = length + 1 + u32_leb_length(function_index_in_table(source, table, value))
    } else {
      length = length + 2
    }
    return length
  }
  return length + operand_length(source, function, value)
}

fn local_body_length(source: bytes, table: [i32], function: function_definition) -> i32 {
  let current = function_body_first_token(source, function)
  let local_index = function_parameter_count_of(source, function)
  let local_count = local_count_of(source, function)
  let length = 1
  if local_count > 0 {
    length = 2 + u32_leb_length(local_count)
  }
  while is_let_keyword(source, current) == 1 {
    let name = next_token(source, current.start + current.length)
    let equals = next_token(source, name.start + name.length)
    let operand = next_token(source, equals.start + equals.length)
    current = next_token(source, operand.start + operand.length)
    if is_symbol(source, current, 46) == 1 {
      let field = next_token(source, current.start + current.length)
      let field_index = local_struct_field_index(source, table, function, operand, field)
      length = length + operand_length(source, function, operand) + 2 + u32_leb_length(field_index * 4)
      current = next_token(source, field.start + field.length)
    } else {
      if is_symbol(source, current, 40) == 1 {
        let argument = next_token(source, current.start + current.length)
        while is_symbol(source, argument, 41) == 0 {
          let argument_separator = next_token(source, argument.start + argument.length)
          if is_symbol(source, argument_separator, 46) == 1 {
            let argument_field = next_token(source, argument_separator.start + argument_separator.length)
            let argument_field_index = local_struct_field_index(source, table, function, argument, argument_field)
            length = length + operand_length(source, function, argument) + 2 + u32_leb_length(argument_field_index * 4)
            argument_separator = next_token(source, argument_field.start + argument_field.length)
          } else {
            length = length + operand_length(source, function, argument)
          }
          while is_arithmetic_operator(source, argument_separator) == 1 {
            let argument_arithmetic_operand = next_token(source, argument_separator.start + argument_separator.length)
            length = length + operand_length(source, function, argument_arithmetic_operand) + 1
            argument_separator = next_token(source, argument_arithmetic_operand.start + argument_arithmetic_operand.length)
            if is_symbol(source, argument_separator, 46) == 1 {
              let argument_arithmetic_field = next_token(source, argument_separator.start + argument_separator.length)
              let argument_arithmetic_field_index = local_struct_field_index(source, table, function, argument_arithmetic_operand, argument_arithmetic_field)
              length = length + 2 + u32_leb_length(argument_arithmetic_field_index * 4)
              argument_separator = next_token(source, argument_arithmetic_field.start + argument_arithmetic_field.length)
            }
          }
          if is_symbol(source, argument_separator, 44) == 1 {
            argument = next_token(source, argument_separator.start + argument_separator.length)
          } else {
            argument = argument_separator
          }
        }
        length = length + 1 + u32_leb_length(function_index_in_table(source, table, operand))
        current = next_token(source, argument.start + argument.length)
      } else {
        length = length + operand_length(source, function, operand)
      }
    }
    while is_arithmetic_operator(source, current) == 1 {
      let next_operand = next_token(source, current.start + current.length)
      length = length + operand_length(source, function, next_operand) + 1
      current = next_token(source, next_operand.start + next_operand.length)
      if is_symbol(source, current, 46) == 1 {
        let next_field = next_token(source, current.start + current.length)
        let next_field_index = local_struct_field_index(source, table, function, next_operand, next_field)
        length = length + 2 + u32_leb_length(next_field_index * 4)
        current = next_token(source, next_field.start + next_field.length)
      }
    }
    length = length + 1 + u32_leb_length(local_index)
    local_index = local_index + 1
  }
  if is_while_keyword(source, current) == 1 {
    length = length + while_statement_length(source, table, function, current)
    let statement = parse_while_statement(source, current.start)
    current = next_token(source, statement.position)
  }
  while is_if_keyword(source, current) == 1 {
    let conditional_left = next_token(source, current.start + current.length)
    let conditional_operator = next_token(source, conditional_left.start + conditional_left.length)
    let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
    if is_symbol(source, conditional_operator, 40) == 1 {
      let call_conditional_open = next_token(source, conditional_operator.start + conditional_operator.length)
      let call_conditional_first = next_token(source, call_conditional_open.start + call_conditional_open.length)
      if is_return_keyword(source, call_conditional_first) == 1 {
        length = length + local_return_conditional_length(source, table, function, current)
        conditional = parse_local_return_conditional(source, current.start)
      } else {
        length = length + loop_conditional_length(source, table, function, current)
        conditional = parse_loop_conditional(source, current.start)
      }
    } else {
      length = length + local_return_conditional_length(source, table, function, current)
      conditional = parse_local_return_conditional(source, current.start)
    }
    current = next_token(source, conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let trailing_name = next_token(source, current.start + current.length)
    let trailing_equals = next_token(source, trailing_name.start + trailing_name.length)
    let trailing_operand = next_token(source, trailing_equals.start + trailing_equals.length)
    current = next_token(source, trailing_operand.start + trailing_operand.length)
    if is_symbol(source, current, 46) == 1 {
      let trailing_field = next_token(source, current.start + current.length)
      let trailing_field_index = local_struct_field_index(source, table, function, trailing_operand, trailing_field)
      length = length + operand_length(source, function, trailing_operand) + 2 + u32_leb_length(trailing_field_index * 4)
      current = next_token(source, trailing_field.start + trailing_field.length)
    } else {
      if is_symbol(source, current, 40) == 1 {
        let trailing_argument = next_token(source, current.start + current.length)
        while is_symbol(source, trailing_argument, 41) == 0 {
          let trailing_separator = next_token(source, trailing_argument.start + trailing_argument.length)
          if is_symbol(source, trailing_separator, 46) == 1 {
            let trailing_argument_field = next_token(source, trailing_separator.start + trailing_separator.length)
            let trailing_argument_field_index = local_struct_field_index(source, table, function, trailing_argument, trailing_argument_field)
            length = length + operand_length(source, function, trailing_argument) + 2 + u32_leb_length(trailing_argument_field_index * 4)
            trailing_separator = next_token(source, trailing_argument_field.start + trailing_argument_field.length)
          } else {
            length = length + operand_length(source, function, trailing_argument)
          }
          while is_arithmetic_operator(source, trailing_separator) == 1 {
            let trailing_argument_operand = next_token(source, trailing_separator.start + trailing_separator.length)
            length = length + operand_length(source, function, trailing_argument_operand) + 1
            trailing_separator = next_token(source, trailing_argument_operand.start + trailing_argument_operand.length)
            if is_symbol(source, trailing_separator, 46) == 1 {
              let trailing_argument_next_field = next_token(source, trailing_separator.start + trailing_separator.length)
              let trailing_argument_next_field_index = local_struct_field_index(source, table, function, trailing_argument_operand, trailing_argument_next_field)
              length = length + 2 + u32_leb_length(trailing_argument_next_field_index * 4)
              trailing_separator = next_token(source, trailing_argument_next_field.start + trailing_argument_next_field.length)
            }
          }
          if is_symbol(source, trailing_separator, 44) == 1 {
            trailing_argument = next_token(source, trailing_separator.start + trailing_separator.length)
          } else {
            trailing_argument = trailing_separator
          }
        }
        length = length + 1 + u32_leb_length(function_index_in_table(source, table, trailing_operand))
        current = next_token(source, trailing_argument.start + trailing_argument.length)
      } else {
        length = length + operand_length(source, function, trailing_operand)
      }
    }
    while is_arithmetic_operator(source, current) == 1 {
      let trailing_next_operand = next_token(source, current.start + current.length)
      length = length + operand_length(source, function, trailing_next_operand) + 1
      current = next_token(source, trailing_next_operand.start + trailing_next_operand.length)
    }
    length = length + 1 + u32_leb_length(local_index)
    local_index = local_index + 1
  }
  if is_while_keyword(source, current) == 1 {
    length = length + while_statement_length(source, table, function, current)
    let trailing_while = parse_while_statement(source, current.start)
    current = next_token(source, trailing_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    length = length + local_return_conditional_length(source, table, function, current)
    let post_local_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_local_conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let post_conditional_name = next_token(source, current.start + current.length)
    let post_conditional_equals = next_token(source, post_conditional_name.start + post_conditional_name.length)
    let post_conditional_operand = next_token(source, post_conditional_equals.start + post_conditional_equals.length)
    current = next_token(source, post_conditional_operand.start + post_conditional_operand.length)
    if is_symbol(source, current, 46) == 1 {
      let post_conditional_field = next_token(source, current.start + current.length)
      let post_conditional_field_index = local_struct_field_index(source, table, function, post_conditional_operand, post_conditional_field)
      length = length + operand_length(source, function, post_conditional_operand) + 2 + u32_leb_length(post_conditional_field_index * 4)
      current = next_token(source, post_conditional_field.start + post_conditional_field.length)
    } else {
      if is_symbol(source, current, 40) == 1 {
        let post_conditional_argument = next_token(source, current.start + current.length)
        while is_symbol(source, post_conditional_argument, 41) == 0 {
          let post_conditional_separator = next_token(source, post_conditional_argument.start + post_conditional_argument.length)
          if is_symbol(source, post_conditional_separator, 46) == 1 {
            let post_conditional_argument_field = next_token(source, post_conditional_separator.start + post_conditional_separator.length)
            let post_conditional_argument_field_index = local_struct_field_index(source, table, function, post_conditional_argument, post_conditional_argument_field)
            length = length + operand_length(source, function, post_conditional_argument) + 2 + u32_leb_length(post_conditional_argument_field_index * 4)
            post_conditional_separator = next_token(source, post_conditional_argument_field.start + post_conditional_argument_field.length)
          } else {
            length = length + operand_length(source, function, post_conditional_argument)
          }
          while is_arithmetic_operator(source, post_conditional_separator) == 1 {
            let post_conditional_argument_operand = next_token(source, post_conditional_separator.start + post_conditional_separator.length)
            length = length + operand_length(source, function, post_conditional_argument_operand) + 1
            post_conditional_separator = next_token(source, post_conditional_argument_operand.start + post_conditional_argument_operand.length)
            if is_symbol(source, post_conditional_separator, 46) == 1 {
              let post_conditional_argument_next_field = next_token(source, post_conditional_separator.start + post_conditional_separator.length)
              let post_conditional_argument_next_field_index = local_struct_field_index(source, table, function, post_conditional_argument_operand, post_conditional_argument_next_field)
              length = length + 2 + u32_leb_length(post_conditional_argument_next_field_index * 4)
              post_conditional_separator = next_token(source, post_conditional_argument_next_field.start + post_conditional_argument_next_field.length)
            }
          }
          if is_symbol(source, post_conditional_separator, 44) == 1 {
            post_conditional_argument = next_token(source, post_conditional_separator.start + post_conditional_separator.length)
          } else {
            post_conditional_argument = post_conditional_separator
          }
        }
        length = length + 1 + u32_leb_length(function_index_in_table(source, table, post_conditional_operand))
        current = next_token(source, post_conditional_argument.start + post_conditional_argument.length)
      } else {
        length = length + operand_length(source, function, post_conditional_operand)
      }
    }
    while is_arithmetic_operator(source, current) == 1 {
      let post_conditional_next_operand = next_token(source, current.start + current.length)
      length = length + operand_length(source, function, post_conditional_next_operand) + 1
      current = next_token(source, post_conditional_next_operand.start + post_conditional_next_operand.length)
    }
    length = length + 1 + u32_leb_length(local_index)
    local_index = local_index + 1
  }
  if is_while_keyword(source, current) == 1 {
    length = length + while_statement_length(source, table, function, current)
    let post_conditional_while = parse_while_statement(source, current.start)
    current = next_token(source, post_conditional_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    length = length + local_return_conditional_length(source, table, function, current)
    let post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_conditional_if.position)
  }
  while is_let_keyword(source, current) == 1 {
    let continuation_name = next_token(source, current.start + current.length)
    let continuation_equals = next_token(source, continuation_name.start + continuation_name.length)
    let continuation_operand = next_token(source, continuation_equals.start + continuation_equals.length)
    current = next_token(source, continuation_operand.start + continuation_operand.length)
    if is_symbol(source, current, 46) == 1 {
      let continuation_field = next_token(source, current.start + current.length)
      let continuation_field_index = local_struct_field_index(source, table, function, continuation_operand, continuation_field)
      length = length + operand_length(source, function, continuation_operand) + 2 + u32_leb_length(continuation_field_index * 4)
      current = next_token(source, continuation_field.start + continuation_field.length)
    } else {
      if is_symbol(source, current, 40) == 1 {
        let continuation_argument = next_token(source, current.start + current.length)
        while is_symbol(source, continuation_argument, 41) == 0 {
          let continuation_separator = next_token(source, continuation_argument.start + continuation_argument.length)
          if is_symbol(source, continuation_separator, 46) == 1 {
            let continuation_argument_field = next_token(source, continuation_separator.start + continuation_separator.length)
            let continuation_argument_field_index = local_struct_field_index(source, table, function, continuation_argument, continuation_argument_field)
            length = length + operand_length(source, function, continuation_argument) + 2 + u32_leb_length(continuation_argument_field_index * 4)
            continuation_separator = next_token(source, continuation_argument_field.start + continuation_argument_field.length)
          } else {
            length = length + operand_length(source, function, continuation_argument)
          }
          while is_arithmetic_operator(source, continuation_separator) == 1 {
            let continuation_argument_operand = next_token(source, continuation_separator.start + continuation_separator.length)
            length = length + operand_length(source, function, continuation_argument_operand) + 1
            continuation_separator = next_token(source, continuation_argument_operand.start + continuation_argument_operand.length)
            if is_symbol(source, continuation_separator, 46) == 1 {
              let continuation_argument_next_field = next_token(source, continuation_separator.start + continuation_separator.length)
              let continuation_argument_next_field_index = local_struct_field_index(source, table, function, continuation_argument_operand, continuation_argument_next_field)
              length = length + 2 + u32_leb_length(continuation_argument_next_field_index * 4)
              continuation_separator = next_token(source, continuation_argument_next_field.start + continuation_argument_next_field.length)
            }
          }
          if is_symbol(source, continuation_separator, 44) == 1 {
            continuation_argument = next_token(source, continuation_separator.start + continuation_separator.length)
          } else {
            continuation_argument = continuation_separator
          }
        }
        length = length + 1 + u32_leb_length(function_index_in_table(source, table, continuation_operand))
        current = next_token(source, continuation_argument.start + continuation_argument.length)
      } else {
        length = length + operand_length(source, function, continuation_operand)
      }
    }
    while is_arithmetic_operator(source, current) == 1 {
      let continuation_next_operand = next_token(source, current.start + current.length)
      length = length + operand_length(source, function, continuation_next_operand) + 1
      current = next_token(source, continuation_next_operand.start + continuation_next_operand.length)
    }
    length = length + 1 + u32_leb_length(local_index)
    local_index = local_index + 1
  }
  if is_while_keyword(source, current) == 1 {
    length = length + while_statement_length(source, table, function, current)
    let continuation_while = parse_while_statement(source, current.start)
    current = next_token(source, continuation_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    length = length + local_return_conditional_length(source, table, function, current)
    let continuation_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, continuation_conditional.position)
  }
  if is_while_keyword(source, current) == 1 {
    length = length + while_statement_length(source, table, function, current)
    let second_continuation_while = parse_while_statement(source, current.start)
    current = next_token(source, second_continuation_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    length = length + local_return_conditional_length(source, table, function, current)
    let second_continuation_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, second_continuation_conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let third_continuation_name = next_token(source, current.start + current.length)
    let third_continuation_equals = next_token(source, third_continuation_name.start + third_continuation_name.length)
    let third_continuation_operand = next_token(source, third_continuation_equals.start + third_continuation_equals.length)
    length = length + operand_length(source, function, third_continuation_operand)
    current = next_token(source, third_continuation_operand.start + third_continuation_operand.length)
    if is_symbol(source, current, 40) == 1 {
      let third_continuation_argument = next_token(source, current.start + current.length)
      while is_symbol(source, third_continuation_argument, 41) == 0 {
        length = length + operand_length(source, function, third_continuation_argument)
        let third_continuation_separator = next_token(source, third_continuation_argument.start + third_continuation_argument.length)
        if is_symbol(source, third_continuation_separator, 46) == 1 {
          let third_continuation_argument_field = next_token(source, third_continuation_separator.start + third_continuation_separator.length)
          let third_continuation_argument_field_index = local_struct_field_index(source, table, function, third_continuation_argument, third_continuation_argument_field)
          length = length + 2 + u32_leb_length(third_continuation_argument_field_index * 4)
          third_continuation_separator = next_token(source, third_continuation_argument_field.start + third_continuation_argument_field.length)
        }
        while is_arithmetic_operator(source, third_continuation_separator) == 1 {
          let third_continuation_argument_operand = next_token(source, third_continuation_separator.start + third_continuation_separator.length)
          length = length + operand_length(source, function, third_continuation_argument_operand) + 1
          third_continuation_separator = next_token(source, third_continuation_argument_operand.start + third_continuation_argument_operand.length)
          if is_symbol(source, third_continuation_separator, 46) == 1 {
            let third_continuation_argument_next_field = next_token(source, third_continuation_separator.start + third_continuation_separator.length)
            let third_continuation_argument_next_field_index = local_struct_field_index(source, table, function, third_continuation_argument_operand, third_continuation_argument_next_field)
            length = length + 2 + u32_leb_length(third_continuation_argument_next_field_index * 4)
            third_continuation_separator = next_token(source, third_continuation_argument_next_field.start + third_continuation_argument_next_field.length)
          }
        }
        if is_symbol(source, third_continuation_separator, 44) == 1 {
          third_continuation_argument = next_token(source, third_continuation_separator.start + third_continuation_separator.length)
        } else {
          third_continuation_argument = third_continuation_separator
        }
      }
      length = length + 1 + u32_leb_length(function_index_in_table(source, table, third_continuation_operand))
      current = next_token(source, third_continuation_argument.start + third_continuation_argument.length)
    }
    while is_arithmetic_operator(source, current) == 1 {
      let third_continuation_next_operand = next_token(source, current.start + current.length)
      length = length + operand_length(source, function, third_continuation_next_operand) + 1
      current = next_token(source, third_continuation_next_operand.start + third_continuation_next_operand.length)
    }
    length = length + 1 + u32_leb_length(local_index)
    local_index = local_index + 1
  }
  if is_while_keyword(source, current) == 1 {
    length = length + while_statement_length(source, table, function, current)
    let third_continuation_while = parse_while_statement(source, current.start)
    current = next_token(source, third_continuation_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    length = length + local_return_conditional_length(source, table, function, current)
    let third_continuation_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, third_continuation_conditional.position)
  }
  let returned = next_token(source, current.start + current.length)
  let return_open = next_token(source, returned.start + returned.length)
  if is_symbol(source, return_open, 40) == 1 {
    let constructor_argument = next_token(source, return_open.start + return_open.length)
    let constructor_offset = 0
    while is_symbol(source, constructor_argument, 41) == 0 {
      length = length + 4 + operand_length(source, function, constructor_argument) + u32_leb_length(constructor_offset)
      let constructor_separator = next_token(source, constructor_argument.start + constructor_argument.length)
      while is_arithmetic_operator(source, constructor_separator) == 1 {
        let constructor_arithmetic_operand = next_token(source, constructor_separator.start + constructor_separator.length)
        length = length + operand_length(source, function, constructor_arithmetic_operand) + 1
        constructor_separator = next_token(source, constructor_arithmetic_operand.start + constructor_arithmetic_operand.length)
      }
      if is_symbol(source, constructor_separator, 44) == 1 {
        constructor_argument = next_token(source, constructor_separator.start + constructor_separator.length)
      } else {
        constructor_argument = constructor_separator
      }
      constructor_offset = constructor_offset + 4
    }
    return length + 3
  }
  length = length + operand_length(source, function, returned)
  let return_current = return_open
  if is_symbol(source, return_current, 46) == 1 {
    let return_field = next_token(source, return_current.start + return_current.length)
    let return_field_index = local_struct_field_index(source, table, function, returned, return_field)
    length = length + 2 + u32_leb_length(return_field_index * 4)
    return_current = next_token(source, return_field.start + return_field.length)
  }
  while is_arithmetic_operator(source, return_current) == 1 {
    let return_operand = next_token(source, return_current.start + return_current.length)
    length = length + operand_length(source, function, return_operand) + 1
    let return_after_operand = next_token(source, return_operand.start + return_operand.length)
    if is_symbol(source, return_after_operand, 46) == 1 {
      let return_operand_field = next_token(source, return_after_operand.start + return_after_operand.length)
      let return_operand_field_index = local_struct_field_index(source, table, function, return_operand, return_operand_field)
      length = length + 2 + u32_leb_length(return_operand_field_index * 4)
      return_after_operand = next_token(source, return_operand_field.start + return_operand_field.length)
    }
    return_current = return_after_operand
  }
  return length + 1
}

fn write_operand(buffer: bytes, index: i32, source: bytes, function: function_definition, operand: token) -> i32 {
  if operand.kind == 2 {
    byte_set(buffer, index, 65)
    let value = read_small_integer(source, operand)
    let integer_written = write_i32_leb(buffer, index + 1, value)
    return index + 1 + i32_leb_length(value)
  }
  byte_set(buffer, index, 32)
  let variable = variable_index(source, function, operand)
  let variable_written = write_u32_leb(buffer, index + 1, variable)
  return index + 1 + u32_leb_length(variable)
}

fn write_while_statement(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let position = index
  let left = next_token(source, statement.start + statement.length)
  let operator = next_token(source, left.start + left.length)
  byte_set(buffer, position, 2)
  byte_set(buffer, position + 1, 64)
  byte_set(buffer, position + 2, 3)
  byte_set(buffer, position + 3, 64)
  position = position + 4
  if is_symbol(source, operator, 40) == 1 {
    let condition_argument = next_token(source, operator.start + operator.length)
    while is_symbol(source, condition_argument, 41) == 0 {
      let condition_separator = next_token(source, condition_argument.start + condition_argument.length)
      if is_symbol(source, condition_separator, 46) == 1 {
        position = write_operand(buffer, position, source, function, condition_argument)
        let condition_field = next_token(source, condition_separator.start + condition_separator.length)
        let condition_field_index = local_struct_field_index(source, table, function, condition_argument, condition_field)
        byte_set(buffer, position, 40)
        byte_set(buffer, position + 1, 2)
        position = position + 2
        let condition_field_offset_written = write_u32_leb(buffer, position, condition_field_index * 4)
        position = position + u32_leb_length(condition_field_index * 4)
        condition_separator = next_token(source, condition_field.start + condition_field.length)
      } else {
        position = write_operand(buffer, position, source, function, condition_argument)
      }
      while is_arithmetic_operator(source, condition_separator) == 1 {
        let condition_arithmetic = condition_separator
        let condition_arithmetic_operand = next_token(source, condition_arithmetic.start + condition_arithmetic.length)
        position = write_operand(buffer, position, source, function, condition_arithmetic_operand)
        condition_separator = next_token(source, condition_arithmetic_operand.start + condition_arithmetic_operand.length)
        if is_symbol(source, condition_separator, 46) == 1 {
          let condition_arithmetic_field = next_token(source, condition_separator.start + condition_separator.length)
          let condition_arithmetic_field_index = local_struct_field_index(source, table, function, condition_arithmetic_operand, condition_arithmetic_field)
          byte_set(buffer, position, 40)
          byte_set(buffer, position + 1, 2)
          position = position + 2
          let condition_arithmetic_field_offset_written = write_u32_leb(buffer, position, condition_arithmetic_field_index * 4)
          position = position + u32_leb_length(condition_arithmetic_field_index * 4)
          condition_separator = next_token(source, condition_arithmetic_field.start + condition_arithmetic_field.length)
        }
        byte_set(buffer, position, arithmetic_opcode(source, condition_arithmetic))
        position = position + 1
      }
      if is_symbol(source, condition_separator, 44) == 1 {
        condition_argument = next_token(source, condition_separator.start + condition_separator.length)
      } else {
        condition_argument = condition_separator
      }
    }
    byte_set(buffer, position, 16)
    position = position + 1
    let condition_called_index = function_index_in_table(source, table, left)
    let condition_call_written = write_u32_leb(buffer, position, condition_called_index)
    position = position + u32_leb_length(condition_called_index)
    operator = next_token(source, condition_argument.start + condition_argument.length)
  } else {
    position = write_operand(buffer, position, source, function, left)
  }
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  let right_end = next_token(source, right.start + right.length)
  position = write_operand(buffer, position, source, function, right)
  if is_symbol(source, right_end, 46) == 1 {
    let right_field = next_token(source, right_end.start + right_end.length)
    let right_field_index = local_struct_field_index(source, table, function, right, right_field)
    byte_set(buffer, position, 40)
    byte_set(buffer, position + 1, 2)
    position = position + 2
    let right_field_offset_written = write_u32_leb(buffer, position, right_field_index * 4)
    position = position + u32_leb_length(right_field_index * 4)
    right_end = next_token(source, right_field.start + right_field.length)
  }
  if is_symbol(source, right_end, 40) == 1 {
    let condition_call_argument = next_token(source, right_end.start + right_end.length)
    while is_symbol(source, condition_call_argument, 41) == 0 {
      position = write_operand(buffer, position, source, function, condition_call_argument)
      let condition_call_separator = next_token(source, condition_call_argument.start + condition_call_argument.length)
      if is_symbol(source, condition_call_separator, 44) == 1 {
        condition_call_argument = next_token(source, condition_call_separator.start + condition_call_separator.length)
      } else {
        condition_call_argument = condition_call_separator
      }
    }
    byte_set(buffer, position, 16)
    position = position + 1
    let right_condition_called_index = function_index_in_table(source, table, right)
    let right_condition_call_written = write_u32_leb(buffer, position, right_condition_called_index)
    position = position + u32_leb_length(right_condition_called_index)
    right_end = next_token(source, condition_call_argument.start + condition_call_argument.length)
  }
  while is_arithmetic_operator(source, right_end) == 1 {
    let right_arithmetic = right_end
    let right_arithmetic_operand = next_token(source, right_arithmetic.start + right_arithmetic.length)
    position = write_operand(buffer, position, source, function, right_arithmetic_operand)
    right_end = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
    if is_symbol(source, right_end, 46) == 1 {
      let right_arithmetic_field = next_token(source, right_end.start + right_end.length)
      let right_arithmetic_field_index = local_struct_field_index(source, table, function, right_arithmetic_operand, right_arithmetic_field)
      byte_set(buffer, position, 40)
      byte_set(buffer, position + 1, 2)
      position = position + 2
      let right_arithmetic_field_offset_written = write_u32_leb(buffer, position, right_arithmetic_field_index * 4)
      position = position + u32_leb_length(right_arithmetic_field_index * 4)
      right_end = next_token(source, right_arithmetic_field.start + right_arithmetic_field.length)
    }
    byte_set(buffer, position, arithmetic_opcode(source, right_arithmetic))
    position = position + 1
  }
  byte_set(buffer, position, comparison_opcode(source, operator))
  byte_set(buffer, position + 1, 69)
  byte_set(buffer, position + 2, 13)
  byte_set(buffer, position + 3, 1)
  position = position + 4
  let open = right_end
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 125) == 0 {
    if is_while_keyword(source, current) == 1 {
      position = write_while_statement(buffer, position, source, table, function, current)
      let nested_while = parse_while_statement(source, current.start)
      current = next_token(source, nested_while.position)
    } else {
    if is_if_keyword(source, current) == 1 {
      let conditional_left = next_token(source, current.start + current.length)
      let conditional_open = next_token(source, conditional_left.start + conditional_left.length)
      let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
      if is_symbol(source, conditional_open, 40) == 1 {
        position = write_loop_conditional(buffer, position, source, table, function, current, 2)
        conditional = parse_loop_conditional(source, current.start)
      } else {
        position = write_loop_local_conditional(buffer, position, source, table, function, current, 2)
        conditional = parse_loop_local_conditional(source, current.start)
      }
      current = next_token(source, conditional.position)
    } else {
      let target = current
      if is_let_keyword(source, current) == 1 {
        target = next_token(source, current.start + current.length)
      }
      let equals = next_token(source, target.start + target.length)
      let operand = next_token(source, equals.start + equals.length)
      current = next_token(source, operand.start + operand.length)
      if is_symbol(source, current, 40) == 1 {
        let argument = next_token(source, current.start + current.length)
        while is_symbol(source, argument, 41) == 0 {
          let separator = next_token(source, argument.start + argument.length)
          if is_symbol(source, separator, 46) == 1 {
            position = write_operand(buffer, position, source, function, argument)
            let argument_field = next_token(source, separator.start + separator.length)
            let argument_field_index = local_struct_field_index(source, table, function, argument, argument_field)
            byte_set(buffer, position, 40)
            byte_set(buffer, position + 1, 2)
            position = position + 2
            let argument_field_offset_written = write_u32_leb(buffer, position, argument_field_index * 4)
            position = position + u32_leb_length(argument_field_index * 4)
            separator = next_token(source, argument_field.start + argument_field.length)
          } else {
            position = write_operand(buffer, position, source, function, argument)
          }
          while is_arithmetic_operator(source, separator) == 1 {
            let argument_arithmetic = separator
            let argument_arithmetic_operand = next_token(source, argument_arithmetic.start + argument_arithmetic.length)
            position = write_operand(buffer, position, source, function, argument_arithmetic_operand)
            separator = next_token(source, argument_arithmetic_operand.start + argument_arithmetic_operand.length)
            if is_symbol(source, separator, 46) == 1 {
              let argument_arithmetic_field = next_token(source, separator.start + separator.length)
              let argument_arithmetic_field_index = local_struct_field_index(source, table, function, argument_arithmetic_operand, argument_arithmetic_field)
              byte_set(buffer, position, 40)
              byte_set(buffer, position + 1, 2)
              position = position + 2
              let argument_arithmetic_field_offset_written = write_u32_leb(buffer, position, argument_arithmetic_field_index * 4)
              position = position + u32_leb_length(argument_arithmetic_field_index * 4)
              separator = next_token(source, argument_arithmetic_field.start + argument_arithmetic_field.length)
            }
            byte_set(buffer, position, arithmetic_opcode(source, argument_arithmetic))
            position = position + 1
          }
          if is_symbol(source, separator, 44) == 1 {
            argument = next_token(source, separator.start + separator.length)
          } else {
            argument = separator
          }
        }
        byte_set(buffer, position, 16)
        position = position + 1
        let called_index = function_index_in_table(source, table, operand)
        let call_written = write_u32_leb(buffer, position, called_index)
        position = position + u32_leb_length(called_index)
        current = next_token(source, argument.start + argument.length)
      } else {
        position = write_operand(buffer, position, source, function, operand)
        while is_arithmetic_operator(source, current) == 1 {
          let arithmetic = current
          let next_operand = next_token(source, arithmetic.start + arithmetic.length)
          current = next_token(source, next_operand.start + next_operand.length)
          if is_symbol(source, current, 40) == 1 {
            let arithmetic_argument = next_token(source, current.start + current.length)
            while is_symbol(source, arithmetic_argument, 41) == 0 {
              position = write_operand(buffer, position, source, function, arithmetic_argument)
              let arithmetic_separator = next_token(source, arithmetic_argument.start + arithmetic_argument.length)
              if is_symbol(source, arithmetic_separator, 44) == 1 {
                arithmetic_argument = next_token(source, arithmetic_separator.start + arithmetic_separator.length)
              } else {
                arithmetic_argument = arithmetic_separator
              }
            }
            byte_set(buffer, position, 16)
            position = position + 1
            let arithmetic_called_index = function_index_in_table(source, table, next_operand)
            let arithmetic_call_written = write_u32_leb(buffer, position, arithmetic_called_index)
            position = position + u32_leb_length(arithmetic_called_index)
            current = next_token(source, arithmetic_argument.start + arithmetic_argument.length)
          } else {
            position = write_operand(buffer, position, source, function, next_operand)
          }
          byte_set(buffer, position, arithmetic_opcode(source, arithmetic))
          position = position + 1
        }
      }
      byte_set(buffer, position, 33)
      position = position + 1
      let target_index = variable_index(source, function, target)
      let target_written = write_u32_leb(buffer, position, target_index)
      position = position + u32_leb_length(target_index)
    }
    }
  }
  byte_set(buffer, position, 12)
  byte_set(buffer, position + 1, 0)
  byte_set(buffer, position + 2, 11)
  byte_set(buffer, position + 3, 11)
  return position + 4
}

fn write_loop_conditional(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token, break_depth: i32) -> i32 {
  let position = index
  let called = next_token(source, statement.start + statement.length)
  let call_open = next_token(source, called.start + called.length)
  let argument = next_token(source, call_open.start + call_open.length)
  while is_symbol(source, argument, 41) == 0 {
    let separator = next_token(source, argument.start + argument.length)
    if is_symbol(source, separator, 46) == 1 {
      position = write_operand(buffer, position, source, function, argument)
      let argument_field = next_token(source, separator.start + separator.length)
      let argument_field_index = local_struct_field_index(source, table, function, argument, argument_field)
      byte_set(buffer, position, 40)
      byte_set(buffer, position + 1, 2)
      position = position + 2
      let argument_field_offset_written = write_u32_leb(buffer, position, argument_field_index * 4)
      position = position + u32_leb_length(argument_field_index * 4)
      separator = next_token(source, argument_field.start + argument_field.length)
    } else {
      if is_symbol(source, separator, 40) == 1 {
        let nested_argument_operand = next_token(source, separator.start + separator.length)
        while is_symbol(source, nested_argument_operand, 41) == 0 {
          position = write_operand(buffer, position, source, function, nested_argument_operand)
          let nested_argument_separator = next_token(source, nested_argument_operand.start + nested_argument_operand.length)
          if is_symbol(source, nested_argument_separator, 44) == 1 {
            nested_argument_operand = next_token(source, nested_argument_separator.start + nested_argument_separator.length)
          } else {
            nested_argument_operand = nested_argument_separator
          }
        }
        byte_set(buffer, position, 16)
        position = position + 1
        let nested_argument_called_index = function_index_in_table(source, table, argument)
        let nested_argument_call_written = write_u32_leb(buffer, position, nested_argument_called_index)
        position = position + u32_leb_length(nested_argument_called_index)
        separator = next_token(source, nested_argument_operand.start + nested_argument_operand.length)
      } else {
        position = write_operand(buffer, position, source, function, argument)
      }
    }
    while is_arithmetic_operator(source, separator) == 1 {
      let argument_arithmetic = separator
      let argument_arithmetic_operand = next_token(source, argument_arithmetic.start + argument_arithmetic.length)
      position = write_operand(buffer, position, source, function, argument_arithmetic_operand)
      byte_set(buffer, position, arithmetic_opcode(source, argument_arithmetic))
      position = position + 1
      separator = next_token(source, argument_arithmetic_operand.start + argument_arithmetic_operand.length)
    }
    if is_symbol(source, separator, 44) == 1 {
      argument = next_token(source, separator.start + separator.length)
    } else {
      argument = separator
    }
  }
  byte_set(buffer, position, 16)
  position = position + 1
  let called_index = function_index_in_table(source, table, called)
  let call_written = write_u32_leb(buffer, position, called_index)
  position = position + u32_leb_length(called_index)
  let operator = next_token(source, argument.start + argument.length)
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  let open = next_token(source, right.start + right.length)
  if is_symbol(source, open, 40) == 1 {
    let right_argument = next_token(source, open.start + open.length)
    while is_symbol(source, right_argument, 41) == 0 {
      let right_separator = next_token(source, right_argument.start + right_argument.length)
      if is_symbol(source, right_separator, 46) == 1 {
        position = write_operand(buffer, position, source, function, right_argument)
        let right_argument_field = next_token(source, right_separator.start + right_separator.length)
        let right_argument_field_index = local_struct_field_index(source, table, function, right_argument, right_argument_field)
        byte_set(buffer, position, 40)
        byte_set(buffer, position + 1, 2)
        position = position + 2
        let right_argument_field_offset_written = write_u32_leb(buffer, position, right_argument_field_index * 4)
        position = position + u32_leb_length(right_argument_field_index * 4)
        right_separator = next_token(source, right_argument_field.start + right_argument_field.length)
      } else {
        position = write_operand(buffer, position, source, function, right_argument)
      }
      while is_arithmetic_operator(source, right_separator) == 1 {
        let right_arithmetic = right_separator
        let right_arithmetic_operand = next_token(source, right_arithmetic.start + right_arithmetic.length)
        position = write_operand(buffer, position, source, function, right_arithmetic_operand)
        byte_set(buffer, position, arithmetic_opcode(source, right_arithmetic))
        position = position + 1
        right_separator = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
      }
      if is_symbol(source, right_separator, 44) == 1 {
        right_argument = next_token(source, right_separator.start + right_separator.length)
      } else {
        right_argument = right_separator
      }
    }
    byte_set(buffer, position, 16)
    position = position + 1
    let right_called_index = function_index_in_table(source, table, right)
    let right_call_written = write_u32_leb(buffer, position, right_called_index)
    position = position + u32_leb_length(right_called_index)
    open = next_token(source, right_argument.start + right_argument.length)
  } else {
    position = write_operand(buffer, position, source, function, right)
  }
  byte_set(buffer, position, comparison_opcode(source, operator))
  byte_set(buffer, position + 1, 4)
  byte_set(buffer, position + 2, 64)
  position = position + 3
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 125) == 0 {
    if is_break_keyword(source, current) == 1 {
      byte_set(buffer, position, 12)
      byte_set(buffer, position + 1, break_depth)
      position = position + 2
      current = next_token(source, current.start + current.length)
    } else {
      if is_if_keyword(source, current) == 1 {
        let nested_left = next_token(source, current.start + current.length)
        let nested_open = next_token(source, nested_left.start + nested_left.length)
        let nested = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, nested_open, 40) == 1 {
          position = write_loop_conditional(buffer, position, source, table, function, current, break_depth + 1)
          nested = parse_loop_conditional(source, current.start)
        } else {
          position = write_loop_local_conditional(buffer, position, source, table, function, current, break_depth + 1)
          nested = parse_loop_local_conditional(source, current.start)
        }
        current = next_token(source, nested.position)
      } else {
        if is_while_keyword(source, current) == 1 {
          position = write_while_statement(buffer, position, source, table, function, current)
          let nested_while = parse_while_statement(source, current.start)
          current = next_token(source, nested_while.position)
        } else {
          if is_return_keyword(source, current) == 1 {
            let return_value = next_token(source, current.start + current.length)
            let return_end = next_token(source, return_value.start + return_value.length)
            if is_symbol(source, return_end, 40) == 1 {
              let return_argument = next_token(source, return_end.start + return_end.length)
              while is_symbol(source, return_argument, 41) == 0 {
                position = write_operand(buffer, position, source, function, return_argument)
                let return_separator = next_token(source, return_argument.start + return_argument.length)
                if is_symbol(source, return_separator, 44) == 1 {
                  return_argument = next_token(source, return_separator.start + return_separator.length)
                } else {
                  return_argument = return_separator
                }
              }
              byte_set(buffer, position, 16)
              position = position + 1
              let return_called_index = function_index_in_table(source, table, return_value)
              let return_call_written = write_u32_leb(buffer, position, return_called_index)
              position = position + u32_leb_length(return_called_index)
              current = next_token(source, return_argument.start + return_argument.length)
            } else {
              position = write_operand(buffer, position, source, function, return_value)
              current = return_end
            }
            byte_set(buffer, position, 15)
            position = position + 1
          } else {
            let target = current
            let equals = next_token(source, target.start + target.length)
            let operand = next_token(source, equals.start + equals.length)
            position = write_operand(buffer, position, source, function, operand)
            current = next_token(source, operand.start + operand.length)
            while is_arithmetic_operator(source, current) == 1 {
              let arithmetic = current
              let next_operand = next_token(source, arithmetic.start + arithmetic.length)
              position = write_operand(buffer, position, source, function, next_operand)
              byte_set(buffer, position, arithmetic_opcode(source, arithmetic))
              position = position + 1
              current = next_token(source, next_operand.start + next_operand.length)
            }
            byte_set(buffer, position, 33)
            position = position + 1
            let target_index = variable_index(source, function, target)
            let target_written = write_u32_leb(buffer, position, target_index)
            position = position + u32_leb_length(target_index)
          }
        }
      }
    }
  }
  let after_then = next_token(source, current.start + current.length)
  if is_else_keyword(source, after_then) == 1 {
    byte_set(buffer, position, 5)
    position = position + 1
    let else_open = next_token(source, after_then.start + after_then.length)
    let else_statement = next_token(source, else_open.start + else_open.length)
    while is_symbol(source, else_statement, 125) == 0 {
      if is_break_keyword(source, else_statement) == 1 {
        byte_set(buffer, position, 12)
        byte_set(buffer, position + 1, break_depth)
        position = position + 2
        else_statement = next_token(source, else_statement.start + else_statement.length)
      } else {
        if is_if_keyword(source, else_statement) == 1 {
          let else_nested_left = next_token(source, else_statement.start + else_statement.length)
          let else_nested_open = next_token(source, else_nested_left.start + else_nested_left.length)
          let else_nested = function_definition(0, 0, 0, 0, else_statement.start, 0, 0)
          if is_symbol(source, else_nested_open, 40) == 1 {
            position = write_loop_conditional(buffer, position, source, table, function, else_statement, break_depth + 1)
            else_nested = parse_loop_conditional(source, else_statement.start)
          } else {
            position = write_loop_local_conditional(buffer, position, source, table, function, else_statement, break_depth + 1)
            else_nested = parse_loop_local_conditional(source, else_statement.start)
          }
          else_statement = next_token(source, else_nested.position)
        } else {
          if is_while_keyword(source, else_statement) == 1 {
            position = write_while_statement(buffer, position, source, table, function, else_statement)
            let else_nested_while = parse_while_statement(source, else_statement.start)
            else_statement = next_token(source, else_nested_while.position)
          } else {
            if is_return_keyword(source, else_statement) == 1 {
              let else_return_value = next_token(source, else_statement.start + else_statement.length)
              let else_return_end = next_token(source, else_return_value.start + else_return_value.length)
              if is_symbol(source, else_return_end, 40) == 1 {
                let else_return_argument = next_token(source, else_return_end.start + else_return_end.length)
                while is_symbol(source, else_return_argument, 41) == 0 {
                  position = write_operand(buffer, position, source, function, else_return_argument)
                  let else_return_separator = next_token(source, else_return_argument.start + else_return_argument.length)
                  if is_symbol(source, else_return_separator, 44) == 1 {
                    else_return_argument = next_token(source, else_return_separator.start + else_return_separator.length)
                  } else {
                    else_return_argument = else_return_separator
                  }
                }
                byte_set(buffer, position, 16)
                position = position + 1
                let else_return_called_index = function_index_in_table(source, table, else_return_value)
                let else_return_call_written = write_u32_leb(buffer, position, else_return_called_index)
                position = position + u32_leb_length(else_return_called_index)
                else_statement = next_token(source, else_return_argument.start + else_return_argument.length)
              } else {
                position = write_operand(buffer, position, source, function, else_return_value)
                else_statement = else_return_end
              }
              byte_set(buffer, position, 15)
              position = position + 1
            } else {
            let else_target = else_statement
            let else_equals = next_token(source, else_target.start + else_target.length)
            let else_operand = next_token(source, else_equals.start + else_equals.length)
            position = write_operand(buffer, position, source, function, else_operand)
            else_statement = next_token(source, else_operand.start + else_operand.length)
            while is_arithmetic_operator(source, else_statement) == 1 {
              let else_arithmetic = else_statement
              let else_next_operand = next_token(source, else_arithmetic.start + else_arithmetic.length)
              position = write_operand(buffer, position, source, function, else_next_operand)
              byte_set(buffer, position, arithmetic_opcode(source, else_arithmetic))
              position = position + 1
              else_statement = next_token(source, else_next_operand.start + else_next_operand.length)
            }
            byte_set(buffer, position, 33)
            position = position + 1
            let else_target_index = variable_index(source, function, else_target)
            let else_target_written = write_u32_leb(buffer, position, else_target_index)
            position = position + u32_leb_length(else_target_index)
          }
          }
        }
      }
    }
  }
  byte_set(buffer, position, 11)
  return position + 1
}

fn write_loop_local_conditional(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token, break_depth: i32) -> i32 {
  let position = index
  let left = next_token(source, statement.start + statement.length)
  let left_operator = next_token(source, left.start + left.length)
  let operator = left_operator
  let right = next_token(source, operator.start + operator.length)
  position = write_operand(buffer, position, source, function, left)
  if is_symbol(source, left_operator, 46) == 1 {
    let left_field = next_token(source, left_operator.start + left_operator.length)
    let left_field_index = local_struct_field_index(source, table, function, left, left_field)
    byte_set(buffer, position, 40)
    byte_set(buffer, position + 1, 2)
    position = position + 2
    let left_field_offset_written = write_u32_leb(buffer, position, left_field_index * 4)
    position = position + u32_leb_length(left_field_index * 4)
    operator = next_token(source, left_field.start + left_field.length)
    right = next_token(source, operator.start + operator.length)
  }
  if is_arithmetic_operator(source, left_operator) == 1 {
    position = write_operand(buffer, position, source, function, right)
    byte_set(buffer, position, arithmetic_opcode(source, left_operator))
    position = position + 1
    operator = next_token(source, right.start + right.length)
    right = next_token(source, operator.start + operator.length)
  }
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  position = write_operand(buffer, position, source, function, right)
  let right_end = next_token(source, right.start + right.length)
  if is_symbol(source, right_end, 46) == 1 {
    let right_field = next_token(source, right_end.start + right_end.length)
    let right_field_index = local_struct_field_index(source, table, function, right, right_field)
    byte_set(buffer, position, 40)
    byte_set(buffer, position + 1, 2)
    position = position + 2
    let right_field_offset_written = write_u32_leb(buffer, position, right_field_index * 4)
    position = position + u32_leb_length(right_field_index * 4)
    right_end = next_token(source, right_field.start + right_field.length)
  }
  byte_set(buffer, position, comparison_opcode(source, operator))
  byte_set(buffer, position + 1, 4)
  byte_set(buffer, position + 2, 64)
  position = position + 3
  let open = right_end
  let current = next_token(source, open.start + open.length)
  while is_symbol(source, current, 125) == 0 {
    if is_break_keyword(source, current) == 1 {
      byte_set(buffer, position, 12)
      byte_set(buffer, position + 1, break_depth)
      position = position + 2
      current = next_token(source, current.start + current.length)
    } else {
      if is_if_keyword(source, current) == 1 {
        let nested_left = next_token(source, current.start + current.length)
        let nested_open = next_token(source, nested_left.start + nested_left.length)
        let nested = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if is_symbol(source, nested_open, 40) == 1 {
          position = write_loop_conditional(buffer, position, source, table, function, current, break_depth + 1)
          nested = parse_loop_conditional(source, current.start)
        } else {
          position = write_loop_local_conditional(buffer, position, source, table, function, current, break_depth + 1)
          nested = parse_loop_local_conditional(source, current.start)
        }
        current = next_token(source, nested.position)
      } else {
        if is_while_keyword(source, current) == 1 {
          position = write_while_statement(buffer, position, source, table, function, current)
          let nested_while = parse_while_statement(source, current.start)
          current = next_token(source, nested_while.position)
        } else {
          if is_return_keyword(source, current) == 1 {
            let return_value = next_token(source, current.start + current.length)
            let return_end = next_token(source, return_value.start + return_value.length)
            if is_symbol(source, return_end, 40) == 1 {
              let return_argument = next_token(source, return_end.start + return_end.length)
              while is_symbol(source, return_argument, 41) == 0 {
                position = write_operand(buffer, position, source, function, return_argument)
                let return_separator = next_token(source, return_argument.start + return_argument.length)
                if is_symbol(source, return_separator, 44) == 1 {
                  return_argument = next_token(source, return_separator.start + return_separator.length)
                } else {
                  return_argument = return_separator
                }
              }
              byte_set(buffer, position, 16)
              position = position + 1
              let return_called_index = function_index_in_table(source, table, return_value)
              let return_call_written = write_u32_leb(buffer, position, return_called_index)
              position = position + u32_leb_length(return_called_index)
              current = next_token(source, return_argument.start + return_argument.length)
            } else {
              position = write_operand(buffer, position, source, function, return_value)
              current = return_end
            }
            byte_set(buffer, position, 15)
            position = position + 1
          } else {
            let target = current
            let equals = next_token(source, target.start + target.length)
            let operand = next_token(source, equals.start + equals.length)
            position = write_operand(buffer, position, source, function, operand)
            current = next_token(source, operand.start + operand.length)
            while is_arithmetic_operator(source, current) == 1 {
              let arithmetic = current
              let next_operand = next_token(source, arithmetic.start + arithmetic.length)
              position = write_operand(buffer, position, source, function, next_operand)
              byte_set(buffer, position, arithmetic_opcode(source, arithmetic))
              position = position + 1
              current = next_token(source, next_operand.start + next_operand.length)
            }
            byte_set(buffer, position, 33)
            position = position + 1
            let target_index = variable_index(source, function, target)
            let target_written = write_u32_leb(buffer, position, target_index)
            position = position + u32_leb_length(target_index)
          }
        }
      }
    }
  }
  let after_then = next_token(source, current.start + current.length)
  if is_else_keyword(source, after_then) == 1 {
    byte_set(buffer, position, 5)
    position = position + 1
    let else_open = next_token(source, after_then.start + after_then.length)
    let else_statement = next_token(source, else_open.start + else_open.length)
    while is_symbol(source, else_statement, 125) == 0 {
      if is_break_keyword(source, else_statement) == 1 {
        byte_set(buffer, position, 12)
        byte_set(buffer, position + 1, break_depth)
        position = position + 2
        else_statement = next_token(source, else_statement.start + else_statement.length)
      } else {
        if is_if_keyword(source, else_statement) == 1 {
          let else_nested_left = next_token(source, else_statement.start + else_statement.length)
          let else_nested_open = next_token(source, else_nested_left.start + else_nested_left.length)
          let else_nested = function_definition(0, 0, 0, 0, else_statement.start, 0, 0)
          if is_symbol(source, else_nested_open, 40) == 1 {
            position = write_loop_conditional(buffer, position, source, table, function, else_statement, break_depth + 1)
            else_nested = parse_loop_conditional(source, else_statement.start)
          } else {
            position = write_loop_local_conditional(buffer, position, source, table, function, else_statement, break_depth + 1)
            else_nested = parse_loop_local_conditional(source, else_statement.start)
          }
          else_statement = next_token(source, else_nested.position)
        } else {
          if is_while_keyword(source, else_statement) == 1 {
            position = write_while_statement(buffer, position, source, table, function, else_statement)
            let else_nested_while = parse_while_statement(source, else_statement.start)
            else_statement = next_token(source, else_nested_while.position)
          } else {
            if is_return_keyword(source, else_statement) == 1 {
              let else_return_value = next_token(source, else_statement.start + else_statement.length)
              let else_return_end = next_token(source, else_return_value.start + else_return_value.length)
              if is_symbol(source, else_return_end, 40) == 1 {
                let else_return_argument = next_token(source, else_return_end.start + else_return_end.length)
                while is_symbol(source, else_return_argument, 41) == 0 {
                  position = write_operand(buffer, position, source, function, else_return_argument)
                  let else_return_separator = next_token(source, else_return_argument.start + else_return_argument.length)
                  if is_symbol(source, else_return_separator, 44) == 1 {
                    else_return_argument = next_token(source, else_return_separator.start + else_return_separator.length)
                  } else {
                    else_return_argument = else_return_separator
                  }
                }
                byte_set(buffer, position, 16)
                position = position + 1
                let else_return_called_index = function_index_in_table(source, table, else_return_value)
                let else_return_call_written = write_u32_leb(buffer, position, else_return_called_index)
                position = position + u32_leb_length(else_return_called_index)
                else_statement = next_token(source, else_return_argument.start + else_return_argument.length)
              } else {
                position = write_operand(buffer, position, source, function, else_return_value)
                else_statement = else_return_end
              }
              byte_set(buffer, position, 15)
              position = position + 1
            } else {
            let else_target = else_statement
            let else_equals = next_token(source, else_target.start + else_target.length)
            let else_operand = next_token(source, else_equals.start + else_equals.length)
            position = write_operand(buffer, position, source, function, else_operand)
            else_statement = next_token(source, else_operand.start + else_operand.length)
            while is_arithmetic_operator(source, else_statement) == 1 {
              let else_arithmetic = else_statement
              let else_next_operand = next_token(source, else_arithmetic.start + else_arithmetic.length)
              position = write_operand(buffer, position, source, function, else_next_operand)
              byte_set(buffer, position, arithmetic_opcode(source, else_arithmetic))
              position = position + 1
              else_statement = next_token(source, else_next_operand.start + else_next_operand.length)
            }
            byte_set(buffer, position, 33)
            position = position + 1
            let else_target_index = variable_index(source, function, else_target)
            let else_target_written = write_u32_leb(buffer, position, else_target_index)
            position = position + u32_leb_length(else_target_index)
          }
          }
        }
      }
    }
  }
  byte_set(buffer, position, 11)
  return position + 1
}

fn write_local_return_conditional(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let position = index
  let left = next_token(source, statement.start + statement.length)
  let operator = next_token(source, left.start + left.length)
  if is_symbol(source, operator, 46) == 1 {
    position = write_operand(buffer, position, source, function, left)
    let left_field = next_token(source, operator.start + operator.length)
    let left_field_index = local_struct_field_index(source, table, function, left, left_field)
    byte_set(buffer, position, 40)
    byte_set(buffer, position + 1, 2)
    position = position + 2
    let left_field_offset_written = write_u32_leb(buffer, position, left_field_index * 4)
    position = position + u32_leb_length(left_field_index * 4)
    operator = next_token(source, left_field.start + left_field.length)
  } else {
    if is_symbol(source, operator, 40) == 1 {
      let condition_argument = next_token(source, operator.start + operator.length)
      while is_symbol(source, condition_argument, 41) == 0 {
        let condition_separator = next_token(source, condition_argument.start + condition_argument.length)
        if is_symbol(source, condition_separator, 46) == 1 {
          position = write_operand(buffer, position, source, function, condition_argument)
          let condition_field = next_token(source, condition_separator.start + condition_separator.length)
          let condition_field_index = local_struct_field_index(source, table, function, condition_argument, condition_field)
          byte_set(buffer, position, 40)
          byte_set(buffer, position + 1, 2)
          position = position + 2
          let condition_field_offset_written = write_u32_leb(buffer, position, condition_field_index * 4)
          position = position + u32_leb_length(condition_field_index * 4)
          condition_separator = next_token(source, condition_field.start + condition_field.length)
          while is_arithmetic_operator(source, condition_separator) == 1 {
            let condition_arithmetic = condition_separator
            let condition_arithmetic_operand = next_token(source, condition_arithmetic.start + condition_arithmetic.length)
            position = write_operand(buffer, position, source, function, condition_arithmetic_operand)
            byte_set(buffer, position, arithmetic_opcode(source, condition_arithmetic))
            position = position + 1
            condition_separator = next_token(source, condition_arithmetic_operand.start + condition_arithmetic_operand.length)
          }
        } else {
          if is_symbol(source, condition_separator, 40) == 1 {
            let nested_condition_argument = next_token(source, condition_separator.start + condition_separator.length)
            while is_symbol(source, nested_condition_argument, 41) == 0 {
              position = write_operand(buffer, position, source, function, nested_condition_argument)
              let nested_condition_separator = next_token(source, nested_condition_argument.start + nested_condition_argument.length)
              if is_symbol(source, nested_condition_separator, 44) == 1 {
                nested_condition_argument = next_token(source, nested_condition_separator.start + nested_condition_separator.length)
              } else {
                nested_condition_argument = nested_condition_separator
              }
            }
            byte_set(buffer, position, 16)
            position = position + 1
            let nested_condition_called_index = function_index_in_table(source, table, condition_argument)
            let nested_condition_call_written = write_u32_leb(buffer, position, nested_condition_called_index)
            position = position + u32_leb_length(nested_condition_called_index)
            condition_separator = next_token(source, nested_condition_argument.start + nested_condition_argument.length)
          } else {
            position = write_operand(buffer, position, source, function, condition_argument)
          }
        }
        if is_symbol(source, condition_separator, 44) == 1 {
          condition_argument = next_token(source, condition_separator.start + condition_separator.length)
        } else {
          condition_argument = condition_separator
        }
      }
      byte_set(buffer, position, 16)
      position = position + 1
      let condition_called_index = function_index_in_table(source, table, left)
      let condition_call_written = write_u32_leb(buffer, position, condition_called_index)
      position = position + u32_leb_length(condition_called_index)
      operator = next_token(source, condition_argument.start + condition_argument.length)
    } else {
      position = write_operand(buffer, position, source, function, left)
    }
  }
  let right = next_token(source, operator.start + operator.length)
  if is_symbol(source, right, 61) == 1 {
    right = next_token(source, right.start + right.length)
  }
  position = write_operand(buffer, position, source, function, right)
  let right_end = next_token(source, right.start + right.length)
  if is_symbol(source, right_end, 46) == 1 {
    let right_field = next_token(source, right_end.start + right_end.length)
    let right_field_index = local_struct_field_index(source, table, function, right, right_field)
    byte_set(buffer, position, 40)
    byte_set(buffer, position + 1, 2)
    position = position + 2
    let right_field_offset_written = write_u32_leb(buffer, position, right_field_index * 4)
    position = position + u32_leb_length(right_field_index * 4)
    right_end = next_token(source, right_field.start + right_field.length)
  }
  byte_set(buffer, position, comparison_opcode(source, operator))
  byte_set(buffer, position + 1, 4)
  byte_set(buffer, position + 2, 64)
  position = position + 3
  let open = right_end
  let body_statement = next_token(source, open.start + open.length)
  while is_return_keyword(source, body_statement) == 0 {
    if is_symbol(source, body_statement, 125) == 1 {
      byte_set(buffer, position, 11)
      return position + 1
    }
    if is_if_keyword(source, body_statement) == 1 {
      position = write_local_return_conditional(buffer, position, source, table, function, body_statement)
      let body_conditional = parse_local_return_conditional(source, body_statement.start)
      body_statement = next_token(source, body_conditional.position)
    } else {
      if is_while_keyword(source, body_statement) == 1 {
      position = write_while_statement(buffer, position, source, table, function, body_statement)
      let body_while = parse_while_statement(source, body_statement.start)
      body_statement = next_token(source, body_while.position)
      } else {
        let body_target = body_statement
        let body_equals = next_token(source, body_target.start + body_target.length)
        let body_operand = next_token(source, body_equals.start + body_equals.length)
        position = write_operand(buffer, position, source, function, body_operand)
        body_statement = next_token(source, body_operand.start + body_operand.length)
        while is_arithmetic_operator(source, body_statement) == 1 {
          let body_arithmetic = body_statement
          let body_next_operand = next_token(source, body_arithmetic.start + body_arithmetic.length)
          position = write_operand(buffer, position, source, function, body_next_operand)
          byte_set(buffer, position, arithmetic_opcode(source, body_arithmetic))
          position = position + 1
          body_statement = next_token(source, body_next_operand.start + body_next_operand.length)
        }
        byte_set(buffer, position, 33)
        position = position + 1
        let body_target_index = variable_index(source, function, body_target)
        let body_target_written = write_u32_leb(buffer, position, body_target_index)
        position = position + u32_leb_length(body_target_index)
      }
    }
  }
  let returned = body_statement
  let value = next_token(source, returned.start + returned.length)
  let after_value = next_token(source, value.start + value.length)
  if is_symbol(source, after_value, 40) == 1 {
    let argument = next_token(source, after_value.start + after_value.length)
    let constructor_offset = 0
    while is_symbol(source, argument, 41) == 0 {
      if struct_field_count(source, value) >= 0 {
        byte_set(buffer, position, 65)
        byte_set(buffer, position + 1, 0)
        position = position + 2
      }
      let separator = next_token(source, argument.start + argument.length)
      if is_symbol(source, separator, 46) == 1 {
        position = write_operand(buffer, position, source, function, argument)
        let argument_field = next_token(source, separator.start + separator.length)
        let argument_field_index = local_struct_field_index(source, table, function, argument, argument_field)
        byte_set(buffer, position, 40)
        byte_set(buffer, position + 1, 2)
        position = position + 2
        let argument_field_offset_written = write_u32_leb(buffer, position, argument_field_index * 4)
        position = position + u32_leb_length(argument_field_index * 4)
        separator = next_token(source, argument_field.start + argument_field.length)
      } else {
        position = write_operand(buffer, position, source, function, argument)
      }
      while is_arithmetic_operator(source, separator) == 1 {
        let return_arithmetic = separator
        let return_arithmetic_operand = next_token(source, return_arithmetic.start + return_arithmetic.length)
        position = write_operand(buffer, position, source, function, return_arithmetic_operand)
        let return_after_operand = next_token(source, return_arithmetic_operand.start + return_arithmetic_operand.length)
        if is_symbol(source, return_after_operand, 46) == 1 {
          let return_arithmetic_field = next_token(source, return_after_operand.start + return_after_operand.length)
          let return_arithmetic_field_index = local_struct_field_index(source, table, function, return_arithmetic_operand, return_arithmetic_field)
          byte_set(buffer, position, 40)
          byte_set(buffer, position + 1, 2)
          position = position + 2
          let return_arithmetic_field_offset_written = write_u32_leb(buffer, position, return_arithmetic_field_index * 4)
          position = position + u32_leb_length(return_arithmetic_field_index * 4)
          separator = next_token(source, return_arithmetic_field.start + return_arithmetic_field.length)
        } else {
          separator = return_after_operand
        }
        byte_set(buffer, position, arithmetic_opcode(source, return_arithmetic))
        position = position + 1
      }
      if struct_field_count(source, value) >= 0 {
        byte_set(buffer, position, 54)
        byte_set(buffer, position + 1, 2)
        position = position + 2
        let constructor_offset_written = write_u32_leb(buffer, position, constructor_offset)
        position = position + u32_leb_length(constructor_offset)
      }
      if is_symbol(source, separator, 44) == 1 {
        argument = next_token(source, separator.start + separator.length)
      } else {
        argument = separator
      }
      constructor_offset = constructor_offset + 4
    }
    if struct_field_count(source, value) < 0 {
      byte_set(buffer, position, 16)
      position = position + 1
      let called_index = function_index_in_table(source, table, value)
      let call_written = write_u32_leb(buffer, position, called_index)
      position = position + u32_leb_length(called_index)
    } else {
      byte_set(buffer, position, 65)
      byte_set(buffer, position + 1, 0)
      position = position + 2
    }
  } else {
    position = write_operand(buffer, position, source, function, value)
  }
  byte_set(buffer, position, 15)
  byte_set(buffer, position + 1, 11)
  return position + 2
}

fn write_local_body(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition) -> bytes {
  let position = index
  let local_count = local_count_of(source, function)
  if local_count > 0 {
    byte_set(buffer, position, 1)
    position = position + 1
    let count_written = write_u32_leb(buffer, position, local_count)
    position = position + u32_leb_length(local_count)
    byte_set(count_written, position, 127)
    position = position + 1
  } else {
    byte_set(buffer, position, 0)
    position = position + 1
  }
  let current = function_body_first_token(source, function)
  let local_index = function_parameter_count_of(source, function)
  while is_let_keyword(source, current) == 1 {
    let name = next_token(source, current.start + current.length)
    let equals = next_token(source, name.start + name.length)
    let operand = next_token(source, equals.start + equals.length)
    current = next_token(source, operand.start + operand.length)
    if is_symbol(source, current, 46) == 1 {
      position = write_operand(buffer, position, source, function, operand)
      let field = next_token(source, current.start + current.length)
      let field_index = local_struct_field_index(source, table, function, operand, field)
      byte_set(buffer, position, 40)
      byte_set(buffer, position + 1, 2)
      position = position + 2
      let field_offset_written = write_u32_leb(buffer, position, field_index * 4)
      position = position + u32_leb_length(field_index * 4)
      current = next_token(source, field.start + field.length)
    } else {
      if is_symbol(source, current, 40) == 1 {
        let argument = next_token(source, current.start + current.length)
        while is_symbol(source, argument, 41) == 0 {
          let argument_separator = next_token(source, argument.start + argument.length)
          if is_symbol(source, argument_separator, 46) == 1 {
            position = write_operand(buffer, position, source, function, argument)
            let argument_field = next_token(source, argument_separator.start + argument_separator.length)
            let argument_field_index = local_struct_field_index(source, table, function, argument, argument_field)
            byte_set(buffer, position, 40)
            byte_set(buffer, position + 1, 2)
            position = position + 2
            let argument_field_offset_written = write_u32_leb(buffer, position, argument_field_index * 4)
            position = position + u32_leb_length(argument_field_index * 4)
            argument_separator = next_token(source, argument_field.start + argument_field.length)
          } else {
            position = write_operand(buffer, position, source, function, argument)
          }
          while is_arithmetic_operator(source, argument_separator) == 1 {
            let argument_arithmetic = argument_separator
            let argument_arithmetic_operand = next_token(source, argument_arithmetic.start + argument_arithmetic.length)
            position = write_operand(buffer, position, source, function, argument_arithmetic_operand)
            let argument_after_operand = next_token(source, argument_arithmetic_operand.start + argument_arithmetic_operand.length)
            if is_symbol(source, argument_after_operand, 46) == 1 {
              let argument_arithmetic_field = next_token(source, argument_after_operand.start + argument_after_operand.length)
              let argument_arithmetic_field_index = local_struct_field_index(source, table, function, argument_arithmetic_operand, argument_arithmetic_field)
              byte_set(buffer, position, 40)
              byte_set(buffer, position + 1, 2)
              position = position + 2
              let argument_arithmetic_field_offset_written = write_u32_leb(buffer, position, argument_arithmetic_field_index * 4)
              position = position + u32_leb_length(argument_arithmetic_field_index * 4)
              argument_separator = next_token(source, argument_arithmetic_field.start + argument_arithmetic_field.length)
            } else {
              argument_separator = argument_after_operand
            }
            byte_set(buffer, position, arithmetic_opcode(source, argument_arithmetic))
            position = position + 1
          }
          if is_symbol(source, argument_separator, 44) == 1 {
            argument = next_token(source, argument_separator.start + argument_separator.length)
          } else {
            argument = argument_separator
          }
        }
        byte_set(buffer, position, 16)
        position = position + 1
        let called_index = function_index_in_table(source, table, operand)
        let call_written = write_u32_leb(buffer, position, called_index)
        position = position + u32_leb_length(called_index)
        current = next_token(source, argument.start + argument.length)
      } else {
        position = write_operand(buffer, position, source, function, operand)
      }
    }
    while is_arithmetic_operator(source, current) == 1 {
      let operator = current
      let next_operand = next_token(source, operator.start + operator.length)
      position = write_operand(buffer, position, source, function, next_operand)
      byte_set(buffer, position, arithmetic_opcode(source, operator))
      position = position + 1
      current = next_token(source, next_operand.start + next_operand.length)
      if is_symbol(source, current, 46) == 1 {
        let next_field = next_token(source, current.start + current.length)
        let next_field_index = local_struct_field_index(source, table, function, next_operand, next_field)
        byte_set(buffer, position, 40)
        byte_set(buffer, position + 1, 2)
        position = position + 2
        let next_field_offset_written = write_u32_leb(buffer, position, next_field_index * 4)
        position = position + u32_leb_length(next_field_index * 4)
        current = next_token(source, next_field.start + next_field.length)
      }
    }
    byte_set(buffer, position, 33)
    position = position + 1
    let local_written = write_u32_leb(buffer, position, local_index)
    position = position + u32_leb_length(local_index)
    local_index = local_index + 1
  }
  if is_while_keyword(source, current) == 1 {
    position = write_while_statement(buffer, position, source, table, function, current)
    let statement = parse_while_statement(source, current.start)
    current = next_token(source, statement.position)
  }
  while is_if_keyword(source, current) == 1 {
    position = write_local_return_conditional(buffer, position, source, table, function, current)
    let conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let trailing_name = next_token(source, current.start + current.length)
    let trailing_equals = next_token(source, trailing_name.start + trailing_name.length)
    let trailing_operand = next_token(source, trailing_equals.start + trailing_equals.length)
    current = next_token(source, trailing_operand.start + trailing_operand.length)
    if is_symbol(source, current, 46) == 1 {
      position = write_operand(buffer, position, source, function, trailing_operand)
      let trailing_field = next_token(source, current.start + current.length)
      let trailing_field_index = local_struct_field_index(source, table, function, trailing_operand, trailing_field)
      byte_set(buffer, position, 40)
      byte_set(buffer, position + 1, 2)
      position = position + 2
      let trailing_field_offset_written = write_u32_leb(buffer, position, trailing_field_index * 4)
      position = position + u32_leb_length(trailing_field_index * 4)
      current = next_token(source, trailing_field.start + trailing_field.length)
    } else {
      if is_symbol(source, current, 40) == 1 {
        let trailing_argument = next_token(source, current.start + current.length)
        while is_symbol(source, trailing_argument, 41) == 0 {
          let trailing_separator = next_token(source, trailing_argument.start + trailing_argument.length)
          if is_symbol(source, trailing_separator, 46) == 1 {
            position = write_operand(buffer, position, source, function, trailing_argument)
            let trailing_argument_field = next_token(source, trailing_separator.start + trailing_separator.length)
            let trailing_argument_field_index = local_struct_field_index(source, table, function, trailing_argument, trailing_argument_field)
            byte_set(buffer, position, 40)
            byte_set(buffer, position + 1, 2)
            position = position + 2
            let trailing_argument_field_offset_written = write_u32_leb(buffer, position, trailing_argument_field_index * 4)
            position = position + u32_leb_length(trailing_argument_field_index * 4)
            trailing_separator = next_token(source, trailing_argument_field.start + trailing_argument_field.length)
          } else {
            position = write_operand(buffer, position, source, function, trailing_argument)
          }
          while is_arithmetic_operator(source, trailing_separator) == 1 {
            let trailing_argument_arithmetic = trailing_separator
            let trailing_argument_operand = next_token(source, trailing_argument_arithmetic.start + trailing_argument_arithmetic.length)
            position = write_operand(buffer, position, source, function, trailing_argument_operand)
            let trailing_after_operand = next_token(source, trailing_argument_operand.start + trailing_argument_operand.length)
            if is_symbol(source, trailing_after_operand, 46) == 1 {
              let trailing_argument_next_field = next_token(source, trailing_after_operand.start + trailing_after_operand.length)
              let trailing_argument_next_field_index = local_struct_field_index(source, table, function, trailing_argument_operand, trailing_argument_next_field)
              byte_set(buffer, position, 40)
              byte_set(buffer, position + 1, 2)
              position = position + 2
              let trailing_argument_next_field_offset_written = write_u32_leb(buffer, position, trailing_argument_next_field_index * 4)
              position = position + u32_leb_length(trailing_argument_next_field_index * 4)
              trailing_separator = next_token(source, trailing_argument_next_field.start + trailing_argument_next_field.length)
            } else {
              trailing_separator = trailing_after_operand
            }
            byte_set(buffer, position, arithmetic_opcode(source, trailing_argument_arithmetic))
            position = position + 1
          }
          if is_symbol(source, trailing_separator, 44) == 1 {
            trailing_argument = next_token(source, trailing_separator.start + trailing_separator.length)
          } else {
            trailing_argument = trailing_separator
          }
        }
        byte_set(buffer, position, 16)
        position = position + 1
        let trailing_called_index = function_index_in_table(source, table, trailing_operand)
        let trailing_call_written = write_u32_leb(buffer, position, trailing_called_index)
        position = position + u32_leb_length(trailing_called_index)
        current = next_token(source, trailing_argument.start + trailing_argument.length)
      } else {
        position = write_operand(buffer, position, source, function, trailing_operand)
      }
    }
    while is_arithmetic_operator(source, current) == 1 {
      let trailing_operator = current
      let trailing_next_operand = next_token(source, trailing_operator.start + trailing_operator.length)
      position = write_operand(buffer, position, source, function, trailing_next_operand)
      byte_set(buffer, position, arithmetic_opcode(source, trailing_operator))
      position = position + 1
      current = next_token(source, trailing_next_operand.start + trailing_next_operand.length)
    }
    byte_set(buffer, position, 33)
    position = position + 1
    let trailing_local_written = write_u32_leb(buffer, position, local_index)
    position = position + u32_leb_length(local_index)
    local_index = local_index + 1
  }
  if is_while_keyword(source, current) == 1 {
    position = write_while_statement(buffer, position, source, table, function, current)
    let trailing_while = parse_while_statement(source, current.start)
    current = next_token(source, trailing_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    position = write_local_return_conditional(buffer, position, source, table, function, current)
    let post_local_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_local_conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let post_conditional_name = next_token(source, current.start + current.length)
    let post_conditional_equals = next_token(source, post_conditional_name.start + post_conditional_name.length)
    let post_conditional_operand = next_token(source, post_conditional_equals.start + post_conditional_equals.length)
    current = next_token(source, post_conditional_operand.start + post_conditional_operand.length)
    if is_symbol(source, current, 46) == 1 {
      position = write_operand(buffer, position, source, function, post_conditional_operand)
      let post_conditional_field = next_token(source, current.start + current.length)
      let post_conditional_field_index = local_struct_field_index(source, table, function, post_conditional_operand, post_conditional_field)
      byte_set(buffer, position, 40)
      byte_set(buffer, position + 1, 2)
      position = position + 2
      let post_conditional_field_offset_written = write_u32_leb(buffer, position, post_conditional_field_index * 4)
      position = position + u32_leb_length(post_conditional_field_index * 4)
      current = next_token(source, post_conditional_field.start + post_conditional_field.length)
    } else {
      if is_symbol(source, current, 40) == 1 {
        let post_conditional_argument = next_token(source, current.start + current.length)
        while is_symbol(source, post_conditional_argument, 41) == 0 {
          let post_conditional_separator = next_token(source, post_conditional_argument.start + post_conditional_argument.length)
          if is_symbol(source, post_conditional_separator, 46) == 1 {
            position = write_operand(buffer, position, source, function, post_conditional_argument)
            let post_conditional_argument_field = next_token(source, post_conditional_separator.start + post_conditional_separator.length)
            let post_conditional_argument_field_index = local_struct_field_index(source, table, function, post_conditional_argument, post_conditional_argument_field)
            byte_set(buffer, position, 40)
            byte_set(buffer, position + 1, 2)
            position = position + 2
            let post_conditional_argument_field_offset_written = write_u32_leb(buffer, position, post_conditional_argument_field_index * 4)
            position = position + u32_leb_length(post_conditional_argument_field_index * 4)
            post_conditional_separator = next_token(source, post_conditional_argument_field.start + post_conditional_argument_field.length)
          } else {
            position = write_operand(buffer, position, source, function, post_conditional_argument)
          }
          while is_arithmetic_operator(source, post_conditional_separator) == 1 {
            let post_conditional_argument_arithmetic = post_conditional_separator
            let post_conditional_argument_operand = next_token(source, post_conditional_argument_arithmetic.start + post_conditional_argument_arithmetic.length)
            position = write_operand(buffer, position, source, function, post_conditional_argument_operand)
            let post_conditional_after_operand = next_token(source, post_conditional_argument_operand.start + post_conditional_argument_operand.length)
            if is_symbol(source, post_conditional_after_operand, 46) == 1 {
              let post_conditional_argument_next_field = next_token(source, post_conditional_after_operand.start + post_conditional_after_operand.length)
              let post_conditional_argument_next_field_index = local_struct_field_index(source, table, function, post_conditional_argument_operand, post_conditional_argument_next_field)
              byte_set(buffer, position, 40)
              byte_set(buffer, position + 1, 2)
              position = position + 2
              let post_conditional_argument_next_field_offset_written = write_u32_leb(buffer, position, post_conditional_argument_next_field_index * 4)
              position = position + u32_leb_length(post_conditional_argument_next_field_index * 4)
              post_conditional_separator = next_token(source, post_conditional_argument_next_field.start + post_conditional_argument_next_field.length)
            } else {
              post_conditional_separator = post_conditional_after_operand
            }
            byte_set(buffer, position, arithmetic_opcode(source, post_conditional_argument_arithmetic))
            position = position + 1
          }
          if is_symbol(source, post_conditional_separator, 44) == 1 {
            post_conditional_argument = next_token(source, post_conditional_separator.start + post_conditional_separator.length)
          } else {
            post_conditional_argument = post_conditional_separator
          }
        }
        byte_set(buffer, position, 16)
        position = position + 1
        let post_conditional_called_index = function_index_in_table(source, table, post_conditional_operand)
        let post_conditional_call_written = write_u32_leb(buffer, position, post_conditional_called_index)
        position = position + u32_leb_length(post_conditional_called_index)
        current = next_token(source, post_conditional_argument.start + post_conditional_argument.length)
      } else {
        position = write_operand(buffer, position, source, function, post_conditional_operand)
      }
    }
    while is_arithmetic_operator(source, current) == 1 {
      let post_conditional_operator = current
      let post_conditional_next_operand = next_token(source, post_conditional_operator.start + post_conditional_operator.length)
      position = write_operand(buffer, position, source, function, post_conditional_next_operand)
      byte_set(buffer, position, arithmetic_opcode(source, post_conditional_operator))
      position = position + 1
      current = next_token(source, post_conditional_next_operand.start + post_conditional_next_operand.length)
    }
    byte_set(buffer, position, 33)
    position = position + 1
    let post_conditional_local_written = write_u32_leb(buffer, position, local_index)
    position = position + u32_leb_length(local_index)
    local_index = local_index + 1
  }
  if is_while_keyword(source, current) == 1 {
    position = write_while_statement(buffer, position, source, table, function, current)
    let post_conditional_while = parse_while_statement(source, current.start)
    current = next_token(source, post_conditional_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    position = write_local_return_conditional(buffer, position, source, table, function, current)
    let post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_conditional_if.position)
  }
  while is_let_keyword(source, current) == 1 {
    let continuation_name = next_token(source, current.start + current.length)
    let continuation_equals = next_token(source, continuation_name.start + continuation_name.length)
    let continuation_operand = next_token(source, continuation_equals.start + continuation_equals.length)
    current = next_token(source, continuation_operand.start + continuation_operand.length)
    if is_symbol(source, current, 46) == 1 {
      position = write_operand(buffer, position, source, function, continuation_operand)
      let continuation_field = next_token(source, current.start + current.length)
      let continuation_field_index = local_struct_field_index(source, table, function, continuation_operand, continuation_field)
      byte_set(buffer, position, 40)
      byte_set(buffer, position + 1, 2)
      position = position + 2
      let continuation_field_offset_written = write_u32_leb(buffer, position, continuation_field_index * 4)
      position = position + u32_leb_length(continuation_field_index * 4)
      current = next_token(source, continuation_field.start + continuation_field.length)
    } else {
      if is_symbol(source, current, 40) == 1 {
        let continuation_argument = next_token(source, current.start + current.length)
        while is_symbol(source, continuation_argument, 41) == 0 {
          let continuation_separator = next_token(source, continuation_argument.start + continuation_argument.length)
          if is_symbol(source, continuation_separator, 46) == 1 {
            position = write_operand(buffer, position, source, function, continuation_argument)
            let continuation_argument_field = next_token(source, continuation_separator.start + continuation_separator.length)
            let continuation_argument_field_index = local_struct_field_index(source, table, function, continuation_argument, continuation_argument_field)
            byte_set(buffer, position, 40)
            byte_set(buffer, position + 1, 2)
            position = position + 2
            let continuation_argument_field_offset_written = write_u32_leb(buffer, position, continuation_argument_field_index * 4)
            position = position + u32_leb_length(continuation_argument_field_index * 4)
            continuation_separator = next_token(source, continuation_argument_field.start + continuation_argument_field.length)
          } else {
            position = write_operand(buffer, position, source, function, continuation_argument)
          }
          while is_arithmetic_operator(source, continuation_separator) == 1 {
            let continuation_argument_arithmetic = continuation_separator
            let continuation_argument_operand = next_token(source, continuation_argument_arithmetic.start + continuation_argument_arithmetic.length)
            position = write_operand(buffer, position, source, function, continuation_argument_operand)
            let continuation_after_operand = next_token(source, continuation_argument_operand.start + continuation_argument_operand.length)
            if is_symbol(source, continuation_after_operand, 46) == 1 {
              let continuation_argument_next_field = next_token(source, continuation_after_operand.start + continuation_after_operand.length)
              let continuation_argument_next_field_index = local_struct_field_index(source, table, function, continuation_argument_operand, continuation_argument_next_field)
              byte_set(buffer, position, 40)
              byte_set(buffer, position + 1, 2)
              position = position + 2
              let continuation_argument_next_field_offset_written = write_u32_leb(buffer, position, continuation_argument_next_field_index * 4)
              position = position + u32_leb_length(continuation_argument_next_field_index * 4)
              continuation_separator = next_token(source, continuation_argument_next_field.start + continuation_argument_next_field.length)
            } else {
              continuation_separator = continuation_after_operand
            }
            byte_set(buffer, position, arithmetic_opcode(source, continuation_argument_arithmetic))
            position = position + 1
          }
          if is_symbol(source, continuation_separator, 44) == 1 {
            continuation_argument = next_token(source, continuation_separator.start + continuation_separator.length)
          } else {
            continuation_argument = continuation_separator
          }
        }
        byte_set(buffer, position, 16)
        position = position + 1
        let continuation_called_index = function_index_in_table(source, table, continuation_operand)
        let continuation_call_written = write_u32_leb(buffer, position, continuation_called_index)
        position = position + u32_leb_length(continuation_called_index)
        current = next_token(source, continuation_argument.start + continuation_argument.length)
      } else {
        position = write_operand(buffer, position, source, function, continuation_operand)
      }
    }
    while is_arithmetic_operator(source, current) == 1 {
      let continuation_operator = current
      let continuation_next_operand = next_token(source, continuation_operator.start + continuation_operator.length)
      position = write_operand(buffer, position, source, function, continuation_next_operand)
      byte_set(buffer, position, arithmetic_opcode(source, continuation_operator))
      position = position + 1
      current = next_token(source, continuation_next_operand.start + continuation_next_operand.length)
    }
    byte_set(buffer, position, 33)
    position = position + 1
    let continuation_local_written = write_u32_leb(buffer, position, local_index)
    position = position + u32_leb_length(local_index)
    local_index = local_index + 1
  }
  if is_while_keyword(source, current) == 1 {
    position = write_while_statement(buffer, position, source, table, function, current)
    let continuation_while = parse_while_statement(source, current.start)
    current = next_token(source, continuation_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    position = write_local_return_conditional(buffer, position, source, table, function, current)
    let continuation_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, continuation_conditional.position)
  }
  if is_while_keyword(source, current) == 1 {
    position = write_while_statement(buffer, position, source, table, function, current)
    let second_continuation_while = parse_while_statement(source, current.start)
    current = next_token(source, second_continuation_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    position = write_local_return_conditional(buffer, position, source, table, function, current)
    let second_continuation_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, second_continuation_conditional.position)
  }
  while is_let_keyword(source, current) == 1 {
    let third_continuation_name = next_token(source, current.start + current.length)
    let third_continuation_equals = next_token(source, third_continuation_name.start + third_continuation_name.length)
    let third_continuation_operand = next_token(source, third_continuation_equals.start + third_continuation_equals.length)
    position = write_operand(buffer, position, source, function, third_continuation_operand)
    current = next_token(source, third_continuation_operand.start + third_continuation_operand.length)
    if is_symbol(source, current, 40) == 1 {
      let third_continuation_argument = next_token(source, current.start + current.length)
      while is_symbol(source, third_continuation_argument, 41) == 0 {
        position = write_operand(buffer, position, source, function, third_continuation_argument)
        let third_continuation_separator = next_token(source, third_continuation_argument.start + third_continuation_argument.length)
        if is_symbol(source, third_continuation_separator, 46) == 1 {
          let third_continuation_argument_field = next_token(source, third_continuation_separator.start + third_continuation_separator.length)
          let third_continuation_argument_field_index = local_struct_field_index(source, table, function, third_continuation_argument, third_continuation_argument_field)
          byte_set(buffer, position, 40)
          byte_set(buffer, position + 1, 2)
          position = position + 2
          let third_continuation_argument_field_written = write_u32_leb(buffer, position, third_continuation_argument_field_index * 4)
          position = position + u32_leb_length(third_continuation_argument_field_index * 4)
          third_continuation_separator = next_token(source, third_continuation_argument_field.start + third_continuation_argument_field.length)
        }
        while is_arithmetic_operator(source, third_continuation_separator) == 1 {
          let third_continuation_argument_arithmetic = third_continuation_separator
          let third_continuation_argument_operand = next_token(source, third_continuation_argument_arithmetic.start + third_continuation_argument_arithmetic.length)
          position = write_operand(buffer, position, source, function, third_continuation_argument_operand)
          third_continuation_separator = next_token(source, third_continuation_argument_operand.start + third_continuation_argument_operand.length)
          if is_symbol(source, third_continuation_separator, 46) == 1 {
            let third_continuation_argument_next_field = next_token(source, third_continuation_separator.start + third_continuation_separator.length)
            let third_continuation_argument_next_field_index = local_struct_field_index(source, table, function, third_continuation_argument_operand, third_continuation_argument_next_field)
            byte_set(buffer, position, 40)
            byte_set(buffer, position + 1, 2)
            position = position + 2
            let third_continuation_argument_next_field_written = write_u32_leb(buffer, position, third_continuation_argument_next_field_index * 4)
            position = position + u32_leb_length(third_continuation_argument_next_field_index * 4)
            third_continuation_separator = next_token(source, third_continuation_argument_next_field.start + third_continuation_argument_next_field.length)
          }
          byte_set(buffer, position, arithmetic_opcode(source, third_continuation_argument_arithmetic))
          position = position + 1
        }
        if is_symbol(source, third_continuation_separator, 44) == 1 {
          third_continuation_argument = next_token(source, third_continuation_separator.start + third_continuation_separator.length)
        } else {
          third_continuation_argument = third_continuation_separator
        }
      }
      byte_set(buffer, position, 16)
      position = position + 1
      let third_continuation_called_index = function_index_in_table(source, table, third_continuation_operand)
      let third_continuation_call_written = write_u32_leb(buffer, position, third_continuation_called_index)
      position = position + u32_leb_length(third_continuation_called_index)
      current = next_token(source, third_continuation_argument.start + third_continuation_argument.length)
    }
    while is_arithmetic_operator(source, current) == 1 {
      let third_continuation_arithmetic = current
      let third_continuation_next_operand = next_token(source, third_continuation_arithmetic.start + third_continuation_arithmetic.length)
      position = write_operand(buffer, position, source, function, third_continuation_next_operand)
      byte_set(buffer, position, arithmetic_opcode(source, third_continuation_arithmetic))
      position = position + 1
      current = next_token(source, third_continuation_next_operand.start + third_continuation_next_operand.length)
    }
    byte_set(buffer, position, 33)
    position = position + 1
    let third_continuation_local_written = write_u32_leb(buffer, position, local_index)
    position = position + u32_leb_length(local_index)
    local_index = local_index + 1
  }
  if is_while_keyword(source, current) == 1 {
    position = write_while_statement(buffer, position, source, table, function, current)
    let third_continuation_while = parse_while_statement(source, current.start)
    current = next_token(source, third_continuation_while.position)
  }
  while is_if_keyword(source, current) == 1 {
    position = write_local_return_conditional(buffer, position, source, table, function, current)
    let third_continuation_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, third_continuation_conditional.position)
  }
  let returned = next_token(source, current.start + current.length)
  let return_open = next_token(source, returned.start + returned.length)
  if is_symbol(source, return_open, 40) == 1 {
    let constructor_argument = next_token(source, return_open.start + return_open.length)
    let constructor_offset = 0
    while is_symbol(source, constructor_argument, 41) == 0 {
      byte_set(buffer, position, 65)
      byte_set(buffer, position + 1, 0)
      position = position + 2
      position = write_operand(buffer, position, source, function, constructor_argument)
      let constructor_separator = next_token(source, constructor_argument.start + constructor_argument.length)
      while is_arithmetic_operator(source, constructor_separator) == 1 {
        let constructor_arithmetic = constructor_separator
        let constructor_arithmetic_operand = next_token(source, constructor_arithmetic.start + constructor_arithmetic.length)
        position = write_operand(buffer, position, source, function, constructor_arithmetic_operand)
        byte_set(buffer, position, arithmetic_opcode(source, constructor_arithmetic))
        position = position + 1
        constructor_separator = next_token(source, constructor_arithmetic_operand.start + constructor_arithmetic_operand.length)
      }
      byte_set(buffer, position, 54)
      byte_set(buffer, position + 1, 2)
      position = position + 2
      let constructor_offset_written = write_u32_leb(buffer, position, constructor_offset)
      position = position + u32_leb_length(constructor_offset)
      if is_symbol(source, constructor_separator, 44) == 1 {
        constructor_argument = next_token(source, constructor_separator.start + constructor_separator.length)
      } else {
        constructor_argument = constructor_separator
      }
      constructor_offset = constructor_offset + 4
    }
    byte_set(buffer, position, 65)
    byte_set(buffer, position + 1, 0)
    byte_set(buffer, position + 2, 11)
    return buffer
  }
  position = write_operand(buffer, position, source, function, returned)
  let return_current = return_open
  if is_symbol(source, return_current, 46) == 1 {
    let return_field = next_token(source, return_current.start + return_current.length)
    let return_field_index = local_struct_field_index(source, table, function, returned, return_field)
    byte_set(buffer, position, 40)
    byte_set(buffer, position + 1, 2)
    position = position + 2
    let return_field_offset_written = write_u32_leb(buffer, position, return_field_index * 4)
    position = position + u32_leb_length(return_field_index * 4)
    return_current = next_token(source, return_field.start + return_field.length)
  }
  while is_arithmetic_operator(source, return_current) == 1 {
    let return_arithmetic = return_current
    let return_operand = next_token(source, return_arithmetic.start + return_arithmetic.length)
    position = write_operand(buffer, position, source, function, return_operand)
    let return_after_operand = next_token(source, return_operand.start + return_operand.length)
    if is_symbol(source, return_after_operand, 46) == 1 {
      let return_operand_field = next_token(source, return_after_operand.start + return_after_operand.length)
      let return_operand_field_index = local_struct_field_index(source, table, function, return_operand, return_operand_field)
      byte_set(buffer, position, 40)
      byte_set(buffer, position + 1, 2)
      position = position + 2
      let return_operand_field_offset_written = write_u32_leb(buffer, position, return_operand_field_index * 4)
      position = position + u32_leb_length(return_operand_field_index * 4)
      return_after_operand = next_token(source, return_operand_field.start + return_operand_field.length)
    }
    byte_set(buffer, position, arithmetic_opcode(source, return_arithmetic))
    position = position + 1
    return_current = return_after_operand
  }
  byte_set(buffer, position, 11)
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
  if body_kind == 4 {
    body_length = conditional_body_length(source, table, first_function(source))
  }
  if body_kind == 5 {
    body_length = struct_constructor_body_length(source, first_function(source))
  }
  if body_kind == 6 {
    body_length = local_body_length(source, table, first_function(source))
  }
  let code_payload_length = 1 + u32_leb_length(body_length) + body_length
  let memory_section_length = 0
  let memory_required = 0
  if body_kind == 5 {
    memory_required = 1
  }
  if body_kind == 6 {
    let function_close = function_parameter_close(source, first_function(source))
    let function_minus = next_token(source, function_close.start + function_close.length)
    let function_arrow = next_token(source, function_minus.start + function_minus.length)
    let function_result_type = next_token(source, function_arrow.start + function_arrow.length)
    if struct_field_count(source, function_result_type) >= 0 {
      memory_required = 1
    }
  }
  if memory_required == 1 {
    memory_section_length = 5
    export_payload_length = export_payload_length + 9
  }
  let output_length = 8 + 1 + u32_leb_length(type_payload_length) + type_payload_length + 1 + u32_leb_length(function_payload_length) + function_payload_length + memory_section_length + 1 + u32_leb_length(export_payload_length) + export_payload_length + 1 + u32_leb_length(code_payload_length) + code_payload_length
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
  let parameter_index = 0
  while parameter_index < parameter_count {
    byte_set(parameter_count_written, position, 127)
    position = position + 1
    parameter_index = parameter_index + 1
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
  if memory_required == 1 {
    byte_set(type_index_written, position, 5)
    byte_set(type_index_written, position + 1, 3)
    byte_set(type_index_written, position + 2, 1)
    byte_set(type_index_written, position + 3, 0)
    byte_set(type_index_written, position + 4, 1)
    position = position + 5
  }
  byte_set(type_index_written, position, 7)
  position = position + 1
  let export_length_written = write_u32_leb(output, position, export_payload_length)
  position = position + u32_leb_length(export_payload_length)
  let export_count = 1
  if memory_required == 1 {
    export_count = 2
  }
  let export_count_written = write_u32_leb(export_length_written, position, export_count)
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
  if memory_required == 1 {
    byte_set(export_index_written, position, 6)
    byte_set(export_index_written, position + 1, 109)
    byte_set(export_index_written, position + 2, 101)
    byte_set(export_index_written, position + 3, 109)
    byte_set(export_index_written, position + 4, 111)
    byte_set(export_index_written, position + 5, 114)
    byte_set(export_index_written, position + 6, 121)
    byte_set(export_index_written, position + 7, 2)
    byte_set(export_index_written, position + 8, 0)
    position = position + 9
  }
  byte_set(export_index_written, position, 10)
  position = position + 1
  let code_length_written = write_u32_leb(output, position, code_payload_length)
  position = position + u32_leb_length(code_payload_length)
  let code_count_written = write_u32_leb(code_length_written, position, 1)
  position = position + 1
  let body_length_written = write_u32_leb(code_count_written, position, body_length)
  position = position + u32_leb_length(body_length)
  if body_kind == 4 {
    return write_conditional_body(output, position, source, table, first_function(source))
  }
  if body_kind == 5 {
    return write_struct_constructor_body(output, position, source, first_function(source))
  }
  if body_kind == 6 {
    return write_local_body(output, position, source, table, first_function(source))
  }
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
    if sized_body_kind == 3 {
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
    if sized_body_kind == 4 {
      body_length = conditional_body_length(source, table, function_at_index(source, index))
    }
    if sized_body_kind == 5 {
      body_length = struct_constructor_body_length(source, function_at_index(source, index))
    }
    if sized_body_kind == 6 {
      body_length = local_body_length(source, table, function_at_index(source, index))
    }
    code_payload_length = code_payload_length + u32_leb_length(body_length) + body_length
    index = index + 1
  }
  let last_name_start = array_get(table, (count - 1) * 7 + 1)
  let last_name_length = array_get(table, (count - 1) * 7 + 2)
  let type_payload_length = u32_leb_length(count)
  let function_payload_length = u32_leb_length(count)
  index = 0
  while index < count {
    let type_parameter_count = array_get(table, index * 7 + 3)
    type_payload_length = type_payload_length + 3 + u32_leb_length(type_parameter_count) + type_parameter_count
    function_payload_length = function_payload_length + u32_leb_length(index)
    index = index + 1
  }
  let memory_required = 0
  let memory_function = first_function(source)
  index = 0
  while index < count {
    if function_returns_struct(source, memory_function) == 1 {
      memory_required = 1
    }
    index = index + 1
    if index < count {
      let next_memory_function = next_token(source, memory_function.position)
      memory_function = parse_function(source, next_memory_function.start)
    }
  }
  let memory_section_length = 0
  let export_count = 1
  let export_payload_length = u32_leb_length(export_count) + u32_leb_length(last_name_length) + last_name_length + 1 + u32_leb_length(count - 1)
  if memory_required == 1 {
    memory_section_length = 5
    export_count = 2
    export_payload_length = u32_leb_length(export_count) + u32_leb_length(last_name_length) + last_name_length + 1 + u32_leb_length(count - 1) + 9
  }
  let output_length = 8 + 1 + u32_leb_length(type_payload_length) + type_payload_length + 1 + u32_leb_length(function_payload_length) + function_payload_length + memory_section_length + 1 + u32_leb_length(export_payload_length) + export_payload_length + 1 + u32_leb_length(code_payload_length) + code_payload_length
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
  let type_count_written = write_u32_leb(type_length_written, position, count)
  position = position + u32_leb_length(count)
  index = 0
  while index < count {
    byte_set(type_count_written, position, 96)
    position = position + 1
    let emitted_parameter_count = array_get(table, index * 7 + 3)
    let emitted_parameter_count_written = write_u32_leb(output, position, emitted_parameter_count)
    position = position + u32_leb_length(emitted_parameter_count)
    let emitted_parameter_index = 0
    while emitted_parameter_index < emitted_parameter_count {
      byte_set(emitted_parameter_count_written, position, 127)
      position = position + 1
      emitted_parameter_index = emitted_parameter_index + 1
    }
    byte_set(output, position, 1)
    byte_set(output, position + 1, 127)
    position = position + 2
    index = index + 1
  }
  byte_set(output, position, 3)
  position = position + 1
  let function_length_written = write_u32_leb(output, position, function_payload_length)
  position = position + u32_leb_length(function_payload_length)
  let function_count_written = write_u32_leb(function_length_written, position, count)
  position = position + u32_leb_length(count)
  index = 0
  while index < count {
    let type_index_written = write_u32_leb(function_count_written, position, index)
    position = position + u32_leb_length(index)
    index = index + 1
  }
  if memory_required == 1 {
    byte_set(output, position, 5)
    byte_set(output, position + 1, 3)
    byte_set(output, position + 2, 1)
    byte_set(output, position + 3, 0)
    byte_set(output, position + 4, 1)
    position = position + 5
  }
  byte_set(output, position, 7)
  position = position + 1
  let export_length_written = write_u32_leb(output, position, export_payload_length)
  position = position + u32_leb_length(export_payload_length)
  let export_count_written = write_u32_leb(export_length_written, position, export_count)
  position = position + u32_leb_length(export_count)
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
  if memory_required == 1 {
    byte_set(export_index_written, position, 6)
    byte_set(export_index_written, position + 1, 109)
    byte_set(export_index_written, position + 2, 101)
    byte_set(export_index_written, position + 3, 109)
    byte_set(export_index_written, position + 4, 111)
    byte_set(export_index_written, position + 5, 114)
    byte_set(export_index_written, position + 6, 121)
    byte_set(export_index_written, position + 7, 2)
    byte_set(export_index_written, position + 8, 0)
    position = position + 9
  }
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
    if body_kind == 3 {
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
    if body_kind == 4 {
      emitted_body_length = conditional_body_length(source, table, function_at_index(source, index))
    }
    if body_kind == 5 {
      emitted_body_length = struct_constructor_body_length(source, function_at_index(source, index))
    }
    if body_kind == 6 {
      emitted_body_length = local_body_length(source, table, function_at_index(source, index))
    }
    let body_length_written = write_u32_leb(code_count_written, position, emitted_body_length)
    position = position + u32_leb_length(emitted_body_length)
    if body_kind == 5 {
      let constructor_written = write_struct_constructor_body(output, position, source, function_at_index(source, index))
      position = position + emitted_body_length
    } else {
      if body_kind == 6 {
        let local_written = write_local_body(output, position, source, table, function_at_index(source, index))
        position = position + emitted_body_length
      } else {
        if body_kind == 4 {
          let conditional_written = write_conditional_body(output, position, source, table, function_at_index(source, index))
          position = position + emitted_body_length
        } else {
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
        }
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
        return compile_diagnostic(3, current_function.name_start, 0)
      }
    }
    if body_kind == 2 {
      let called_index = array_get(table, index * 7 + 5)
      let called_token = returned_value_token(source, current_function)
      let argument_token = call_argument_token(source, current_function)
      if called_index < 0 {
        return compile_diagnostic(2, called_token.start, 0)
      }
      let argument_kind = array_get(table, index * 7 + 6)
      let argument_count = 0
      if argument_kind != 0 {
        argument_count = 1
      }
      if array_get(table, called_index * 7 + 3) != argument_count {
        return compile_diagnostic(3, argument_token.start, 0)
      }
      if argument_kind == 2 {
        if parameter_count != 1 {
          return compile_diagnostic(3, argument_token.start, 0)
        }
      }
    }
    index = index + 1
    if index < count {
      let next = next_token(source, current_function.position)
      current_function = parse_function(source, next.start)
    }
  }
  return compile_diagnostic(0, 0, 0)
}

export fn alloc(size: i32) -> i32 {
  let bytes = allocate_bytes(size)
  return byte_pointer(bytes)
}

fn success_record(output: bytes) -> i32 {
  let record = allocate_bytes(36)
  let status = write_i32(record, 0, 0)
  let output_pointer = write_i32(status, 4, byte_pointer(output))
  let output_length = write_i32(output_pointer, 8, byte_length(output))
  let diagnostic_pointer = write_i32(output_length, 12, 0)
  let diagnostic_length = write_i32(diagnostic_pointer, 16, 0)
  let diagnostic_code = write_i32(diagnostic_length, 20, 0)
  let diagnostic_offset = write_i32(diagnostic_code, 24, 0)
  let diagnostic_source_length = write_i32(diagnostic_offset, 28, 0)
  let diagnostic_expected = write_i32(diagnostic_source_length, 32, 0)
  return byte_pointer(diagnostic_expected)
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

fn diagnostic_record(source: bytes, kind: i32, offset: i32, expected: i32) -> i32 {
  let prefix_length = diagnostic_prefix_length(kind)
  let offset_length = decimal_length(offset)
  let diagnostic = allocate_bytes(prefix_length + 4 + offset_length)
  let prefix_written = write_diagnostic_prefix(diagnostic, kind)
  byte_set(prefix_written, prefix_length, 32)
  byte_set(prefix_written, prefix_length + 1, 97)
  byte_set(prefix_written, prefix_length + 2, 116)
  byte_set(prefix_written, prefix_length + 3, 32)
  let diagnostic_written = write_decimal(prefix_written, prefix_length + 4, offset)
  let diagnostic_token = next_token(source, offset)
  let record = allocate_bytes(36)
  let status = write_i32(record, 0, 1)
  let output_pointer = write_i32(status, 4, 0)
  let output_length = write_i32(output_pointer, 8, 0)
  let diagnostic_pointer = write_i32(output_length, 12, byte_pointer(diagnostic_written))
  let diagnostic_length = write_i32(diagnostic_pointer, 16, byte_length(diagnostic_written))
  let diagnostic_code = write_i32(diagnostic_length, 20, kind)
  let diagnostic_offset = write_i32(diagnostic_code, 24, offset)
  let diagnostic_source_length = write_i32(diagnostic_offset, 28, diagnostic_token.length)
  let diagnostic_expected = write_i32(diagnostic_source_length, 32, expected)
  return byte_pointer(diagnostic_expected)
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
          return diagnostic_record(source, diagnostic.kind, diagnostic.offset, diagnostic.expected)
        }
      }
    }
    return success_record(output)
  }

  let parse_diagnostic = program_diagnostic(source)
  return diagnostic_record(source, parse_diagnostic.kind, parse_diagnostic.offset, parse_diagnostic.expected)
}
```

The initial bootstrap contract maps an empty or whitespace-only source to the
valid, empty Wasm module `00 61 73 6d 01 00 00 00`. `next_token()` skips ASCII
whitespace and `//` comments, and distinguishes EOF, ASCII identifiers, integers, and symbols;
identifier and integer tokens have their complete source range. The temporary
`token_summary()` export is an integration-test probe. The `compile()` export
returns a pointer to the 36-byte result record described in the Matra Program
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
