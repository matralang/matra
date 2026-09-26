# Bootstrap compiler

統一文法の native compiler profile を使用する。正本は
[`unified-grammar.ja.md`](../../../spec/unified-grammar.ja.md) を参照する。
型と memory ABI は維持し、条件は丸括弧で囲み、文は改行で区切る。

`do { ... } until (condition)` は既存sourceと互換の追加構文です。
bodyを1回実行してから条件を評価し、0なら反復します。`break` は最内周のloopを終了します。
parse・length・writerは同じstatement境界を使い、Wasmでは `block` / `loop` の2 frameを使います。
条件は既存の整数式、またはその比較を受理します。`until` と条件の丸括弧は必須です。

```compiler.matra
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
  if (value == 9) {
    return 1
  }
  if (value == 10) {
    return 1
  }
  if (value == 13) {
    return 1
  }
  if (value == 32) {
    return 1
  }
  return 0
}

fn is_identifier(value: i32) -> i32 {
  if (value >= 65) {
    if (value <= 90) {
      return 1
    }
  }
  if (value >= 97) {
    if (value <= 122) {
      return 1
    }
  }
  if (value == 95) {
    return 1
  }
  return 0
}

fn is_digit(value: i32) -> i32 {
  if (value >= 48) {
    if (value <= 57) {
      return 1
    }
  }
  return 0
}

fn next_token(source: bytes, offset: i32) -> token {
  let position = offset
  let source_length = byte_length(source)
  while (position < source_length) {
    let value = byte_at(source, position)
    if (is_space(value) == 1) {
      position = position + 1
    } else {
      if (value == 47) {
        if (position + 1 < source_length) {
          if (byte_at(source, position + 1) == 47) {
            position = position + 2
            while (position < source_length) {
              if (byte_at(source, position) == 10) {
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
  if (position == source_length) {
    return token(0, position, 0)
  }

  let start = position
  let first = byte_at(source, position)
  if (is_identifier(first) == 1) {
    position = position + 1
    while (position < source_length) {
      if (is_identifier(byte_at(source, position)) == 1) {
        position = position + 1
      } else {
        if (is_digit(byte_at(source, position)) == 1) {
          position = position + 1
        } else {
          break
        }
      }
    }
    return token(1, start, position - start)
  }
  if (is_digit(first) == 1) {
    position = position + 1
    while (position < source_length) {
      if (is_digit(byte_at(source, position)) == 1) {
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
  if (value.length != 6) {
    return 0
  }
  if (byte_at(source, value.start) != 109) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 111) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 100) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 117) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 108) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 101) {
    return 0
  }
  return 1
}

fn is_import_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 6) {
    return 0
  }
  if (byte_at(source, value.start) != 105) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 109) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 112) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 111) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 116) {
    return 0
  }
  return 1
}

fn is_struct_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 6) {
    return 0
  }
  if (byte_at(source, value.start) != 115) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 117) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 99) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 116) {
    return 0
  }
  return 1
}

fn is_fn_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 2) {
    return 0
  }
  if (byte_at(source, value.start) != 102) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 110) {
    return 0
  }
  return 1
}

fn is_export_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 6) {
    return 0
  }
  if (byte_at(source, value.start) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 120) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 112) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 111) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 116) {
    return 0
  }
  return 1
}

fn is_return_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 6) {
    return 0
  }
  if (byte_at(source, value.start) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 117) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 110) {
    return 0
  }
  return 1
}

fn is_if_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 2) {
    return 0
  }
  if (byte_at(source, value.start) != 105) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 102) {
    return 0
  }
  return 1
}

fn is_else_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 4) {
    return 0
  }
  if (byte_at(source, value.start) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 108) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 115) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 101) {
    return 0
  }
  return 1
}

fn is_loop_keyword(source: bytes, value: token) -> i32 {
  if (is_do_keyword(source, value) == 1) { return 1 }
  if (value.length != 5) {
    return 0
  }
  if (byte_at(source, value.start) != 119) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 104) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 105) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 108) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 101) {
    return 0
  }
  return 1
}

fn is_do_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 2) { return 0 }
  if (byte_at(source, value.start) != 100) { return 0 }
  if (byte_at(source, value.start + 1) != 111) { return 0 }
  return 1
}

fn is_until_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 5) { return 0 }
  if (byte_at(source, value.start) != 117) { return 0 }
  if (byte_at(source, value.start + 1) != 110) { return 0 }
  if (byte_at(source, value.start + 2) != 116) { return 0 }
  if (byte_at(source, value.start + 3) != 105) { return 0 }
  if (byte_at(source, value.start + 4) != 108) { return 0 }
  return 1
}

fn is_break_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 5) {
    return 0
  }
  if (byte_at(source, value.start) != 98) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 107) {
    return 0
  }
  return 1
}

fn is_let_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 3) {
    return 0
  }
  if (byte_at(source, value.start) != 108) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 116) {
    return 0
  }
  return 1
}

fn is_set_keyword(source: bytes, value: token) -> i32 {
  if (value.length != 3) {
    return 0
  }
  if (byte_at(source, value.start) != 115) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 116) {
    return 0
  }
  return 1
}

fn condition_left(source: bytes, statement: token) -> token {
  let left = next_token(source, statement.start + statement.length)
  if (is_symbol(source, left, 40) == 1) {
    return next_token(source, left.start + left.length)
  }
  return left
}

fn condition_is_parenthesized(source: bytes, statement: token) -> i32 {
  let first = next_token(source, statement.start + statement.length)
  return is_symbol(source, first, 40)
}

fn condition_block_open(source: bytes, expression_end_token: token) -> token {
  if (is_symbol(source, expression_end_token, 41) == 1) {
    return next_token(source, expression_end_token.start + expression_end_token.length)
  }
  return expression_end_token
}

fn is_array_set_call(source: bytes, value: token) -> i32 {
  if (value.length == 8) {
    if (byte_at(source, value.start) == 98) {
      if (byte_at(source, value.start + 1) == 121) {
        if (byte_at(source, value.start + 2) == 116) {
          if (byte_at(source, value.start + 3) == 101) {
            if (byte_at(source, value.start + 4) == 95) {
              if (byte_at(source, value.start + 5) == 115) {
                if (byte_at(source, value.start + 6) == 101) {
                  if (byte_at(source, value.start + 7) == 116) {
                    return 1
                  }
                }
              }
            }
          }
        }
      }
    }
    return 0
  }
  if (value.length != 9) {
    return 0
  }
  if (byte_at(source, value.start) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 121) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 95) {
    return 0
  }
  if (byte_at(source, value.start + 6) != 115) {
    return 0
  }
  if (byte_at(source, value.start + 7) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 8) != 116) {
    return 0
  }
  return 1
}

fn is_array_get_call(source: bytes, value: token) -> i32 {
  if (value.length != 9) {
    return 0
  }
  if (byte_at(source, value.start) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 121) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 95) {
    return 0
  }
  if (byte_at(source, value.start + 6) != 103) {
    return 0
  }
  if (byte_at(source, value.start + 7) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 8) != 116) {
    return 0
  }
  return 1
}

fn is_byte_at_call(source: bytes, value: token) -> i32 {
  if (value.length != 7) {
    return 0
  }
  if (byte_at(source, value.start) != 98) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 121) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 95) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 6) != 116) {
    return 0
  }
  return 1
}

fn is_token_constructor(source: bytes, value: token) -> i32 {
  if (value.length != 5) {
    return 0
  }
  if (byte_at(source, value.start) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 111) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 107) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 110) {
    return 0
  }
  return 1
}

fn is_byte_length_call(source: bytes, value: token) -> i32 {
  if (value.length != 11) {
    return 0
  }
  if (byte_at(source, value.start + 0) != 98) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 121) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 95) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 108) {
    return 0
  }
  if (byte_at(source, value.start + 6) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 7) != 110) {
    return 0
  }
  if (byte_at(source, value.start + 8) != 103) {
    return 0
  }
  if (byte_at(source, value.start + 9) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 10) != 104) {
    return 0
  }
  return 1
}

fn is_byte_pointer_call(source: bytes, value: token) -> i32 {
  if (value.length != 12) {
    return 0
  }
  if (byte_at(source, value.start + 0) != 98) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 121) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 95) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 112) {
    return 0
  }
  if (byte_at(source, value.start + 6) != 111) {
    return 0
  }
  if (byte_at(source, value.start + 7) != 105) {
    return 0
  }
  if (byte_at(source, value.start + 8) != 110) {
    return 0
  }
  if (byte_at(source, value.start + 9) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 10) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 11) != 114) {
    return 0
  }
  return 1
}

fn is_allocate_i32_array_call(source: bytes, value: token) -> i32 {
  if (value.length != 18) {
    return 0
  }
  if (byte_at(source, value.start) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 108) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 108) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 111) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 99) {
    return 0
  }
  if (byte_at(source, value.start + 5) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 6) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 7) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 8) != 95) {
    return 0
  }
  if (byte_at(source, value.start + 9) != 105) {
    return 0
  }
  if (byte_at(source, value.start + 10) != 51) {
    return 0
  }
  if (byte_at(source, value.start + 11) != 50) {
    return 0
  }
  if (byte_at(source, value.start + 12) != 95) {
    return 0
  }
  if (byte_at(source, value.start + 13) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 14) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 15) != 114) {
    return 0
  }
  if (byte_at(source, value.start + 16) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 17) != 121) {
    return 0
  }
  return 1
}

fn is_allocate_bytes_call(source: bytes, value: token) -> i32 {
  if (value.length != 14) {
    return 0
  }
  if (byte_at(source, value.start) != 97) {
    return 0
  }
  if (byte_at(source, value.start + 8) != 95) {
    return 0
  }
  if (byte_at(source, value.start + 9) != 98) {
    return 0
  }
  if (byte_at(source, value.start + 10) != 121) {
    return 0
  }
  if (byte_at(source, value.start + 11) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 12) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 13) != 115) {
    return 0
  }
  return 1
}

fn is_i32_type(source: bytes, value: token) -> i32 {
  if (value.length != 3) {
    return 0
  }
  if (byte_at(source, value.start) != 105) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 51) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 50) {
    return 0
  }
  return 1
}

fn is_bytes_type(source: bytes, value: token) -> i32 {
  if (value.length != 5) {
    return 0
  }
  if (byte_at(source, value.start) != 98) {
    return 0
  }
  if (byte_at(source, value.start + 1) != 121) {
    return 0
  }
  if (byte_at(source, value.start + 2) != 116) {
    return 0
  }
  if (byte_at(source, value.start + 3) != 101) {
    return 0
  }
  if (byte_at(source, value.start + 4) != 115) {
    return 0
  }
  return 1
}

fn type_end(source: bytes, value: token) -> token {
  if (is_symbol(source, value, 91) == 1) {
    let element = next_token(source, value.start + value.length)
    return next_token(source, element.start + element.length)
  }
  return value
}

fn is_i32_array_type(source: bytes, value: token) -> i32 {
  if (is_symbol(source, value, 91) == 0) {
    return 0
  }
  let element = next_token(source, value.start + value.length)
  if (is_i32_type(source, element) == 0) {
    return 0
  }
  let close = next_token(source, element.start + element.length)
  return is_symbol(source, close, 93)
}

fn is_symbol(source: bytes, value: token, expected: i32) -> i32 {
  if (value.kind != 3) {
    return 0
  }
  if (value.length != 1) {
    return 0
  }
  if (byte_at(source, value.start) != expected) {
    return 0
  }
  return 1
}

fn read_small_integer(source: bytes, value: token) -> i32 {
  let result = 0
  let position = value.start
  while (position < value.start + value.length) {
    result = result * 10 + byte_at(source, position) - 48
    position = position + 1
  }
  return result
}

fn negate_i32(value: i32) -> i32 {
  let zero = 0
  return zero - value
}

fn same_token(source: bytes, left: token, right: token) -> i32 {
  if (left.length != right.length) {
    return 0
  }
  let index = 0
  while (index < left.length) {
    if (byte_at(source, left.start + index) != byte_at(source, right.start + index)) {
      return 0
    }
    index = index + 1
  }
  return 1
}

fn parse_struct(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  let name = next_token(source, keyword.start + keyword.length)
  if (name.kind != 1) {
    return function_definition(0, 0, 0, 0, offset, name.start, 2)
  }
  let open = next_token(source, name.start + name.length)
  if (is_symbol(source, open, 123) == 0) {
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
  }
  let field = next_token(source, open.start + open.length)
  while (is_symbol(source, field, 125) == 0) {
    if (field.kind != 1) {
      return function_definition(0, 0, 0, 0, offset, field.start, 2)
    }
    let colon = next_token(source, field.start + field.length)
    if (is_symbol(source, colon, 58) == 0) {
      return function_definition(0, 0, 0, 0, offset, colon.start, 6)
    }
    let field_type = next_token(source, colon.start + colon.length)
    if (is_i32_type(source, field_type) == 0) {
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
  while (position < byte_length(source)) {
    let keyword = next_token(source, position)
    if (is_import_keyword(source, keyword) == 1) {
      let imported = next_token(source, keyword.start + keyword.length)
      position = imported.start + imported.length
    } else {
      if (is_struct_keyword(source, keyword) == 0) {
        return -1
      }
      let name = next_token(source, keyword.start + keyword.length)
      let open = next_token(source, name.start + name.length)
      let field = next_token(source, open.start + open.length)
      let count = 0
      while (is_symbol(source, field, 125) == 0) {
        count = count + 1
        let colon = next_token(source, field.start + field.length)
        let field_type = next_token(source, colon.start + colon.length)
        field = next_token(source, field_type.start + field_type.length)
      }
      if (same_token(source, name, struct_name) == 1) {
        return count
      }
      position = field.start + field.length
    }
  }
  return -1
}

fn parse_conditional_statement(source: bytes, offset: i32, parameter: token) -> function_definition {
    let keyword = next_token(source, offset)
  let left = condition_left(source, keyword)
  if (left.kind != 1) {
      return function_definition(0, 0, 0, 0, offset, left.start, 12)
    }
    let operator = next_token(source, left.start + left.length)
    if (is_symbol(source, operator, 46) == 1) {
      let left_field = next_token(source, operator.start + operator.length)
      if (left_field.kind != 1) {
        return function_definition(0, 0, 0, 0, offset, left_field.start, 2)
      }
      operator = next_token(source, left_field.start + left_field.length)
    }
    if (is_symbol(source, operator, 40) == 1) {
      let call_argument = next_token(source, operator.start + operator.length)
      while (is_symbol(source, call_argument, 41) == 0) {
        if (call_argument.kind != 1) {
          if (call_argument.kind != 2) {
            return function_definition(0, 0, 0, 0, offset, call_argument.start, 13)
          }
        }
        let call_separator = next_token(source, call_argument.start + call_argument.length)
        if (is_symbol(source, call_separator, 46) == 1) {
          let call_field = next_token(source, call_separator.start + call_separator.length)
          if (call_field.kind != 1) {
            return function_definition(0, 0, 0, 0, offset, call_field.start, 2)
          }
          call_separator = next_token(source, call_field.start + call_field.length)
        }
        while (is_arithmetic_operator(source, call_separator) == 1) {
          let call_operand = next_token(source, call_separator.start + call_separator.length)
          if (call_operand.kind != 1) {
            if (call_operand.kind != 2) {
              return function_definition(0, 0, 0, 0, offset, call_operand.start, 13)
            }
          }
          call_separator = next_token(source, call_operand.start + call_operand.length)
          if (is_symbol(source, call_separator, 46) == 1) {
            let call_operand_field = next_token(source, call_separator.start + call_separator.length)
            if (call_operand_field.kind != 1) {
              return function_definition(0, 0, 0, 0, offset, call_operand_field.start, 2)
            }
            call_separator = next_token(source, call_operand_field.start + call_operand_field.length)
          }
        }
        if (is_symbol(source, call_separator, 44) == 1) {
          call_argument = next_token(source, call_separator.start + call_separator.length)
        } else {
          call_argument = call_separator
        }
      }
      operator = next_token(source, call_argument.start + call_argument.length)
    }
    if (operator.kind != 3) {
      return function_definition(0, 0, 0, 0, offset, operator.start, 13)
    }
    let right = next_token(source, operator.start + operator.length)
    if (is_symbol(source, operator, 61) == 1) {
      if (is_symbol(source, right, 61) == 1) {
        right = next_token(source, right.start + right.length)
      } else {
        if (right.kind != 1) {
          if (right.kind != 2) {
            return function_definition(0, 0, 0, 0, offset, right.start, 13)
          }
        }
      }
    } else {
      if (is_symbol(source, operator, 33) == 1) {
        if (is_symbol(source, right, 61) == 0) {
          return function_definition(0, 0, 0, 0, offset, right.start, 13)
        }
        right = next_token(source, right.start + right.length)
      } else {
        if (is_symbol(source, operator, 60) == 0) {
          if (is_symbol(source, operator, 62) == 0) {
            return function_definition(0, 0, 0, 0, offset, operator.start, 13)
          }
        }
        if (is_symbol(source, right, 61) == 1) {
          right = next_token(source, right.start + right.length)
        }
      }
    }
    if (right.kind != 1) {
      if (right.kind != 2) {
        return function_definition(0, 0, 0, 0, offset, right.start, 13)
      }
    }
    let right_end = next_token(source, right.start + right.length)
    if (is_symbol(source, right_end, 46) == 1) {
      let right_field = next_token(source, right_end.start + right_end.length)
      if (right_field.kind != 1) {
        return function_definition(0, 0, 0, 0, offset, right_field.start, 2)
      }
      right_end = next_token(source, right_field.start + right_field.length)
    }
    if (is_symbol(source, right_end, 40) == 1) {
      let condition_call_argument = next_token(source, right_end.start + right_end.length)
      while (is_symbol(source, condition_call_argument, 41) == 0) {
        if (condition_call_argument.kind != 1) {
          if (condition_call_argument.kind != 2) {
            return function_definition(0, 0, 0, 0, offset, condition_call_argument.start, 13)
          }
        }
        let condition_call_separator = next_token(source, condition_call_argument.start + condition_call_argument.length)
        if (is_symbol(source, condition_call_separator, 46) == 1) {
          let condition_call_field = next_token(source, condition_call_separator.start + condition_call_separator.length)
          if (condition_call_field.kind != 1) {
            return function_definition(0, 0, 0, 0, offset, condition_call_field.start, 2)
          }
          condition_call_separator = next_token(source, condition_call_field.start + condition_call_field.length)
        }
        while (is_arithmetic_operator(source, condition_call_separator) == 1) {
          let condition_arithmetic_operand = next_token(source, condition_call_separator.start + condition_call_separator.length)
          if (condition_arithmetic_operand.kind != 1) {
            if (condition_arithmetic_operand.kind != 2) {
              return function_definition(0, 0, 0, 0, offset, condition_arithmetic_operand.start, 13)
            }
          }
          condition_call_separator = next_token(source, condition_arithmetic_operand.start + condition_arithmetic_operand.length)
          if (is_symbol(source, condition_call_separator, 46) == 1) {
            let condition_arithmetic_field = next_token(source, condition_call_separator.start + condition_call_separator.length)
            if (condition_arithmetic_field.kind != 1) {
              return function_definition(0, 0, 0, 0, offset, condition_arithmetic_field.start, 2)
            }
            condition_call_separator = next_token(source, condition_arithmetic_field.start + condition_arithmetic_field.length)
          }
        }
        if (is_symbol(source, condition_call_separator, 44) == 1) {
          condition_call_argument = next_token(source, condition_call_separator.start + condition_call_separator.length)
        } else {
          condition_call_argument = condition_call_separator
        }
      }
      right_end = next_token(source, condition_call_argument.start + condition_call_argument.length)
    }
    while (is_arithmetic_operator(source, right_end) == 1) {
      let right_arithmetic_operand = next_token(source, right_end.start + right_end.length)
      if (right_arithmetic_operand.kind != 1) {
        if (right_arithmetic_operand.kind != 2) {
          return function_definition(0, 0, 0, 0, offset, right_arithmetic_operand.start, 13)
        }
      }
      right_end = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
      if (is_symbol(source, right_end, 46) == 1) {
        let right_arithmetic_field = next_token(source, right_end.start + right_end.length)
        if (right_arithmetic_field.kind != 1) {
          return function_definition(0, 0, 0, 0, offset, right_arithmetic_field.start, 2)
        }
        right_end = next_token(source, right_arithmetic_field.start + right_arithmetic_field.length)
      }
    }
    let open = condition_block_open(source, right_end)
    if (is_symbol(source, open, 123) == 0) {
      return function_definition(0, 0, 0, 0, offset, open.start, 10)
    } else {
      let current = next_token(source, open.start + open.length)
    while (is_symbol(source, current, 125) == 0) {
      if (is_array_set_call(source, current) == 1) {
        current = expression_end(source, current)
      } else {
      if (is_if_keyword(source, current) == 1) {
        let nested = parse_conditional_statement(source, current.start, parameter)
        if (nested.status == 0) {
          return nested
        }
        current = next_token(source, nested.position)
      } else {
        if (is_loop_keyword(source, current) == 1) {
          let nested_while = parse_while_statement(source, current.start)
          if (nested_while.status == 0) {
            return nested_while
          }
          current = next_token(source, nested_while.position)
        } else {
        if (is_return_keyword(source, current) == 1) {
          let returned_value = next_token(source, current.start + current.length)
          if (returned_value.kind != 1) {
            if (returned_value.kind != 2) {
              return function_definition(0, 0, 0, 0, offset, returned_value.start, 13)
            }
          }
          current = expression_end(source, returned_value)
        } else {
          let assignment = current
          let assignment_name_token = assignment_name(source, assignment)
          if (is_set_keyword(source, assignment) == 1) {
            let set_open = next_token(source, assignment.start + assignment.length)
            if (is_symbol(source, set_open, 40) == 0) {
              return function_definition(0, 0, 0, 0, offset, set_open.start, 4)
            }
          }
          if (assignment_name_token.kind != 1) {
            return function_definition(0, 0, 0, 0, offset, assignment_name_token.start, 2)
          }
          let assignment_equals = next_token(source, assignment_name_token.start + assignment_name_token.length)
          if (is_symbol(source, assignment_equals, 61) == 0) {
            return function_definition(0, 0, 0, 0, offset, assignment_equals.start, 13)
          }
          let assignment_value = assignment_operand(source, assignment)
          if (is_symbol(source, assignment_value, 45) == 1) {
            assignment_value = next_token(source, assignment_value.start + assignment_value.length)
          }
          if (assignment_value.kind != 1) {
            if (assignment_value.kind != 2) {
              return function_definition(0, 0, 0, 0, offset, assignment_value.start, 13)
            }
          }
          let assignment_value_end = expression_end(source, assignment_value)
          let after_assignment_keyword = next_token(source, assignment.start + assignment.length)
          if (is_symbol(source, after_assignment_keyword, 40) == 1) {
            if (is_symbol(source, assignment_value_end, 41) == 0) {
              return function_definition(0, 0, 0, 0, offset, assignment_value_end.start, 14)
            }
          }
          current = assignment_end(source, assignment)
        }
        }
      }
      }
    }
    let after_then = next_token(source, current.start + current.length)
    if (is_else_keyword(source, after_then) == 1) {
      let else_open = next_token(source, after_then.start + after_then.length)
      if (is_symbol(source, else_open, 123) == 0) {
        return function_definition(0, 0, 0, 0, offset, else_open.start, 10)
      }
      let else_current = next_token(source, else_open.start + else_open.length)
      while (is_symbol(source, else_current, 125) == 0) {
        if (is_array_set_call(source, else_current) == 1) {
          else_current = expression_end(source, else_current)
        } else {
        if (is_if_keyword(source, else_current) == 1) {
          let else_nested = parse_conditional_statement(source, else_current.start, parameter)
          if (else_nested.status == 0) {
            return else_nested
          }
          else_current = next_token(source, else_nested.position)
        } else {
          if (is_loop_keyword(source, else_current) == 1) {
            let else_nested_while = parse_while_statement(source, else_current.start)
            if (else_nested_while.status == 0) {
              return else_nested_while
            }
            else_current = next_token(source, else_nested_while.position)
          } else {
          if (is_return_keyword(source, else_current) == 1) {
            let else_returned_value = next_token(source, else_current.start + else_current.length)
            if (is_symbol(source, else_returned_value, 45) == 1) {
              let else_negative_value = next_token(source, else_returned_value.start + else_returned_value.length)
              if (else_negative_value.kind != 2) {
                return function_definition(0, 0, 0, 0, offset, else_negative_value.start, 13)
              }
              else_current = next_token(source, else_negative_value.start + else_negative_value.length)
            } else {
              if (else_returned_value.kind != 1) {
                if (else_returned_value.kind != 2) {
                  return function_definition(0, 0, 0, 0, offset, else_returned_value.start, 13)
                }
              }
              else_current = expression_end(source, else_returned_value)
            }
          } else {
            if (else_current.kind != 1) {
              return function_definition(0, 0, 0, 0, offset, else_current.start, 2)
            }
            if (is_let_keyword(source, else_current) == 1) {
              else_current = next_token(source, else_current.start + else_current.length)
            }
            let else_assignment_equals = next_token(source, else_current.start + else_current.length)
            if (is_symbol(source, else_assignment_equals, 61) == 0) {
              return function_definition(0, 0, 0, 0, offset, else_assignment_equals.start, 13)
            }
            let else_assignment_operand = next_token(source, else_assignment_equals.start + else_assignment_equals.length)
            else_current = expression_end(source, else_assignment_operand)
          }
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
  return function_definition(1, 0, 0, 0, 0, 0, 0)
}

fn is_arithmetic_operator(source: bytes, value: token) -> i32 {
  if (is_symbol(source, value, 43) == 1) {
    return 1
  }
  if (is_symbol(source, value, 45) == 1) {
    return 1
  }
  if (is_symbol(source, value, 42) == 1) {
    return 1
  }
  return is_symbol(source, value, 47)
}

fn function_index_length(source: bytes, table: [i32], value: token) -> i32 {
  let index = function_index_in_table(source, table, value)
  return u32_leb_length(index)
}

fn variable_index_length(source: bytes, function: function_definition, value: token) -> i32 {
  let index = variable_index(source, function, value)
  if (index < 0) {
    index = lexical_variable_index(source, function, value)
  }
  return u32_leb_length(index)
}

fn operand_end(source: bytes, operand: token) -> token {
  if (is_symbol(source, operand, 45) == 1) {
    let positive = next_token(source, operand.start + operand.length)
    return operand_end(source, positive)
  }
  if (operand.kind != 1) {
    if (operand.kind != 2) {
      return operand
    }
  }
  let current = next_token(source, operand.start + operand.length)
  if (is_symbol(source, current, 40) == 1) {
    let argument = next_token(source, current.start + current.length)
    while (is_symbol(source, argument, 41) == 0) {
      let separator = expression_end(source, argument)
      if (separator.kind == 0) {
        return separator
      }
      if (is_symbol(source, separator, 44) == 1) {
        argument = next_token(source, separator.start + separator.length)
      } else {
        if (is_symbol(source, separator, 41) == 0) {
          return separator
        }
        argument = separator
      }
    }
    current = next_token(source, argument.start + argument.length)
  }
  if (is_symbol(source, current, 46) == 1) {
    let field = next_token(source, current.start + current.length)
    if (field.kind != 1) {
      return field
    }
    current = next_token(source, field.start + field.length)
  }
  return current
}

fn expression_end(source: bytes, operand: token) -> token {
  let current = operand_end(source, operand)
  while (is_arithmetic_operator(source, current) == 1) {
    let next_operand = next_token(source, current.start + current.length)
    let end = operand_end(source, next_operand)
    if (end.kind == 0) {
      return end
    }
    current = end
  }
  return current
}

fn parse_loop_conditional_break(source: bytes, statement: token) -> function_definition {
  let next = next_token(source, statement.start + statement.length)
  return function_definition(1, 0, 0, 0, next.start, 0, 0)
}

fn parse_loop_conditional_if(source: bytes, statement: token) -> function_definition {
  let nested_left = condition_left(source, statement)
  let nested_open = next_token(source, nested_left.start + nested_left.length)
  let nested = function_definition(0, 0, 0, 0, statement.start, 0, 0)
  if (is_symbol(source, nested_open, 40) == 1) {
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

// 条件の左右式と block 内の文を分離し、let/set の括弧と入れ子を全経路で共有する。
fn parse_conditional_block(source: bytes, open: token) -> function_definition {
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (current.kind == 0) { return function_definition(0, 0, 0, 0, open.start, current.start, 15) }
    let parsed = parse_do_body_statement(source, current)
    if (parsed.status == 0) { return parsed }
    if (parsed.position <= current.start) { return function_definition(0, 0, 0, 0, open.start, current.start, 12) }
    current = next_token(source, parsed.position)
  }
  let after = next_token(source, current.start + current.length)
  if (is_else_keyword(source, after) == 1) {
    let other = next_token(source, after.start + after.length)
    if (is_symbol(source, other, 123) == 0) { return function_definition(0, 0, 0, 0, open.start, other.start, 10) }
    return parse_conditional_block(source, other)
  }
  return function_definition(1, 0, 0, 0, current.start + current.length, 0, 0)
}

fn parse_loop_conditional(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  let called = condition_left(source, keyword)
  let call_open = next_token(source, called.start + called.length)
  if (is_symbol(source, call_open, 40) == 0) {
    return function_definition(0, 0, 0, 0, offset, call_open.start, 4)
  }
  let argument = next_token(source, call_open.start + call_open.length)
  while (is_symbol(source, argument, 41) == 0) {
    if (argument.kind != 1) {
      if (argument.kind != 2) {
        return function_definition(0, 0, 0, 0, offset, argument.start, 13)
      }
    }
    let separator = next_token(source, argument.start + argument.length)
    if (is_symbol(source, separator, 46) == 1) {
      let argument_field = next_token(source, separator.start + separator.length)
      if (argument_field.kind != 1) {
        return function_definition(0, 0, 0, 0, offset, argument_field.start, 2)
      }
      separator = next_token(source, argument_field.start + argument_field.length)
    } else {
      if (is_symbol(source, separator, 40) == 1) {
        let nested_argument_operand = next_token(source, separator.start + separator.length)
        while (is_symbol(source, nested_argument_operand, 41) == 0) {
          if (nested_argument_operand.kind != 1) {
            if (nested_argument_operand.kind != 2) {
              return function_definition(0, 0, 0, 0, offset, nested_argument_operand.start, 13)
            }
          }
          let nested_argument_separator = next_token(source, nested_argument_operand.start + nested_argument_operand.length)
          if (is_symbol(source, nested_argument_separator, 44) == 1) {
            nested_argument_operand = next_token(source, nested_argument_separator.start + nested_argument_separator.length)
          } else {
            nested_argument_operand = nested_argument_separator
          }
        }
        separator = next_token(source, nested_argument_operand.start + nested_argument_operand.length)
      }
    }
    while (is_arithmetic_operator(source, separator) == 1) {
      let next_argument_operand = next_token(source, separator.start + separator.length)
      if (next_argument_operand.kind != 1) {
        if (next_argument_operand.kind != 2) {
          return function_definition(0, 0, 0, 0, offset, next_argument_operand.start, 13)
        }
      }
      separator = next_token(source, next_argument_operand.start + next_argument_operand.length)
    }
    if (is_symbol(source, separator, 44) == 1) {
      argument = next_token(source, separator.start + separator.length)
    } else {
      argument = separator
    }
  }
  let operator = next_token(source, argument.start + argument.length)
  let right = next_token(source, operator.start + operator.length)
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  if (right.kind != 1) {
    if (right.kind != 2) {
      return function_definition(0, 0, 0, 0, offset, right.start, 13)
    }
  }
  let open = next_token(source, right.start + right.length)
  if (is_symbol(source, open, 40) == 1) {
    let right_argument = next_token(source, open.start + open.length)
    while (is_symbol(source, right_argument, 41) == 0) {
      if (right_argument.kind != 1) {
        if (right_argument.kind != 2) {
          return function_definition(0, 0, 0, 0, offset, right_argument.start, 13)
        }
      }
      let right_separator = next_token(source, right_argument.start + right_argument.length)
      if (is_symbol(source, right_separator, 46) == 1) {
        let right_argument_field = next_token(source, right_separator.start + right_separator.length)
        if (right_argument_field.kind != 1) {
          return function_definition(0, 0, 0, 0, offset, right_argument_field.start, 2)
        }
        right_separator = next_token(source, right_argument_field.start + right_argument_field.length)
      }
      while (is_arithmetic_operator(source, right_separator) == 1) {
        let right_arithmetic_operand = next_token(source, right_separator.start + right_separator.length)
        if (right_arithmetic_operand.kind != 1) {
          if (right_arithmetic_operand.kind != 2) {
            return function_definition(0, 0, 0, 0, offset, right_arithmetic_operand.start, 13)
          }
        }
        right_separator = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
      }
      if (is_symbol(source, right_separator, 44) == 1) {
        right_argument = next_token(source, right_separator.start + right_separator.length)
      } else {
        right_argument = right_separator
      }
    }
    open = next_token(source, right_argument.start + right_argument.length)
  }
  open = condition_block_open(source, open)
  if (is_symbol(source, open, 123) == 0) {
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
  }
  return parse_conditional_block(source, open)
}

fn parse_loop_local_conditional(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  let left = condition_left(source, keyword)
  let left_operator = next_token(source, left.start + left.length)
  let operator = left_operator
  let right = next_token(source, operator.start + operator.length)
  if (is_symbol(source, left_operator, 46) == 1) {
    let left_field = next_token(source, left_operator.start + left_operator.length)
    if (left_field.kind != 1) {
      return function_definition(0, 0, 0, 0, offset, left_field.start, 2)
    }
    operator = next_token(source, left_field.start + left_field.length)
    right = next_token(source, operator.start + operator.length)
  }
  if (is_arithmetic_operator(source, left_operator) == 1) {
    operator = next_token(source, right.start + right.length)
    right = next_token(source, operator.start + operator.length)
  }
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  if (right.kind != 1) {
    if (right.kind != 2) {
      return function_definition(0, 0, 0, 0, offset, right.start, 13)
    }
  }
  let right_end_token = expression_end(source, right)
  let open = condition_block_open(source, right_end_token)
  if (is_symbol(source, open, 123) == 0) {
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
  }
  return parse_conditional_block(source, open)
}

fn parse_do_until_statement(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  let open = next_token(source, keyword.start + keyword.length)
  if (is_symbol(source, open, 123) == 0) {
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
  }
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (current.kind == 0) {
      return function_definition(0, 0, 0, 0, offset, current.start, 10)
    }
    let body_statement = parse_do_body_statement(source, current)
    if (body_statement.status == 0) { return body_statement }
    current = next_token(source, body_statement.position)
  }
  let until_token = next_token(source, current.start + current.length)
  if (is_until_keyword(source, until_token) == 0) {
    return function_definition(0, 0, 0, 0, offset, until_token.start, 13)
  }
  let condition_open = next_token(source, until_token.start + until_token.length)
  if (is_symbol(source, condition_open, 40) == 0) {
    return function_definition(0, 0, 0, 0, offset, condition_open.start, 13)
  }
  let left = next_token(source, condition_open.start + condition_open.length)
  let left_result = parse_loop_value(source, left)
  if (left_result.status == 0) { return left_result }
  let operator = next_token(source, left_result.position)
  if (is_symbol(source, operator, 41) == 1) {
    return function_definition(1, 0, 0, 0, operator.start + operator.length, 0, 0)
  }
  let right = next_token(source, operator.start + operator.length)
  let comparison = 0
  if (is_symbol(source, operator, 60) == 1) { comparison = 1 }
  if (is_symbol(source, operator, 62) == 1) { comparison = 1 }
  if (is_symbol(source, operator, 61) == 1) {
    if (is_symbol(source, right, 61) == 1) { comparison = 1 }
  }
  if (is_symbol(source, operator, 33) == 1) {
    if (is_symbol(source, right, 61) == 1) { comparison = 1 }
  }
  if (comparison == 0) { return function_definition(0, 0, 0, 0, offset, operator.start, 13) }
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  let right_result = parse_loop_value(source, right)
  if (right_result.status == 0) { return right_result }
  let close = next_token(source, right_result.position)
  if (is_symbol(source, close, 41) == 0) {
    return function_definition(0, 0, 0, 0, offset, close.start, 13)
  }
  return function_definition(1, 0, 0, 0, close.start + close.length, 0, 0)
}

fn parse_loop_value(source: bytes, operand: token) -> function_definition {
  let value = operand
  if (is_symbol(source, value, 45) == 1) {
    value = next_token(source, value.start + value.length)
  }
  if (value.kind != 1) {
    if (value.kind != 2) { return function_definition(0, 0, 0, 0, operand.start, value.start, 13) }
  }
  let current = next_token(source, value.start + value.length)
  if (is_symbol(source, current, 40) == 1) {
    current = next_token(source, current.start + current.length)
    while (is_symbol(source, current, 41) == 0) {
      let argument = parse_loop_value(source, current)
      if (argument.status == 0) { return argument }
      current = next_token(source, argument.position)
      if (is_symbol(source, current, 44) == 1) {
        current = next_token(source, current.start + current.length)
        if (is_symbol(source, current, 41) == 1) {
          return function_definition(0, 0, 0, 0, operand.start, current.start, 13)
        }
      } else {
        if (is_symbol(source, current, 41) == 0) {
          return function_definition(0, 0, 0, 0, operand.start, current.start, 14)
        }
      }
    }
    current = next_token(source, current.start + current.length)
  }
  if (is_symbol(source, current, 46) == 1) {
    let field = next_token(source, current.start + current.length)
    if (field.kind != 1) { return function_definition(0, 0, 0, 0, operand.start, field.start, 2) }
    current = next_token(source, field.start + field.length)
  }
  if (is_arithmetic_operator(source, current) == 1) {
    let right = next_token(source, current.start + current.length)
    return parse_loop_value(source, right)
  }
  return function_definition(1, 0, 0, 0, current.start, 0, 0)
}

fn parse_do_body_statement(source: bytes, statement: token) -> function_definition {
  if (is_loop_keyword(source, statement) == 1) {
    return parse_while_statement(source, statement.start)
  }
  if (is_if_keyword(source, statement) == 1) {
    return parse_loop_conditional_if(source, statement)
  }
  if (is_break_keyword(source, statement) == 1) {
    return function_definition(1, 0, 0, 0, statement.start + statement.length, 0, 0)
  }
  if (is_return_keyword(source, statement) == 1) {
    let returned = next_token(source, statement.start + statement.length)
    return parse_loop_value(source, returned)
  }
  if (is_array_set_call(source, statement) == 1) {
    return parse_loop_value(source, statement)
  }
  if (is_local_assignment(source, statement) == 0) {
    return function_definition(0, 0, 0, 0, statement.start, statement.start, 13)
  }
  let name = assignment_name(source, statement)
  if (name.kind != 1) { return function_definition(0, 0, 0, 0, statement.start, name.start, 2) }
  let equals = next_token(source, name.start + name.length)
  if (is_symbol(source, equals, 61) == 0) {
    return function_definition(0, 0, 0, 0, statement.start, equals.start, 13)
  }
  let value = next_token(source, equals.start + equals.length)
  let result = parse_loop_value(source, value)
  if (result.status == 0) { return result }
  let end = next_token(source, result.position)
  let after_keyword = next_token(source, statement.start + statement.length)
  if (is_symbol(source, after_keyword, 40) == 1) {
    if (is_symbol(source, end, 41) == 0) {
      return function_definition(0, 0, 0, 0, statement.start, end.start, 14)
    }
    return function_definition(1, 0, 0, 0, end.start + end.length, 0, 0)
  }
  if (is_set_keyword(source, statement) == 1) {
    return function_definition(0, 0, 0, 0, statement.start, after_keyword.start, 4)
  }
  return result
}

fn parse_while_statement(source: bytes, offset: i32) -> function_definition {
  let loop_keyword = next_token(source, offset)
  if (is_do_keyword(source, loop_keyword) == 1) {
    return parse_do_until_statement(source, offset)
  }
  let keyword = next_token(source, offset)
  let left = condition_left(source, keyword)
  if (left.kind != 1) {
    return function_definition(0, 0, 0, 0, offset, left.start, 13)
  }
  let operator = next_token(source, left.start + left.length)
  if (is_symbol(source, operator, 46) == 1) {
    let left_field = next_token(source, operator.start + operator.length)
    if (left_field.kind != 1) {
      return function_definition(0, 0, 0, 0, offset, left_field.start, 2)
    }
    operator = next_token(source, left_field.start + left_field.length)
  }
  if (is_symbol(source, operator, 40) == 1) {
    let condition_argument = next_token(source, operator.start + operator.length)
    while (is_symbol(source, condition_argument, 41) == 0) {
      if (condition_argument.kind != 1) {
        if (condition_argument.kind != 2) {
          return function_definition(0, 0, 0, 0, offset, condition_argument.start, 13)
        }
      }
      let condition_separator = next_token(source, condition_argument.start + condition_argument.length)
      if (is_symbol(source, condition_separator, 46) == 1) {
        let condition_field = next_token(source, condition_separator.start + condition_separator.length)
        if (condition_field.kind != 1) {
          return function_definition(0, 0, 0, 0, offset, condition_field.start, 2)
        }
        condition_separator = next_token(source, condition_field.start + condition_field.length)
      }
      while (is_arithmetic_operator(source, condition_separator) == 1) {
        let condition_arithmetic_operand = next_token(source, condition_separator.start + condition_separator.length)
        if (condition_arithmetic_operand.kind != 1) {
          if (condition_arithmetic_operand.kind != 2) {
            return function_definition(0, 0, 0, 0, offset, condition_arithmetic_operand.start, 13)
          }
        }
        condition_separator = next_token(source, condition_arithmetic_operand.start + condition_arithmetic_operand.length)
        if (is_symbol(source, condition_separator, 46) == 1) {
          let condition_arithmetic_field = next_token(source, condition_separator.start + condition_separator.length)
          if (condition_arithmetic_field.kind != 1) {
            return function_definition(0, 0, 0, 0, offset, condition_arithmetic_field.start, 2)
          }
          condition_separator = next_token(source, condition_arithmetic_field.start + condition_arithmetic_field.length)
        }
      }
      if (is_symbol(source, condition_separator, 44) == 1) {
        condition_argument = next_token(source, condition_separator.start + condition_separator.length)
      } else {
        condition_argument = condition_separator
      }
    }
    operator = next_token(source, condition_argument.start + condition_argument.length)
  }
  if (operator.kind != 3) {
    return function_definition(0, 0, 0, 0, offset, operator.start, 13)
  }
  let right = next_token(source, operator.start + operator.length)
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  if (right.kind != 1) {
    if (right.kind != 2) {
      return function_definition(0, 0, 0, 0, offset, right.start, 13)
    }
  }
  let right_end = next_token(source, right.start + right.length)
  if (is_symbol(source, right_end, 46) == 1) {
    let right_field = next_token(source, right_end.start + right_end.length)
    if (right_field.kind != 1) {
      return function_definition(0, 0, 0, 0, offset, right_field.start, 2)
    }
    right_end = next_token(source, right_field.start + right_field.length)
  }
  if (is_symbol(source, right_end, 40) == 1) {
    let condition_call_argument = next_token(source, right_end.start + right_end.length)
    while (is_symbol(source, condition_call_argument, 41) == 0) {
      if (condition_call_argument.kind != 1) {
        if (condition_call_argument.kind != 2) {
          return function_definition(0, 0, 0, 0, offset, condition_call_argument.start, 13)
        }
      }
      let condition_call_separator = next_token(source, condition_call_argument.start + condition_call_argument.length)
      if (is_symbol(source, condition_call_separator, 44) == 1) {
        condition_call_argument = next_token(source, condition_call_separator.start + condition_call_separator.length)
      } else {
        condition_call_argument = condition_call_separator
      }
    }
    right_end = next_token(source, condition_call_argument.start + condition_call_argument.length)
  }
  while (is_arithmetic_operator(source, right_end) == 1) {
    let right_arithmetic_operand = next_token(source, right_end.start + right_end.length)
    if (right_arithmetic_operand.kind != 1) {
      if (right_arithmetic_operand.kind != 2) {
        return function_definition(0, 0, 0, 0, offset, right_arithmetic_operand.start, 13)
      }
    }
    right_end = next_token(source, right_arithmetic_operand.start + right_arithmetic_operand.length)
    if (is_symbol(source, right_end, 46) == 1) {
      let right_arithmetic_field = next_token(source, right_end.start + right_end.length)
      if (right_arithmetic_field.kind != 1) {
        return function_definition(0, 0, 0, 0, offset, right_arithmetic_field.start, 2)
      }
      right_end = next_token(source, right_arithmetic_field.start + right_arithmetic_field.length)
    }
  }
  let open = condition_block_open(source, right_end)
  if (is_symbol(source, open, 123) == 0) {
    return function_definition(0, 0, 0, 0, offset, open.start, 10)
  } else {
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (is_array_set_call(source, current) == 1) {
      current = expression_end(source, current)
    } else {
    if (is_loop_keyword(source, current) == 1) {
      let nested_while = parse_while_statement(source, current.start)
      if (nested_while.status == 0) {
        return nested_while
      }
      current = next_token(source, nested_while.position)
    } else {
      if (is_if_keyword(source, current) == 1) {
        let conditional_left = condition_left(source, current)
        let conditional_open = next_token(source, conditional_left.start + conditional_left.length)
        let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, conditional_open, 40) == 1) {
          let loop_conditional_first = next_token(source, conditional_open.start + conditional_open.length)
          if (is_return_keyword(source, loop_conditional_first) == 1) {
            conditional = parse_local_return_conditional(source, current.start)
          } else {
            conditional = parse_loop_conditional(source, current.start)
          }
        } else {
          conditional = parse_loop_local_conditional(source, current.start)
        }
        if (conditional.status == 0) {
          return conditional
        }
        current = next_token(source, conditional.position)
      } else {
        let assignment = current
        let target = assignment_name(source, assignment)
        if (is_set_keyword(source, assignment) == 1) {
          let set_open = next_token(source, assignment.start + assignment.length)
          if (is_symbol(source, set_open, 40) == 0) {
            return function_definition(0, 0, 0, 0, offset, set_open.start, 4)
          }
        }
        if (target.kind != 1) {
          return function_definition(0, 0, 0, 0, offset, target.start, 2)
        }
        let equals = next_token(source, target.start + target.length)
        if (is_symbol(source, equals, 61) == 0) {
          return function_definition(0, 0, 0, 0, offset, equals.start, 13)
        }
        let operand = assignment_operand(source, assignment)
        let parsed_value = parse_loop_value(source, operand)
        if (parsed_value.status == 0) { return parsed_value }
        current = next_token(source, parsed_value.position)
        let after_assignment_keyword = next_token(source, assignment.start + assignment.length)
        if (is_symbol(source, after_assignment_keyword, 40) == 1) {
          if (is_symbol(source, current, 41) == 0) {
            return function_definition(0, 0, 0, 0, offset, current.start, 14)
          }
          current = next_token(source, current.start + current.length)
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
  // return を含む block も、入れ子と引数式を扱う共通 conditional parser で読む。
  let statement = next_token(source, offset)
  return parse_loop_conditional_if(source, statement)
}

fn is_local_assignment(source: bytes, statement: token) -> i32 {
  if (is_let_keyword(source, statement) == 1) {
    return 1
  }
  if (is_set_keyword(source, statement) == 1) {
    return 1
  }
  if (statement.kind != 1) {
    return 0
  }
  if (is_return_keyword(source, statement) == 1) {
    return 0
  }
  let equals = next_token(source, statement.start + statement.length)
  return is_symbol(source, equals, 61)
}

fn parse_local_body(source: bytes, offset: i32, name: token) -> function_definition {
  let current = next_token(source, offset)
  while (is_return_keyword(source, current) == 0) {
    if (is_local_assignment(source, current) == 0) {
      if (is_loop_keyword(source, current) == 0) {
        if (is_if_keyword(source, current) == 0) {
          if (is_array_set_call(source, current) == 0) {
            return function_definition(0, 0, 0, 0, offset, current.start, 11)
          }
        }
      }
    }
    while (is_local_assignment(source, current) == 1) {
      let assignment = current
      let local_name = current
      if (is_let_keyword(source, current) == 1) {
        local_name = next_token(source, current.start + current.length)
      }
      if (is_set_keyword(source, current) == 1) {
        local_name = next_token(source, current.start + current.length)
        if (is_symbol(source, local_name, 40) == 0) {
          return function_definition(0, 0, 0, 0, offset, local_name.start, 4)
        }
        local_name = next_token(source, local_name.start + local_name.length)
      } else {
        if (is_symbol(source, local_name, 40) == 1) {
          local_name = next_token(source, local_name.start + local_name.length)
        }
      }
      if (local_name.kind != 1) {
        return function_definition(0, 0, 0, 0, offset, local_name.start, 2)
      }
      let equals = next_token(source, local_name.start + local_name.length)
      if (is_symbol(source, equals, 61) == 0) {
        return function_definition(0, 0, 0, 0, offset, equals.start, 13)
      }
      let operand = next_token(source, equals.start + equals.length)
      if (is_symbol(source, operand, 45) == 1) {
        operand = next_token(source, operand.start + operand.length)
      }
      if (operand.kind != 1) {
        if (operand.kind != 2) {
          return function_definition(0, 0, 0, 0, offset, operand.start, 13)
        }
      }
      current = next_token(source, operand.start + operand.length)
      if (is_symbol(source, current, 46) == 1) {
        let field = next_token(source, current.start + current.length)
        if (field.kind != 1) {
          return function_definition(0, 0, 0, 0, offset, field.start, 2)
        }
        current = next_token(source, field.start + field.length)
      }
      if (is_symbol(source, current, 40) == 1) {
        let argument = next_token(source, current.start + current.length)
        while (is_symbol(source, argument, 41) == 0) {
          if (is_symbol(source, argument, 45) == 1) {
            argument = next_token(source, argument.start + argument.length)
          }
          if (argument.kind != 1) {
            if (argument.kind != 2) {
              return function_definition(0, 0, 0, 0, offset, argument.start, 13)
            }
          }
          let argument_separator = next_token(source, argument.start + argument.length)
          if (is_symbol(source, argument_separator, 40) == 1) {
            argument_separator = operand_end(source, argument)
          }
          if (is_symbol(source, argument_separator, 46) == 1) {
            let argument_field = next_token(source, argument_separator.start + argument_separator.length)
            if (argument_field.kind != 1) {
              return function_definition(0, 0, 0, 0, offset, argument_field.start, 2)
            }
            argument_separator = next_token(source, argument_field.start + argument_field.length)
          }
          while (is_arithmetic_operator(source, argument_separator) == 1) {
            let argument_next_operand = next_token(source, argument_separator.start + argument_separator.length)
            if (argument_next_operand.kind != 1) {
              if (argument_next_operand.kind != 2) {
                return function_definition(0, 0, 0, 0, offset, argument_next_operand.start, 13)
              }
            }
            argument_separator = next_token(source, argument_next_operand.start + argument_next_operand.length)
            if (is_symbol(source, argument_separator, 46) == 1) {
              let argument_next_field = next_token(source, argument_separator.start + argument_separator.length)
              if (argument_next_field.kind != 1) {
                return function_definition(0, 0, 0, 0, offset, argument_next_field.start, 2)
              }
              argument_separator = next_token(source, argument_next_field.start + argument_next_field.length)
            }
          }
          if (is_symbol(source, argument_separator, 44) == 1) {
            argument = next_token(source, argument_separator.start + argument_separator.length)
          } else {
            argument = argument_separator
          }
        }
        current = next_token(source, argument.start + argument.length)
      }
      while (is_arithmetic_operator(source, current) == 1) {
        let next_operand = next_token(source, current.start + current.length)
        if (next_operand.kind != 1) {
          if (next_operand.kind != 2) {
            return function_definition(0, 0, 0, 0, offset, next_operand.start, 13)
          }
        }
        current = next_token(source, next_operand.start + next_operand.length)
        if (is_symbol(source, current, 46) == 1) {
          let next_field = next_token(source, current.start + current.length)
          if (next_field.kind != 1) {
            return function_definition(0, 0, 0, 0, offset, next_field.start, 2)
          }
          current = next_token(source, next_field.start + next_field.length)
        }
        if (is_symbol(source, current, 40) == 1) {
          let next_argument = next_token(source, current.start + current.length)
          let call_depth = 1
          while (call_depth > 0) {
            if (is_symbol(source, next_argument, 40) == 1) {
              call_depth = call_depth + 1
            }
            if (is_symbol(source, next_argument, 41) == 1) {
              call_depth = call_depth - 1
            }
            if (call_depth == 0) {
              break
            }
            next_argument = next_token(source, next_argument.start + next_argument.length)
          }
          current = next_token(source, next_argument.start + next_argument.length)
        }
      }
      let assignment_open = next_token(source, assignment.start + assignment.length)
      if (is_symbol(source, assignment_open, 40) == 1) {
        if (is_symbol(source, current, 41) == 0) {
          return function_definition(0, 0, 0, 0, offset, current.start, 14)
        }
        current = next_token(source, current.start + current.length)
      }
    }
    while (is_array_set_call(source, current) == 1) {
      current = expression_end(source, current)
    }
    while (is_loop_keyword(source, current) == 1) {
      let statement = parse_while_statement(source, current.start)
      if (statement.status == 0) {
        return statement
      }
      current = next_token(source, statement.position)
    }
    while (is_if_keyword(source, current) == 1) {
      let conditional_left = condition_left(source, current)
      let conditional_operator = next_token(source, conditional_left.start + conditional_left.length)
      let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
      if (is_symbol(source, conditional_operator, 40) == 1) {
        let call_conditional_open = next_token(source, conditional_operator.start + conditional_operator.length)
        let call_conditional_first = next_token(source, call_conditional_open.start + call_conditional_open.length)
        if (is_return_keyword(source, call_conditional_first) == 1) {
          conditional = parse_local_return_conditional(source, current.start)
        } else {
          conditional = parse_loop_conditional(source, current.start)
        }
      } else {
        if (is_symbol(source, conditional_operator, 46) == 1) {
          let conditional_field = next_token(source, conditional_operator.start + conditional_operator.length)
          let conditional_comparison = next_token(source, conditional_field.start + conditional_field.length)
          let conditional_right = next_token(source, conditional_comparison.start + conditional_comparison.length)
          if (is_symbol(source, conditional_right, 61) == 1) {
            conditional_right = next_token(source, conditional_right.start + conditional_right.length)
          }
          let conditional_open = next_token(source, conditional_right.start + conditional_right.length)
          let conditional_first = next_token(source, conditional_open.start + conditional_open.length)
          if (is_return_keyword(source, conditional_first) == 1) {
            conditional = parse_conditional_statement(source, current.start, name)
          } else {
            conditional = parse_local_return_conditional(source, current.start)
          }
        } else {
          conditional = parse_conditional_statement(source, current.start, name)
        }
      }
      if (conditional.status == 0) {
        return conditional
      }
      current = next_token(source, conditional.position)
    }
    while (is_array_set_call(source, current) == 1) {
      current = expression_end(source, current)
    }
  }
  let returned = next_token(source, current.start + current.length)
  if (is_symbol(source, returned, 45) == 1) {
    let negative_returned = next_token(source, returned.start + returned.length)
    if (negative_returned.kind != 2) {
      return function_definition(0, 0, 0, 0, offset, negative_returned.start, 12)
    }
    returned = negative_returned
  } else {
    if (returned.kind != 1) {
      if (returned.kind != 2) {
        return function_definition(0, 0, 0, 0, offset, returned.start, 12)
      }
    }
  }
  let close = next_token(source, returned.start + returned.length)
  if (is_symbol(source, close, 40) == 1) {
    if (struct_field_count(source, returned) < 0) {
      let call_argument = next_token(source, close.start + close.length)
      while (is_symbol(source, call_argument, 41) == 0) {
        let call_separator = next_token(source, call_argument.start + call_argument.length)
        if (is_symbol(source, call_separator, 44) == 1) {
          call_argument = next_token(source, call_separator.start + call_separator.length)
        } else {
          call_argument = call_separator
        }
      }
      close = next_token(source, call_argument.start + call_argument.length)
    } else {
    let constructor_argument = next_token(source, close.start + close.length)
    while (is_symbol(source, constructor_argument, 41) == 0) {
      if (constructor_argument.kind != 1) {
        if (constructor_argument.kind != 2) {
          return function_definition(0, 0, 0, 0, offset, constructor_argument.start, 13)
        }
      }
      let constructor_separator = next_token(source, constructor_argument.start + constructor_argument.length)
      if (is_symbol(source, constructor_separator, 40) == 1) {
        let constructor_call_argument = next_token(source, constructor_separator.start + constructor_separator.length)
        if (is_symbol(source, constructor_call_argument, 41) == 0) {
          if (constructor_call_argument.kind != 1) {
            if (constructor_call_argument.kind != 2) {
              return function_definition(0, 0, 0, 0, offset, constructor_call_argument.start, 13)
            }
          }
          constructor_call_argument = next_token(source, constructor_call_argument.start + constructor_call_argument.length)
          if (is_symbol(source, constructor_call_argument, 44) == 1) {
            constructor_call_argument = next_token(source, constructor_call_argument.start + constructor_call_argument.length)
            constructor_call_argument = next_token(source, constructor_call_argument.start + constructor_call_argument.length)
          }
        }
        constructor_separator = next_token(source, constructor_call_argument.start + constructor_call_argument.length)
      }
      if (is_symbol(source, constructor_separator, 46) == 1) {
        let constructor_field = next_token(source, constructor_separator.start + constructor_separator.length)
        if (constructor_field.kind != 1) {
          return function_definition(0, 0, 0, 0, offset, constructor_field.start, 2)
        }
        constructor_separator = next_token(source, constructor_field.start + constructor_field.length)
      }
      while (is_arithmetic_operator(source, constructor_separator) == 1) {
        let constructor_arithmetic_operand = next_token(source, constructor_separator.start + constructor_separator.length)
        if (constructor_arithmetic_operand.kind != 1) {
          if (constructor_arithmetic_operand.kind != 2) {
            return function_definition(0, 0, 0, 0, offset, constructor_arithmetic_operand.start, 13)
          }
        }
        constructor_separator = next_token(source, constructor_arithmetic_operand.start + constructor_arithmetic_operand.length)
        if (is_symbol(source, constructor_separator, 46) == 1) {
          let constructor_arithmetic_field = next_token(source, constructor_separator.start + constructor_separator.length)
          if (constructor_arithmetic_field.kind != 1) {
            return function_definition(0, 0, 0, 0, offset, constructor_arithmetic_field.start, 2)
          }
          constructor_separator = next_token(source, constructor_arithmetic_field.start + constructor_arithmetic_field.length)
        }
      }
      if (is_symbol(source, constructor_separator, 44) == 1) {
        constructor_argument = next_token(source, constructor_separator.start + constructor_separator.length)
      } else {
        constructor_argument = constructor_separator
      }
    }
    close = next_token(source, constructor_argument.start + constructor_argument.length)
    }
  } else {
    if (is_symbol(source, close, 46) == 1) {
      let return_field = next_token(source, close.start + close.length)
      if (return_field.kind != 1) {
        return function_definition(0, 0, 0, 0, offset, return_field.start, 2)
      }
      close = next_token(source, return_field.start + return_field.length)
    }
    while (is_arithmetic_operator(source, close) == 1) {
      let return_operand = next_token(source, close.start + close.length)
      if (return_operand.kind != 1) {
        if (return_operand.kind != 2) {
          return function_definition(0, 0, 0, 0, offset, return_operand.start, 13)
        }
      }
      close = next_token(source, return_operand.start + return_operand.length)
      if (is_symbol(source, close, 46) == 1) {
        let return_operand_field = next_token(source, close.start + close.length)
        if (return_operand_field.kind != 1) {
          return function_definition(0, 0, 0, 0, offset, return_operand_field.start, 2)
        }
        close = next_token(source, return_operand_field.start + return_operand_field.length)
      }
    }
  }
  if (is_symbol(source, close, 125) == 0) {
    return function_definition(0, 0, 0, 0, offset, close.start, 15)
  }
  return function_definition(1, name.start, name.length, 0, close.start + close.length, 0, 0)
}

fn parse_function(source: bytes, offset: i32) -> function_definition {
  let keyword = next_token(source, offset)
  if (is_export_keyword(source, keyword) == 1) {
    keyword = next_token(source, keyword.start + keyword.length)
  }
  if (is_fn_keyword(source, keyword) == 0) {
    return function_definition(0, 0, 0, 0, offset, keyword.start, 3)
  }
  let name = next_token(source, keyword.start + keyword.length)
  if (name.kind != 1) {
    return function_definition(0, 0, 0, 0, offset, name.start, 2)
  }
  let open = next_token(source, name.start + name.length)
  if (is_symbol(source, open, 40) == 0) {
    return function_definition(0, 0, 0, 0, offset, open.start, 4)
  }
  let parameter = next_token(source, open.start + open.length)
  let close = parameter
  if (is_symbol(source, parameter, 41) == 0) {
    let current_parameter = parameter
    while (is_symbol(source, close, 41) == 0) {
      if (current_parameter.kind != 1) {
        return function_definition(0, 0, 0, 0, offset, current_parameter.start, 5)
      }
      let colon = next_token(source, current_parameter.start + current_parameter.length)
      if (is_symbol(source, colon, 58) == 0) {
        return function_definition(0, 0, 0, 0, offset, colon.start, 6)
      }
      let parameter_type = next_token(source, colon.start + colon.length)
      if (is_i32_type(source, parameter_type) == 0) {
        if (is_bytes_type(source, parameter_type) == 0) {
          if (is_i32_array_type(source, parameter_type) == 0) {
            if (struct_field_count(source, parameter_type) < 0) {
              return function_definition(0, 0, 0, 0, offset, parameter_type.start, 7)
            }
          }
        }
      }
      let parameter_type_end = type_end(source, parameter_type)
      close = next_token(source, parameter_type_end.start + parameter_type_end.length)
      if (is_symbol(source, close, 44) == 1) {
        current_parameter = next_token(source, close.start + close.length)
        close = current_parameter
      } else {
        if (is_symbol(source, close, 41) == 0) {
          return function_definition(0, 0, 0, 0, offset, close.start, 14)
        }
      }
    }
  }
  let minus = next_token(source, close.start + close.length)
  if (is_symbol(source, minus, 45) == 0) {
    return function_definition(0, 0, 0, 0, offset, minus.start, 8)
  }
  let arrow = next_token(source, minus.start + minus.length)
  if (is_symbol(source, arrow, 62) == 0) {
    return function_definition(0, 0, 0, 0, offset, arrow.start, 9)
  }
  let result_type = next_token(source, arrow.start + arrow.length)
  if (is_i32_type(source, result_type) == 0) {
    if (is_bytes_type(source, result_type) == 0) {
      if (is_i32_array_type(source, result_type) == 0) {
        if (struct_field_count(source, result_type) < 0) {
          return function_definition(0, 0, 0, 0, offset, result_type.start, 7)
        }
      }
    }
  }
  let result_type_end = type_end(source, result_type)
  let open_body = next_token(source, result_type_end.start + result_type_end.length)
  if (is_symbol(source, open_body, 123) == 0) {
    return function_definition(0, 0, 0, 0, offset, open_body.start, 10)
  }
  let returned = next_token(source, open_body.start + open_body.length)
  if (is_array_set_call(source, returned) == 1) {
    return parse_local_body(source, returned.start, name)
  }
  if (is_loop_keyword(source, returned) == 1) {
    return parse_local_body(source, returned.start, name)
  }
  if (is_local_assignment(source, returned) == 1) {
    return parse_local_body(source, returned.start, name)
  }
  if (is_if_keyword(source, returned) == 1) {
    return parse_local_body(source, returned.start, name)
  }
  if (is_return_keyword(source, returned) == 0) {
    return function_definition(0, 0, 0, 0, offset, returned.start, 11)
  }
  let returned_value = next_token(source, returned.start + returned.length)
  let return_value = 0
  let value_token = returned_value
  let negative = 0
  if (is_symbol(source, returned_value, 45) == 1) {
    negative = 1
    value_token = next_token(source, returned_value.start + returned_value.length)
  }
  if (value_token.kind == 2) {
    return_value = read_small_integer(source, value_token)
    if (negative == 1) {
      return_value = -return_value
    }
  } else {
    if (negative == 1) {
      return function_definition(0, 0, 0, 0, offset, value_token.start, 13)
    }
    let call_open = next_token(source, returned_value.start + returned_value.length)
    if (is_symbol(source, call_open, 40) == 1) {
      let argument = next_token(source, call_open.start + call_open.length)
      let call_close = argument
      if (is_symbol(source, argument, 41) == 0) {
        let argument_value = argument
        if (is_symbol(source, argument, 45) == 1) {
          argument_value = next_token(source, argument.start + argument.length)
          if (argument_value.kind != 2) {
            return function_definition(0, 0, 0, 0, offset, argument_value.start, 13)
          }
        } else {
          if (argument.kind == 1) {
            let nested_open = next_token(source, argument.start + argument.length)
            if (is_symbol(source, nested_open, 40) == 1) {
              let nested_argument = next_token(source, nested_open.start + nested_open.length)
              let nested_close = nested_argument
              while (is_symbol(source, nested_close, 41) == 0) {
                nested_close = next_token(source, nested_close.start + nested_close.length)
              }
              argument_value = nested_close
            }
          } else {
            if (argument.kind != 2) {
              return function_definition(0, 0, 0, 0, offset, argument.start, 12)
            }
          }
        }
        call_close = next_token(source, argument_value.start + argument_value.length)
        while (is_symbol(source, call_close, 44) == 1) {
          let next_argument = next_token(source, call_close.start + call_close.length)
          let next_argument_value = next_argument
          if (next_argument.kind == 1) {
            let next_nested_open = next_token(source, next_argument.start + next_argument.length)
            if (is_symbol(source, next_nested_open, 40) == 1) {
              let next_nested_argument = next_token(source, next_nested_open.start + next_nested_open.length)
              let next_nested_close = next_nested_argument
              while (is_symbol(source, next_nested_close, 41) == 0) {
                next_nested_close = next_token(source, next_nested_close.start + next_nested_close.length)
              }
              next_argument_value = next_nested_close
            } else {
              if (next_argument.kind != 2) {
                return function_definition(0, 0, 0, 0, offset, next_argument.start, 13)
              }
            }
          } else {
            if (next_argument.kind != 2) {
              return function_definition(0, 0, 0, 0, offset, next_argument.start, 13)
            }
          }
          call_close = next_token(source, next_argument_value.start + next_argument_value.length)
        }
      }
      if (is_symbol(source, call_close, 41) == 0) {
        return function_definition(0, 0, 0, 0, offset, call_close.start, 14)
      }
      let call_body_close = next_token(source, call_close.start + call_close.length)
      if (is_symbol(source, call_body_close, 46) == 1) {
        let field = next_token(source, call_body_close.start + call_body_close.length)
        if (field.kind != 1) {
          return function_definition(0, 0, 0, 0, offset, field.start, 2)
        }
        call_body_close = next_token(source, field.start + field.length)
      }
      if (is_symbol(source, call_body_close, 125) == 0) {
        return function_definition(0, 0, 0, 0, offset, call_body_close.start, 15)
      }
      return function_definition(1, name.start, name.length, -2, call_body_close.start + call_body_close.length, 0, 0)
    }
    if (returned_value.kind != 1) {
      return function_definition(0, 0, 0, 0, offset, returned_value.start, 12)
    }
    let current_function = function_definition(1, name.start, name.length, 0, offset, 0, 0)
    if (returned_parameter_index(source, current_function, returned_value) < 0) {
      return function_definition(0, 0, 0, 0, offset, returned_value.start, 12)
    }
    return_value = -1
  }
  let close_body = next_token(source, value_token.start + value_token.length)
  if (is_symbol(source, close_body, 125) == 0) {
    return function_definition(0, 0, 0, 0, offset, close_body.start, 15)
  }
  let name_start = name.start
  let name_length = name.length
  let next_position = close_body.start + close_body.length
  return function_definition(1, name_start, name_length, return_value, next_position, 0, 0)
}

fn parse_empty_program(source: bytes) -> i32 {
  let first = next_token(source, 0)
  if (first.kind == 0) {
    return 1
  }
  if (first.kind != 1) {
    return 0
  }
  if (is_module_keyword(source, first) == 0) {
    return 0
  }
  let name = next_token(source, first.start + first.length)
  if (name.kind != 1) {
    return 0
  }
  let position = name.start + name.length
  while (position < byte_length(source)) {
    let keyword = next_token(source, position)
    if (keyword.kind == 0) {
      return 1
    }
    if (keyword.kind != 1) {
      return 0
    }
    if (is_import_keyword(source, keyword) == 1) {
      let imported = next_token(source, keyword.start + keyword.length)
      if (imported.kind != 1) {
        return 0
      }
      position = imported.start + imported.length
    } else {
      if (is_struct_keyword(source, keyword) == 1) {
        let definition = parse_struct(source, keyword.start)
        if (definition.status == 0) {
          return 0
        }
        position = definition.position
      } else {
        let function = parse_function(source, keyword.start)
        if (function.status == 0) {
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
  if (first.kind != 1) {
    return compile_diagnostic(1, first.start, 1)
  }
  if (is_module_keyword(source, first) == 0) {
    return compile_diagnostic(1, first.start, 1)
  }
  let name = next_token(source, first.start + first.length)
  if (name.kind != 1) {
    return compile_diagnostic(1, name.start, 2)
  }
  let position = name.start + name.length
  while (position < byte_length(source)) {
    let keyword = next_token(source, position)
    if (keyword.kind == 0) {
      return compile_diagnostic(1, keyword.start, 3)
    }
    if (keyword.kind != 1) {
      return compile_diagnostic(1, keyword.start, 3)
    }
    if (is_import_keyword(source, keyword) == 1) {
      let imported = next_token(source, keyword.start + keyword.length)
      if (imported.kind != 1) {
        return compile_diagnostic(1, imported.start, 2)
      }
      position = imported.start + imported.length
    } else {
      if (is_struct_keyword(source, keyword) == 1) {
        let definition = parse_struct(source, keyword.start)
        if (definition.status == 0) {
          return compile_diagnostic(1, definition.error_offset, definition.error_expected)
        }
        position = definition.position
      } else {
        let function = parse_function(source, keyword.start)
        if (function.status == 0) {
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
  if (module_keyword.kind != 1) {
    return function_definition(0, 0, 0, 0, 0, module_keyword.start, 1)
  }
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  let position = module_name.start + module_name.length
  while (position < byte_length(source)) {
    let keyword = next_token(source, position)
    if (keyword.kind == 0) {
      return function_definition(0, 0, 0, 0, position, keyword.start, 3)
    }
    if (is_import_keyword(source, keyword) == 1) {
      let imported = next_token(source, keyword.start + keyword.length)
      position = imported.start + imported.length
    } else {
      if (is_struct_keyword(source, keyword) == 1) {
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
  while (index < target) {
    let next = next_token(source, function.position)
    function = parse_function(source, next.start)
    index = index + 1
  }
  return function
}

fn function_is_exported(source: bytes, function: function_definition) -> i32 {
  let current = next_token(source, 0)
  while (current.start < function.name_start) {
    if (is_export_keyword(source, current) == 1) {
      let keyword = next_token(source, current.start + current.length)
      if (is_fn_keyword(source, keyword) == 1) {
        let name = next_token(source, keyword.start + keyword.length)
        let target = token(1, function.name_start, function.name_length)
        if (same_token(source, name, target) == 1) {
          return 1
        }
      }
    }
    current = next_token(source, current.start + current.length)
  }
  return 0
}

fn function_parameter_close_at(source: bytes, name_start: i32, name_length: i32) -> token {
  let name = token(1, name_start, name_length)
  let open = next_token(source, name.start + name.length)
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 41) == 0) {
    let colon = next_token(source, current.start + current.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    let parameter_type_end = type_end(source, parameter_type)
    current = next_token(source, parameter_type_end.start + parameter_type_end.length)
    if (is_symbol(source, current, 44) == 1) {
      current = next_token(source, current.start + current.length)
    }
  }
  return current
}

fn function_parameter_close(source: bytes, function: function_definition) -> token {
  let name_start = function.name_start
  let name_length = function.name_length
  return function_parameter_close_at(source, name_start, name_length)
}

fn function_parameter_count_at(source: bytes, name_start: i32, name_length: i32) -> i32 {
  let name = token(1, name_start, name_length)
  let open = next_token(source, name.start + name.length)
  let current = next_token(source, open.start + open.length)
  let count = 0
  while (is_symbol(source, current, 41) == 0) {
    let colon = next_token(source, current.start + current.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    if (is_bytes_type(source, parameter_type) == 1) {
      count = count + 2
    } else {
    if (is_symbol(source, parameter_type, 91) == 1) {
      count = count + 2
    } else {
      count = count + 1
    }
    }
    let parameter_type_end = type_end(source, parameter_type)
    current = next_token(source, parameter_type_end.start + parameter_type_end.length)
    if (is_symbol(source, current, 44) == 1) {
      current = next_token(source, current.start + current.length)
    }
  }
  return count
}

fn function_parameter_count_of(source: bytes, function: function_definition) -> i32 {
  let name_start = function.name_start
  let name_length = function.name_length
  return function_parameter_count_at(source, name_start, name_length)
}

fn returned_parameter_index_at(source: bytes, name_start: i32, name_length: i32, returned: token) -> i32 {
  let name = token(1, name_start, name_length)
  let open = next_token(source, name.start + name.length)
  let current = next_token(source, open.start + open.length)
  let index = 0
  while (is_symbol(source, current, 41) == 0) {
    if (same_token(source, current, returned) == 1) {
      return index
    }
    let colon = next_token(source, current.start + current.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    if (is_bytes_type(source, parameter_type) == 1) {
      index = index + 2
    } else {
    if (is_symbol(source, parameter_type, 91) == 1) {
      index = index + 2
    } else {
      index = index + 1
    }
    }
    let parameter_type_end = type_end(source, parameter_type)
    current = next_token(source, parameter_type_end.start + parameter_type_end.length)
    if (is_symbol(source, current, 44) == 1) {
      current = next_token(source, current.start + current.length)
    }
  }
  return -1
}

fn returned_parameter_index(source: bytes, function: function_definition, returned: token) -> i32 {
  let name_start = function.name_start
  let name_length = function.name_length
  return returned_parameter_index_at(source, name_start, name_length, returned)
}

fn returned_value_token(source: bytes, function: function_definition) -> token {
  let name_start = function.name_start
  let name_length = function.name_length
  let close = function_parameter_close_at(source, name_start, name_length)
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  let result_type_end = type_end(source, result_type)
  let open_body = next_token(source, result_type_end.start + result_type_end.length)
  let returned = next_token(source, open_body.start + open_body.length)
  return next_token(source, returned.start + returned.length)
}

fn function_body_first_token(source: bytes, function: function_definition) -> token {
  let name_start = function.name_start
  let name_length = function.name_length
  let close = function_parameter_close_at(source, name_start, name_length)
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  let result_type_end = type_end(source, result_type)
  let open_body = next_token(source, result_type_end.start + result_type_end.length)
  return next_token(source, open_body.start + open_body.length)
}

fn function_returns_struct(source: bytes, function: function_definition) -> i32 {
  let close = function_parameter_close(source, function)
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  if (struct_field_count(source, result_type) >= 0) {
    return 1
  }
  return 0
}

fn function_returns_bytes(source: bytes, function: function_definition) -> i32 {
  let close = function_parameter_close(source, function)
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  if (is_bytes_type(source, result_type) == 1) {
    return 1
  }
  return is_i32_array_type(source, result_type)
}

fn function_body_kind_of(source: bytes, function: function_definition) -> i32 {
  if (function_returns_bytes(source, function) == 1) {
    return 6
  }
  let first = function_body_first_token(source, function)
  if (is_array_set_call(source, first) == 1) { return 6 }
  if (is_loop_keyword(source, first) == 1) { return 6 }
  if (is_local_assignment(source, first) == 1) {
    return 6
  }
  if (is_if_keyword(source, first) == 1) {
    return 6
  }
  let value = returned_value_token(source, function)
  if (is_symbol(source, value, 45) == 1) {
    return 0
  }
  if (value.kind == 2) {
    return 0
  }
  let call_open = next_token(source, value.start + value.length)
  if (is_symbol(source, call_open, 40) == 1) {
    let current = next_token(source, call_open.start + call_open.length)
    while (is_symbol(source, current, 41) == 0) {
      current = next_token(source, current.start + current.length)
    }
    let after_call = next_token(source, current.start + current.length)
    if (is_symbol(source, after_call, 46) == 1) {
      return 3
    }
    if (struct_field_count(source, value) >= 0) {
      return 5
    }
    return 2
  }
  return 1
}

// 型宣言の検索では関数本体を解析せず、comment を除いた brace の対応だけを追う。
fn skip_braced_body(source: bytes, offset: i32) -> i32 {
  let position = offset
  let source_length = byte_length(source)
  let depth = 1
  while (position < source_length) {
    let value = byte_at(source, position)
    if (value == 47) {
      if (position + 1 < source_length) {
        if (byte_at(source, position + 1) == 47) {
          position = position + 2
          while (position < source_length) {
            if (byte_at(source, position) == 10) { break }
            position = position + 1
          }
        }
      }
    } else {
      if (value == 123) { depth = depth + 1 }
      if (value == 125) {
        depth = depth - 1
        if (depth == 0) { return position + 1 }
      }
    }
    position = position + 1
  }
  return position
}

fn is_array_return_call(source: bytes, value: token) -> i32 {
  let after = next_token(source, value.start + value.length)
  if (is_symbol(source, after, 40) == 0) {
    return 0
  }
  // 関数名の固定リストではなく、宣言された戻り値型を参照する。
  let current = next_token(source, 0)
  while (current.kind != 0) {
    if (is_fn_keyword(source, current) == 1) {
      let name = next_token(source, current.start + current.length)
      if (same_token(source, name, value) == 1) {
        let close = next_token(source, name.start + name.length)
        while (is_symbol(source, close, 41) == 0) {
          if (close.kind == 0) {
            return 0
          }
          close = next_token(source, close.start + close.length)
        }
        let minus = next_token(source, close.start + close.length)
        let arrow = next_token(source, minus.start + minus.length)
        let result_type = next_token(source, arrow.start + arrow.length)
        if (is_bytes_type(source, result_type) == 1) {
          return 1
        }
        return is_i32_array_type(source, result_type)
      }
    }
    if (is_symbol(source, current, 123) == 1) {
      let body_end = skip_braced_body(source, current.start + current.length)
      current = next_token(source, body_end)
    } else {
      current = next_token(source, current.start + current.length)
    }
  }
  return 0
}

fn is_bytes_variable(source: bytes, function_start: i32, value: token) -> i32 {
  // literal、call、field access は bytes 変数そのものではない。
  if (value.kind != 1) { return 0 }
  let after = next_token(source, value.start + value.length)
  if (is_symbol(source, after, 40) == 1) { return 0 }
  if (is_symbol(source, after, 46) == 1) { return 0 }
  // 変数の型は所属する関数の parameter 宣言だけから調べる。
  let current = next_token(source, function_start)
  while (is_symbol(source, current, 41) == 0) {
    if (current.kind == 0) { return 0 }
    if (current.kind == 1) {
      if (same_token(source, current, value) == 1) {
        let colon = next_token(source, current.start + current.length)
        let type_name = next_token(source, colon.start + colon.length)
        if (is_bytes_type(source, type_name) == 1) {
          return 1
        }
      }
    }
    current = next_token(source, current.start + current.length)
  }
  return 0
}

fn local_slot_width(source: bytes, function_start: i32, statement: token) -> i32 {
  let operand = assignment_operand(source, statement)
  if (is_bytes_variable(source, function_start, operand) == 1) {
    return 2
  }
  if (is_allocate_i32_array_call(source, operand) == 1) {
    return 2
  }
  if (is_allocate_bytes_call(source, operand) == 1) {
    return 2
  }
  if (is_array_return_call(source, operand) == 1) {
    return 2
  }
  return 1
}

fn is_array_assignment(source: bytes, operand: token) -> i32 {
  if (is_allocate_i32_array_call(source, operand) == 1) {
    return 1
  }
  if (is_allocate_bytes_call(source, operand) == 1) {
    return 1
  }
  return is_array_return_call(source, operand)
}

fn count_let_tokens_in_range(source: bytes, function_start: i32, start: i32, end: i32) -> i32 {
  let current = next_token(source, start)
  let count = 0
  while (current.start < end) {
    if (is_let_keyword(source, current) == 1) {
      count = count + local_slot_width(source, function_start, current)
    }
    current = next_token(source, current.start + current.length)
  }
  return count
}

fn let_offset_in_range(source: bytes, function_start: i32, start: i32, end: i32, target: token) -> i32 {
  let current = next_token(source, start)
  let offset = 0
  while (current.start < end) {
    if (is_let_keyword(source, current) == 1) {
      let name = assignment_name(source, current)
      if (same_token(source, name, target) == 1) {
        return offset
      }
      offset = offset + local_slot_width(source, function_start, current)
    }
    current = next_token(source, current.start + current.length)
  }
  return -1
}

fn local_count_of(source: bytes, function: function_definition) -> i32 {
  let name_start = function.name_start
  let end = function.position
  let first = function_body_first_token(source, function)
  return count_let_tokens_in_range(source, name_start, first.start, end)
}

fn fixed_local_count_of(source: bytes, function: function_definition) -> i32 {
  let name_start = function.name_start
  let current = function_body_first_token(source, function)
  let count = 0
  while (is_let_keyword(source, current) == 1) {
    let name = next_token(source, current.start + current.length)
    let equals = next_token(source, name.start + name.length)
    let operand = next_token(source, equals.start + equals.length)
    current = next_token(source, operand.start + operand.length)
    if (is_symbol(source, current, 46) == 1) {
      let field = next_token(source, current.start + current.length)
      current = next_token(source, field.start + field.length)
    }
    if (is_symbol(source, current, 40) == 1) {
      let argument = next_token(source, current.start + current.length)
      let close_call = next_token(source, argument.start + argument.length)
      if (is_symbol(source, argument, 41) == 1) {
        current = next_token(source, argument.start + argument.length)
      } else {
        while (is_symbol(source, argument, 41) == 0) {
          let argument_separator = next_token(source, argument.start + argument.length)
          if (is_symbol(source, argument_separator, 44) == 1) {
            argument = next_token(source, argument_separator.start + argument_separator.length)
          } else {
            argument = argument_separator
          }
        }
        current = next_token(source, argument.start + argument.length)
      }
    }
    while (is_arithmetic_operator(source, current) == 1) {
      let next_operand = next_token(source, current.start + current.length)
      current = next_token(source, next_operand.start + next_operand.length)
    }
    count = count + 1
  }
  if (is_loop_keyword(source, current) == 1) {
    let post_conditional_left = next_token(source, current.start + current.length)
    let post_conditional_operator = next_token(source, post_conditional_left.start + post_conditional_left.length)
    let post_conditional_right = next_token(source, post_conditional_operator.start + post_conditional_operator.length)
    let post_conditional_open = expression_end(source, post_conditional_right)
    current = next_token(source, post_conditional_open.start + post_conditional_open.length)
    while (is_symbol(source, current, 125) == 0) {
      if (is_if_keyword(source, current) == 1) {
        let post_conditional_loop_left = next_token(source, current.start + current.length)
        let post_conditional_loop_open = next_token(source, post_conditional_loop_left.start + post_conditional_loop_left.length)
        let post_conditional_loop_statement = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, post_conditional_loop_open, 40) == 1) {
          post_conditional_loop_statement = parse_loop_conditional(source, current.start)
        } else {
          post_conditional_loop_statement = parse_loop_local_conditional(source, current.start)
        }
        count = count + count_let_tokens_in_range(source, name_start, current.start, post_conditional_loop_statement.position)
        current = next_token(source, post_conditional_loop_statement.position)
      } else {
        let post_conditional_target = current
        if (is_let_keyword(source, current) == 1) {
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
  while (is_if_keyword(source, current) == 1) {
    let trailing_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, trailing_conditional.position)
  }
  while (is_let_keyword(source, current) == 1) {
    let trailing_name = next_token(source, current.start + current.length)
    let trailing_equals = next_token(source, trailing_name.start + trailing_name.length)
    let trailing_operand = next_token(source, trailing_equals.start + trailing_equals.length)
    current = expression_end(source, trailing_operand)
    count = count + 1
  }
  while (is_if_keyword(source, current) == 1) {
    let post_local_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_local_conditional.position)
  }
  while (is_let_keyword(source, current) == 1) {
    let post_conditional_name = next_token(source, current.start + current.length)
    let post_conditional_equals = next_token(source, post_conditional_name.start + post_conditional_name.length)
    let post_conditional_operand = next_token(source, post_conditional_equals.start + post_conditional_equals.length)
    current = expression_end(source, post_conditional_operand)
    count = count + 1
  }
  if (is_loop_keyword(source, current) == 1) {
    let left = condition_left(source, current)
    let operator = next_token(source, left.start + left.length)
    let right = next_token(source, operator.start + operator.length)
    let open = condition_block_open(source, expression_end(source, right))
    current = next_token(source, open.start + open.length)
    while (is_symbol(source, current, 125) == 0) {
      if (is_if_keyword(source, current) == 1) {
        let conditional_left = condition_left(source, current)
        let conditional_open = next_token(source, conditional_left.start + conditional_left.length)
        let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, conditional_open, 40) == 1) {
          let loop_conditional_first = next_token(source, conditional_open.start + conditional_open.length)
          if (is_return_keyword(source, loop_conditional_first) == 1) {
            conditional = parse_local_return_conditional(source, current.start)
          } else {
            conditional = parse_loop_conditional(source, current.start)
          }
        } else {
          conditional = parse_loop_local_conditional(source, current.start)
        }
        count = count + count_let_tokens_in_range(source, name_start, current.start, conditional.position)
        current = next_token(source, conditional.position)
      } else {
        let target = current
        if (is_let_keyword(source, current) == 1) {
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
  while (is_if_keyword(source, current) == 1) {
    let post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_conditional_if.position)
  }
  while (is_let_keyword(source, current) == 1) {
    let second_trailing_name = next_token(source, current.start + current.length)
    let second_trailing_equals = next_token(source, second_trailing_name.start + second_trailing_name.length)
    let second_trailing_operand = next_token(source, second_trailing_equals.start + second_trailing_equals.length)
    current = expression_end(source, second_trailing_operand)
    count = count + 1
  }
  if (is_loop_keyword(source, current) == 1) {
    let second_left = next_token(source, current.start + current.length)
    let second_operator = next_token(source, second_left.start + second_left.length)
    let second_right = next_token(source, second_operator.start + second_operator.length)
    let second_open = expression_end(source, second_right)
    current = next_token(source, second_open.start + second_open.length)
    while (is_symbol(source, current, 125) == 0) {
      if (is_if_keyword(source, current) == 1) {
        let second_conditional_left = next_token(source, current.start + current.length)
        let second_conditional_open = next_token(source, second_conditional_left.start + second_conditional_left.length)
        let second_conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, second_conditional_open, 40) == 1) {
          second_conditional = parse_loop_conditional(source, current.start)
        } else {
          second_conditional = parse_loop_local_conditional(source, current.start)
        }
        count = count + count_let_tokens_in_range(source, name_start, current.start, second_conditional.position)
        current = next_token(source, second_conditional.position)
      } else {
        let second_target = current
        if (is_let_keyword(source, current) == 1) {
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
  while (is_if_keyword(source, current) == 1) {
    let second_post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, second_post_conditional_if.position)
  }
  while (is_let_keyword(source, current) == 1) {
    let third_trailing_name = next_token(source, current.start + current.length)
    let third_trailing_equals = next_token(source, third_trailing_name.start + third_trailing_name.length)
    let third_trailing_operand = next_token(source, third_trailing_equals.start + third_trailing_equals.length)
    current = expression_end(source, third_trailing_operand)
    count = count + 1
  }
  while (is_if_keyword(source, current) == 1) {
    let third_post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, third_post_conditional_if.position)
  }
  return count
}

fn variable_index(source: bytes, function: function_definition, target: token) -> i32 {
  let name_start = function.name_start
  let name_length = function.name_length
  let function_position = function.position
  let parameter_index = returned_parameter_index_at(source, name_start, name_length, target)
  if (parameter_index >= 0) {
    return parameter_index
  }
  let first = function_body_first_token(source, function)
  let local_offset = let_offset_in_range(source, name_start, first.start, function_position, target)
  if (local_offset >= 0) {
    let parameter_count = function_parameter_count_at(source, name_start, name_length)
    return parameter_count + local_offset
  }
  return -1
}

fn lexical_variable_index(source: bytes, function: function_definition, target: token) -> i32 {
  let name_start = function.name_start
  let name_length = function.name_length
  let function_position = function.position
  let parameter_count = function_parameter_count_at(source, name_start, name_length)
  let current = function_body_first_token(source, function)
  let index = parameter_count
  while (current.start < function_position) {
    if (is_let_keyword(source, current) == 1) {
      let name = assignment_name(source, current)
      if (same_token(source, name, target) == 1) {
        return index
      }
      index = index + local_slot_width(source, name_start, current)
    }
    current = next_token(source, current.start + current.length)
  }
  return -1
}

fn fixed_variable_index(source: bytes, function: function_definition, target: token) -> i32 {
  let name_start = function.name_start
  let name_length = function.name_length
  let function_position = function.position
  let parameter_count = function_parameter_count_at(source, name_start, name_length)
  let parameter_index = returned_parameter_index_at(source, name_start, name_length, target)
  if (parameter_index >= 0) {
    return parameter_index
  }
  let current = function_body_first_token(source, function)
  let index = parameter_count
  while (is_let_keyword(source, current) == 1) {
    let name = next_token(source, current.start + current.length)
    if (same_token(source, name, target) == 1) {
      return index
    }
    let equals = next_token(source, name.start + name.length)
    let operand = next_token(source, equals.start + equals.length)
    current = next_token(source, operand.start + operand.length)
    if (is_symbol(source, current, 46) == 1) {
      let field = next_token(source, current.start + current.length)
      current = next_token(source, field.start + field.length)
    }
    if (is_symbol(source, current, 40) == 1) {
      let argument = next_token(source, current.start + current.length)
      let close_call = next_token(source, argument.start + argument.length)
      if (is_symbol(source, argument, 41) == 1) {
        current = next_token(source, argument.start + argument.length)
      } else {
        while (is_symbol(source, argument, 41) == 0) {
          let argument_separator = next_token(source, argument.start + argument.length)
          if (is_symbol(source, argument_separator, 44) == 1) {
            argument = next_token(source, argument_separator.start + argument_separator.length)
          } else {
            argument = argument_separator
          }
        }
        current = next_token(source, argument.start + argument.length)
      }
    }
    while (is_arithmetic_operator(source, current) == 1) {
      let next_operand = next_token(source, current.start + current.length)
      current = next_token(source, next_operand.start + next_operand.length)
    }
    index = index + 1
  }
  if (is_loop_keyword(source, current) == 1) {
    let post_conditional_left = next_token(source, current.start + current.length)
    let post_conditional_operator = next_token(source, post_conditional_left.start + post_conditional_left.length)
    let post_conditional_right = next_token(source, post_conditional_operator.start + post_conditional_operator.length)
    let post_conditional_open = expression_end(source, post_conditional_right)
    current = next_token(source, post_conditional_open.start + post_conditional_open.length)
    while (is_symbol(source, current, 125) == 0) {
      if (is_if_keyword(source, current) == 1) {
        let post_conditional_loop_left = next_token(source, current.start + current.length)
        let post_conditional_loop_open = next_token(source, post_conditional_loop_left.start + post_conditional_loop_left.length)
        let post_conditional_loop_statement = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, post_conditional_loop_open, 40) == 1) {
          post_conditional_loop_statement = parse_loop_conditional(source, current.start)
        } else {
          post_conditional_loop_statement = parse_loop_local_conditional(source, current.start)
        }
        let post_conditional_loop_offset = let_offset_in_range(source, name_start, current.start, post_conditional_loop_statement.position, target)
        if (post_conditional_loop_offset >= 0) {
          return index + post_conditional_loop_offset
        }
        index = index + count_let_tokens_in_range(source, name_start, current.start, post_conditional_loop_statement.position)
        current = next_token(source, post_conditional_loop_statement.position)
      } else {
        let post_conditional_target_name = current
        if (is_let_keyword(source, current) == 1) {
          post_conditional_target_name = next_token(source, current.start + current.length)
          if (same_token(source, post_conditional_target_name, target) == 1) {
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
  while (is_if_keyword(source, current) == 1) {
    let trailing_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, trailing_conditional.position)
  }
  while (is_let_keyword(source, current) == 1) {
    let trailing_name = next_token(source, current.start + current.length)
    if (same_token(source, trailing_name, target) == 1) {
      return index
    }
    let trailing_equals = next_token(source, trailing_name.start + trailing_name.length)
    let trailing_operand = next_token(source, trailing_equals.start + trailing_equals.length)
    current = expression_end(source, trailing_operand)
    index = index + 1
  }
  while (is_if_keyword(source, current) == 1) {
    let post_local_conditional = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_local_conditional.position)
  }
  while (is_let_keyword(source, current) == 1) {
    let post_conditional_name = next_token(source, current.start + current.length)
    if (same_token(source, post_conditional_name, target) == 1) {
      return index
    }
    let post_conditional_equals = next_token(source, post_conditional_name.start + post_conditional_name.length)
    let post_conditional_operand = next_token(source, post_conditional_equals.start + post_conditional_equals.length)
    current = expression_end(source, post_conditional_operand)
    index = index + 1
  }
  if (is_loop_keyword(source, current) == 1) {
    let left = condition_left(source, current)
    let operator = next_token(source, left.start + left.length)
    let right = next_token(source, operator.start + operator.length)
    let open = condition_block_open(source, expression_end(source, right))
    current = next_token(source, open.start + open.length)
    while (is_symbol(source, current, 125) == 0) {
      if (is_if_keyword(source, current) == 1) {
        let conditional_left = condition_left(source, current)
        let conditional_open = next_token(source, conditional_left.start + conditional_left.length)
        let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, conditional_open, 40) == 1) {
          conditional = parse_loop_conditional(source, current.start)
        } else {
          conditional = parse_loop_local_conditional(source, current.start)
        }
        let conditional_offset = let_offset_in_range(source, name_start, current.start, conditional.position, target)
        if (conditional_offset >= 0) {
          return index + conditional_offset
        }
        index = index + count_let_tokens_in_range(source, name_start, current.start, conditional.position)
        current = next_token(source, conditional.position)
      } else {
        let target_name = current
        if (is_let_keyword(source, current) == 1) {
          target_name = next_token(source, current.start + current.length)
          if (same_token(source, target_name, target) == 1) {
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
  while (is_if_keyword(source, current) == 1) {
    let post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, post_conditional_if.position)
  }
  while (is_let_keyword(source, current) == 1) {
    let second_trailing_name = next_token(source, current.start + current.length)
    if (same_token(source, second_trailing_name, target) == 1) {
      return index
    }
    let second_trailing_equals = next_token(source, second_trailing_name.start + second_trailing_name.length)
    let second_trailing_operand = next_token(source, second_trailing_equals.start + second_trailing_equals.length)
    current = expression_end(source, second_trailing_operand)
    index = index + 1
  }
  if (is_loop_keyword(source, current) == 1) {
    let second_left = next_token(source, current.start + current.length)
    let second_operator = next_token(source, second_left.start + second_left.length)
    let second_right = next_token(source, second_operator.start + second_operator.length)
    let second_open = expression_end(source, second_right)
    current = next_token(source, second_open.start + second_open.length)
    while (is_symbol(source, current, 125) == 0) {
      if (is_if_keyword(source, current) == 1) {
        let second_conditional_left = next_token(source, current.start + current.length)
        let second_conditional_open = next_token(source, second_conditional_left.start + second_conditional_left.length)
        let second_conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, second_conditional_open, 40) == 1) {
          second_conditional = parse_loop_conditional(source, current.start)
        } else {
          second_conditional = parse_loop_local_conditional(source, current.start)
        }
        let second_conditional_offset = let_offset_in_range(source, name_start, current.start, second_conditional.position, target)
        if (second_conditional_offset >= 0) {
          return index + second_conditional_offset
        }
        index = index + count_let_tokens_in_range(source, name_start, current.start, second_conditional.position)
        current = next_token(source, second_conditional.position)
      } else {
        let second_target_name = current
        if (is_let_keyword(source, current) == 1) {
          second_target_name = next_token(source, current.start + current.length)
          if (same_token(source, second_target_name, target) == 1) {
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
  while (is_if_keyword(source, current) == 1) {
    let second_post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, second_post_conditional_if.position)
  }
  while (is_let_keyword(source, current) == 1) {
    let third_trailing_name = next_token(source, current.start + current.length)
    if (same_token(source, third_trailing_name, target) == 1) {
      return index
    }
    let third_trailing_equals = next_token(source, third_trailing_name.start + third_trailing_name.length)
    let third_trailing_operand = next_token(source, third_trailing_equals.start + third_trailing_equals.length)
    current = expression_end(source, third_trailing_operand)
    index = index + 1
  }
  while (is_if_keyword(source, current) == 1) {
    let third_post_conditional_if = parse_local_return_conditional(source, current.start)
    current = next_token(source, third_post_conditional_if.position)
  }
  return -1
}

fn struct_field_index(source: bytes, struct_name: token, field_name: token) -> i32 {
  let module_keyword = next_token(source, 0)
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  let position = module_name.start + module_name.length
  while (position < byte_length(source)) {
    let keyword = next_token(source, position)
    if (is_import_keyword(source, keyword) == 1) {
      let imported = next_token(source, keyword.start + keyword.length)
      position = imported.start + imported.length
    } else {
      if (is_struct_keyword(source, keyword) == 0) {
        return -1
      }
      let name = next_token(source, keyword.start + keyword.length)
      let open = next_token(source, name.start + name.length)
      let field = next_token(source, open.start + open.length)
      let index = 0
      while (is_symbol(source, field, 125) == 0) {
        if (same_token(source, name, struct_name) == 1) {
          if (same_token(source, field, field_name) == 1) {
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
  while (is_symbol(source, parameter_name, 41) == 0) {
    let colon = next_token(source, parameter_name.start + parameter_name.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    if (same_token(source, parameter_name, target) == 1) {
      return struct_field_index(source, parameter_type, field)
    }
    let parameter_type_end = type_end(source, parameter_type)
    parameter_name = next_token(source, parameter_type_end.start + parameter_type_end.length)
    if (is_symbol(source, parameter_name, 44) == 1) {
      parameter_name = next_token(source, parameter_name.start + parameter_name.length)
    }
  }
  return -1
}

fn local_struct_field_index(source: bytes, table: [i32], function: function_definition, target: token, field: token) -> i32 {
  let parameter_field_index = parameter_struct_field_index(source, function, target, field)
  if (parameter_field_index >= 0) {
    return parameter_field_index
  }
  let resolved_target = target
  let limit = function.position
  let current = function_body_first_token(source, function)
  while (current.start < limit) {
    let previous_limit = limit
    if (is_let_keyword(source, current) == 1) {
      let local_name = next_token(source, current.start + current.length)
      let equals = next_token(source, local_name.start + local_name.length)
      let initializer = next_token(source, equals.start + equals.length)
      if (same_token(source, local_name, resolved_target) == 1) {
        let after_initializer = next_token(source, initializer.start + initializer.length)
        if (is_symbol(source, after_initializer, 40) == 0) {
          // 別名の宣言より前だけを探索し、自己参照や循環を避ける。
          let alias_field_index = parameter_struct_field_index(source, function, initializer, field)
          if (alias_field_index >= 0) {
            return alias_field_index
          }
          resolved_target = initializer
          limit = local_name.start
          current = function_body_first_token(source, function)
        } else {
          if (struct_field_count(source, initializer) >= 0) {
            return struct_field_index(source, initializer, field)
          }
          let called_index = function_index_in_table(source, table, initializer)
          if (called_index < 0) {
            return -1
          }
          let called = function_at_index(source, called_index)
          let called_close = function_parameter_close(source, called)
          let called_minus = next_token(source, called_close.start + called_close.length)
          let called_arrow = next_token(source, called_minus.start + called_minus.length)
          let struct_name = next_token(source, called_arrow.start + called_arrow.length)
          return struct_field_index(source, struct_name, field)
        }
      }
    }
    if (limit == previous_limit) {
      current = next_token(source, current.start + current.length)
    }
  }
  return -1
}

fn struct_field_value_of(source: bytes, function: function_definition) -> i32 {
  let struct_name = returned_value_token(source, function)
  let open = next_token(source, struct_name.start + struct_name.length)
  let closing = next_token(source, open.start + open.length)
  while (is_symbol(source, closing, 41) == 0) {
    closing = next_token(source, closing.start + closing.length)
  }
  let dot = next_token(source, closing.start + closing.length)
  let field_name = next_token(source, dot.start + dot.length)
  let field_index = struct_field_index(source, struct_name, field_name)
  let argument = next_token(source, open.start + open.length)
  let argument_index = 0
  while (is_symbol(source, argument, 41) == 0) {
    if (field_index == argument_index) {
      return read_small_integer(source, argument)
    }
    let comma = next_token(source, argument.start + argument.length)
    if (is_symbol(source, comma, 44) == 0) {
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
  if (is_symbol(source, argument, 41) == 1) {
    return 0
  }
  if (is_symbol(source, argument, 45) == 1) {
    return 1
  }
  if (argument.kind == 2) {
    return 1
  }
  return 2
}

fn call_argument_value_of(source: bytes, function: function_definition) -> i32 {
  let argument = call_argument_token(source, function)
  if (is_symbol(source, argument, 45) == 1) {
    let negative_value = next_token(source, argument.start + argument.length)
    let parsed_value = read_small_integer(source, negative_value)
    return negate_i32(parsed_value)
  }
  if (argument.kind == 2) {
    return read_small_integer(source, argument)
  }
  return 0
}

fn count_functions(source: bytes) -> i32 {
  let module_keyword = next_token(source, 0)
  if (is_module_keyword(source, module_keyword) == 0) {
    return negate_i32(1)
  }
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  if (module_name.kind != 1) {
    return negate_i32(1)
  }
  let position = module_name.start + module_name.length
  let count = 0
  while (position < byte_length(source)) {
    let keyword = next_token(source, position)
    if (keyword.kind == 0) {
      return count
    }
    if (is_import_keyword(source, keyword) == 1) {
      let imported = next_token(source, keyword.start + keyword.length)
      if (imported.kind != 1) {
        return -1
      }
      position = imported.start + imported.length
    } else {
      if (is_struct_keyword(source, keyword) == 1) {
        let definition = parse_struct(source, keyword.start)
        if (definition.status == 0) {
          return -1
        }
        position = definition.position
      } else {
        let function = parse_function(source, keyword.start)
        if (function.status == 0) {
          return -1
        }
        count = count + 1
        position = function.position
      }
    }
  }
  return count
}

fn mark_invalid(table: [i32]) -> [i32] {
  let ignored = 0
  array_set(table, 0, -1)
  return table
}

fn record_function(table: [i32], count: i32, function: function_definition, parameter_count: i32, body_kind: i32, body_value: i32) -> [i32] {
  let ignored = 0
  let name_start = function.name_start
  let name_length = function.name_length
  let base = count * 7
  array_set(table, base + 1, name_start)
  array_set(table, base + 2, name_length)
  array_set(table, base + 3, parameter_count)
  array_set(table, base + 4, body_kind)
  array_set(table, base + 5, body_value)
  array_set(table, base + 6, 0)
  array_set(table, base + 7, 0)
  array_set(table, 0, count + 1)
  return table
}

fn record_call_metadata(table: [i32], index: i32, called_index: i32, argument_kind: i32, argument_value: i32) -> [i32] {
  let ignored = 0
  let base = index * 7
  array_set(table, base + 5, called_index)
  array_set(table, base + 6, argument_kind)
  array_set(table, base + 7, argument_value)
  return table
}

fn function_table(source: bytes) -> [i32] {
  let function_total = count_functions(source)
  let capacity = 1
  if (function_total > 0) {
    capacity = function_total * 8 + 1
  }
  let table = allocate_i32_array(capacity)
  array_set(table, 0, 0)
  if (function_total < 0) {
    return mark_invalid(table)
  }
  let module_keyword = next_token(source, 0)
  if (is_module_keyword(source, module_keyword) == 0) {
    return mark_invalid(table)
  }
  let module_name = next_token(source, module_keyword.start + module_keyword.length)
  if (module_name.kind != 1) {
    return mark_invalid(table)
  }
  let position = module_name.start + module_name.length
  while (position < byte_length(source)) {
    let keyword = next_token(source, position)
    if (keyword.kind == 0) {
      break
    }
    if (is_import_keyword(source, keyword) == 1) {
      let imported = next_token(source, keyword.start + keyword.length)
      if (imported.kind != 1) {
        return mark_invalid(table)
      }
      position = imported.start + imported.length
    } else {
      if (is_struct_keyword(source, keyword) == 1) {
        let definition = parse_struct(source, keyword.start)
        position = definition.position
      } else {
        let function = parse_function(source, keyword.start)
        if (function.status == 0) {
          return mark_invalid(table)
        }
        let count = array_get(table, 0)
        let parameter_count = function_parameter_count_of(source, function)
        let body_kind = function_body_kind_of(source, function)
        let body_value = function.return_value
        if (body_kind == 1) {
          let returned_token = returned_value_token(source, function)
          body_value = returned_parameter_index(source, function, returned_token)
        }
        if (body_kind == 2) {
          body_value = -1
        }
        if (body_kind == 3) {
          body_value = struct_field_value_of(source, function)
        }
        if (body_kind == 5) {
          let constructor_token = returned_value_token(source, function)
          body_value = struct_field_count(source, constructor_token)
        }
        if (body_kind == 6) {
          body_value = local_count_of(source, function)
        }
        let recorded_table = record_function(table, count, function, parameter_count, body_kind, body_value)
        position = function.position
      }
    }
  }
  let current_function = first_function(source)
  let index = 0
  let table_count = array_get(table, 0)
  while (index < table_count) {
    if (array_get(table, index * 7 + 4) == 2) {
      let called_index = called_function_index(source, table, current_function)
      let argument_kind = call_argument_kind_of(source, current_function)
      let argument_value = call_argument_value_of(source, current_function)
      let recorded_metadata = record_call_metadata(table, index, called_index, argument_kind, argument_value)
    }
    index = index + 1
    if (index < table_count) {
      let next = next_token(source, current_function.position)
      current_function = parse_function(source, next.start)
    }
  }
  let analyzed = analyze_temporary_functions(source, table)
  return analyzed
}

// call graphの不動点で、allocationを外へ公開しない関数を判定する。
// 既存の7 slot metadataの後ろに、関数ごとの回収可否を格納する。
fn temporary_function_candidate(source: bytes, table: [i32], function: function_definition) -> i32 {
  if (function_returns_bytes(source, function) == 1) { return 0 }
  let current = function_body_first_token(source, function)
  let flags = array_get(table, 0) * 7 + 1
  while (current.start < function.position) {
    if (current.kind == 0) { return 1 }
    let after = next_token(source, current.start + current.length)
    if (is_symbol(source, after, 40) == 1) {
      if (is_byte_pointer_call(source, current) == 1) { return 0 }
      if (is_allocate_bytes_call(source, current) == 1) { return 0 }
      if (is_allocate_i32_array_call(source, current) == 1) { return 0 }
      if (is_array_set_call(source, current) == 1) { return 0 }
      let called = function_index_in_table(source, table, current)
      if (called >= 0) {
        if (array_get(table, flags + called) == 0) { return 0 }
      }
    }
    current = after
  }
  return 1
}

fn analyze_temporary_functions(source: bytes, table: [i32]) -> [i32] {
  let count = array_get(table, 0)
  let flags = count * 7 + 1
  let index = 0
  while (index < count) {
    array_set(table, flags + index, 1)
    index = index + 1
  }
  let changed = 1
  while (changed == 1) {
    changed = 0
    index = 0
    while (index < count) {
      if (array_get(table, flags + index) == 1) {
        let function = function_at_index(source, index)
        if (temporary_function_candidate(source, table, function) == 0) {
          array_set(table, flags + index, 0)
          changed = 1
        }
      }
      index = index + 1
    }
  }
  return table
}

fn function_reclaims_heap(source: bytes, table: [i32], function: function_definition) -> i32 {
  let name_start = function.name_start
  let name_length = function.name_length
  let keyword = next_token(source, 0)
  let module_name = next_token(source, keyword.start + keyword.length)
  keyword = next_token(source, module_name.start + module_name.length)
  while (is_import_keyword(source, keyword) == 1) {
    let imported = next_token(source, keyword.start + keyword.length)
    keyword = next_token(source, imported.start + imported.length)
  }
  if (is_struct_keyword(source, keyword) == 0) { return 0 }
  let name = token(1, name_start, name_length)
  let index = function_index_in_table(source, table, name)
  let flags = array_get(table, 0) * 7 + 1
  return array_get(table, flags + index)
}

// A temporary probe keeps the function table observable from the integration test.
export fn function_count(source: bytes) -> i32 {
  let table = function_table(source)
  return array_get(table, 0)
}

fn function_index_in_table(source: bytes, table: [i32], name: token) -> i32 {
  let index = 0
  let count = array_get(table, 0)
  while (index < count) {
    let name_start = array_get(table, index * 7 + 1)
    let name_length = array_get(table, index * 7 + 2)
    let candidate = token(1, name_start, name_length)
    if (same_token(source, candidate, name) == 1) {
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
  let ignored = 0
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
  while (length == length) {
    let quotient = remaining / 128
    if (remaining < 0) {
      let quotient_product = quotient * 128
      if (remaining != quotient_product) {
        quotient = quotient - 1
      }
    }
    let byte = remaining - quotient * 128
    remaining = quotient
    length = length + 1
    let negative_one = negate_i32(1)
    if (remaining == 0) {
      if (byte < 64) {
        return length
      }
    }
    if (remaining == negative_one) {
      if (byte >= 64) {
        return length
      }
    }
  }
  return 0
}

fn write_i32_leb(buffer: bytes, index: i32, value: i32) -> bytes {
  let remaining = value
  let position = index
  while (position == position) {
    let quotient = remaining / 128
    if (remaining < 0) {
      let quotient_product = quotient * 128
      if (remaining != quotient_product) {
        quotient = quotient - 1
      }
    }
    let byte_product = quotient * 128
    let byte = remaining - byte_product
    remaining = quotient
    let negative_one = negate_i32(1)
    if (remaining == 0) {
      if (byte < 64) {
        byte_set(buffer, position, byte)
        return buffer
      }
    }
    if (remaining == negative_one) {
      if (byte >= 64) {
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
  while (remaining >= 128) {
    remaining = remaining / 128
    length = length + 1
  }
  return length
}

fn write_u32_leb(buffer: bytes, index: i32, value: i32) -> bytes {
  let remaining = value
  let position = index
  while (position == position) {
    let quotient = remaining / 128
    let quotient_product = quotient * 128
    let byte = remaining - quotient_product
    remaining = quotient
    if (remaining == 0) {
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
  if (value == 61) {
    return 70
  }
  if (value == 33) {
    return 71
  }
  let next = next_token(source, operator.start + operator.length)
  if (value == 60) {
    if (is_symbol(source, next, 61) == 1) {
      return 76
    }
    return 72
  }
  if (is_symbol(source, next, 61) == 1) {
    return 78
  }
  return 74
}

fn conditional_statement_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let left = condition_left(source, statement)
  // 比較opcode、if opcode、空block type、endで4 bytes。
  let length = 4 + value_expression_length(source, table, function, left)
  let operator = expression_end(source, left)
  let right = next_token(source, operator.start + operator.length)
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  length = length + value_expression_length(source, table, function, right)
  let open = condition_block_open(source, expression_end(source, right))
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (is_array_set_call(source, current) == 1) {
      length = length + mutation_length(source, table, function, current)
      current = expression_end(source, current)
    } else {
    if (is_loop_keyword(source, current) == 1) {
      length = length + while_statement_length(source, table, function, current)
      let loop_statement = parse_while_statement(source, current.start)
      current = next_token(source, loop_statement.position)
    } else {
    if (is_if_keyword(source, current) == 1) {
      length = length + conditional_statement_length(source, table, function, current)
      let nested = parse_conditional_statement(source, current.start, left)
      current = next_token(source, nested.position)
    } else {
      length = length + assignment_length(source, table, function, current)
      current = assignment_end(source, current)
    }
    }
    }
  }
  return length
}

fn conditional_body_length(source: bytes, table: [i32], function: function_definition) -> i32 {
  let current = function_body_first_token(source, function)
  let length = 1
  while (is_if_keyword(source, current) == 1) {
    let conditional_left = condition_left(source, current)
    let conditional_operator = next_token(source, conditional_left.start + conditional_left.length)
    let statement = function_definition(0, 0, 0, 0, current.start, 0, 0)
    if (is_symbol(source, conditional_operator, 40) == 1) {
      length = length + local_return_conditional_length(source, table, function, current)
      statement = parse_local_return_conditional(source, current.start)
    } else {
      if (is_symbol(source, conditional_operator, 46) == 1) {
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
  let final_integer = read_small_integer(source, final_value)
  let final_length = i32_leb_length(final_integer)
  return length + 2 + final_length
}

fn write_conditional_statement(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let position = index
  let left = condition_left(source, statement)
  position = write_value_expression(buffer, position, source, table, function, left)
  let operator = expression_end(source, left)
  let right = next_token(source, operator.start + operator.length)
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  position = write_value_expression(buffer, position, source, table, function, right)
  byte_set(buffer, position, comparison_opcode(source, operator))
  byte_set(buffer, position + 1, 4)
  byte_set(buffer, position + 2, 64)
  position = position + 3
  let open = condition_block_open(source, expression_end(source, right))
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (is_array_set_call(source, current) == 1) {
      position = write_mutation(buffer, position, source, table, function, current)
      current = expression_end(source, current)
    } else {
    if (is_loop_keyword(source, current) == 1) {
      position = write_while_statement(buffer, position, source, table, function, current)
      let loop_statement = parse_while_statement(source, current.start)
      current = next_token(source, loop_statement.position)
    } else {
    if (is_if_keyword(source, current) == 1) {
      position = write_conditional_statement(buffer, position, source, table, function, current)
      let nested = parse_conditional_statement(source, current.start, left)
      current = next_token(source, nested.position)
    } else {
      position = write_assignment(buffer, position, source, table, function, current)
      current = assignment_end(source, current)
    }
  }
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
  while (is_if_keyword(source, current) == 1) {
    let conditional_left = condition_left(source, current)
    let conditional_operator = next_token(source, conditional_left.start + conditional_left.length)
    let statement = function_definition(0, 0, 0, 0, current.start, 0, 0)
    if (is_symbol(source, conditional_operator, 40) == 1) {
      position = write_local_return_conditional(buffer, position, source, table, function, current)
      statement = parse_local_return_conditional(source, current.start)
    } else {
      if (is_symbol(source, conditional_operator, 46) == 1) {
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

fn struct_constructor_body_length(source: bytes, table: [i32], function: function_definition) -> i32 {
  let result = local_body_length(source, table, function)
  return result
}

fn write_struct_constructor_body(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition) -> bytes {
  let result = write_local_body(buffer, index, source, table, function)
  return result
}

fn arithmetic_opcode(source: bytes, operator: token) -> i32 {
  let value = byte_at(source, operator.start)
  if (value == 43) {
    return 106
  }
  if (value == 45) {
    return 107
  }
  if (value == 42) {
    return 108
  }
  return 109
}

fn operand_length(source: bytes, function: function_definition, operand: token) -> i32 {
  if (is_symbol(source, operand, 45) == 1) {
    let negative_operand = next_token(source, operand.start + operand.length)
    return 3 + operand_length(source, function, negative_operand)
  }
  let after = next_token(source, operand.start + operand.length)
  if (is_byte_at_call(source, operand) == 1) {
    let first_argument = next_token(source, after.start + after.length)
    let separator = next_token(source, first_argument.start + first_argument.length)
    let second_argument = next_token(source, separator.start + separator.length)
    return operand_length(source, function, first_argument) + operand_length(source, function, second_argument) + 4
  }
  if (operand.kind == 2) {
    let operand_value = read_small_integer(source, operand)
    let operand_length_value = i32_leb_length(operand_value)
    let result = 1 + operand_length_value
    return result
  }
  let operand_index = variable_index(source, function, operand)
  if (operand_index < 0) {
    operand_index = lexical_variable_index(source, function, operand)
  }
  if (operand_index < 0) {
    operand_index = fixed_variable_index(source, function, operand)
  }
  let operand_index_length = u32_leb_length(operand_index)
  let variable_result = 1 + operand_index_length
  return variable_result
}

fn while_statement_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  if (is_do_keyword(source, statement) == 1) {
    return do_until_statement_length(source, table, function, statement)
  }
  let left = condition_left(source, statement)
  let operator = expression_end(source, left)
  let right = next_token(source, operator.start + operator.length)
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  let right_end = expression_end(source, right)
  let length = 12 + value_expression_length(source, table, function, left)
  length = length + value_expression_length(source, table, function, right)
  let open = condition_block_open(source, right_end)
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (is_array_set_call(source, current) == 1) {
      length = length + mutation_length(source, table, function, current)
      current = expression_end(source, current)
    } else {
    if (is_loop_keyword(source, current) == 1) {
      length = length + while_statement_length(source, table, function, current)
      let nested_while = parse_while_statement(source, current.start)
      current = next_token(source, nested_while.position)
    } else {
    if (is_if_keyword(source, current) == 1) {
      let conditional_left = condition_left(source, current)
      let conditional_open = next_token(source, conditional_left.start + conditional_left.length)
      let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
      if (is_symbol(source, conditional_open, 40) == 1) {
        length = length + loop_conditional_length(source, table, function, current)
        conditional = parse_loop_conditional(source, current.start)
      } else {
        length = length + loop_local_conditional_length(source, table, function, current)
        conditional = parse_loop_local_conditional(source, current.start)
      }
      current = next_token(source, conditional.position)
    } else {
      length = length + assignment_length(source, table, function, current)
      current = assignment_end(source, current)
    }
    }
    }
  }
  return length
}

fn do_until_statement_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let open = next_token(source, statement.start + statement.length)
  let current = next_token(source, open.start + open.length)
  let length = 4
  while (is_symbol(source, current, 125) == 0) {
    if (is_return_keyword(source, current) == 1) {
      length = length + return_statement_length(source, table, function, current)
      let returned = next_token(source, current.start + current.length)
      current = expression_end(source, returned)
    } else {
      if (is_array_set_call(source, current) == 1) {
        length = length + mutation_length(source, table, function, current)
        current = expression_end(source, current)
      } else {
        if (is_break_keyword(source, current) == 1) {
          length = length + 2
          current = next_token(source, current.start + current.length)
        } else {
          if (is_loop_keyword(source, current) == 1) {
            length = length + while_statement_length(source, table, function, current)
            let nested = parse_while_statement(source, current.start)
            current = next_token(source, nested.position)
          } else {
            if (is_if_keyword(source, current) == 1) {
              let conditional_left = condition_left(source, current)
              let after_left = next_token(source, conditional_left.start + conditional_left.length)
              if (is_symbol(source, after_left, 40) == 1) {
                length = length + loop_conditional_length(source, table, function, current)
              } else {
                length = length + loop_local_conditional_length(source, table, function, current)
              }
              let conditional = parse_loop_conditional_if(source, current)
              current = next_token(source, conditional.position)
            } else {
              length = length + assignment_length(source, table, function, current)
              current = assignment_end(source, current)
            }
          }
        }
      }
    }
  }
  let until_token = next_token(source, current.start + current.length)
  let condition_open = next_token(source, until_token.start + until_token.length)
  let left = next_token(source, condition_open.start + condition_open.length)
  let operator = expression_end(source, left)
  let left_length = value_expression_length(source, table, function, left)
  if (is_symbol(source, operator, 41) == 1) { return length + left_length + 5 }
  let right = next_token(source, operator.start + operator.length)
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  let right_length = value_expression_length(source, table, function, right)
  return length + left_length + right_length + 6
}

fn loop_conditional_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let called = condition_left(source, statement)
  let length = 4 + value_operand_length(source, table, function, called)
  let operator = operand_end(source, called)
  let right = next_token(source, operator.start + operator.length)
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  length = length + value_expression_length(source, table, function, right)
  let condition_end = expression_end(source, right)
  let open = condition_block_open(source, condition_end)
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (is_array_set_call(source, current) == 1) {
      length = length + mutation_length(source, table, function, current)
      current = expression_end(source, current)
    } else {
    if (is_break_keyword(source, current) == 1) {
      length = length + 2
      current = next_token(source, current.start + current.length)
    } else {
      if (is_if_keyword(source, current) == 1) {
        let nested_left = condition_left(source, current)
        let nested_open = next_token(source, nested_left.start + nested_left.length)
        let nested = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, nested_open, 40) == 1) {
          length = length + loop_conditional_length(source, table, function, current)
          nested = parse_loop_conditional(source, current.start)
        } else {
          length = length + loop_local_conditional_length(source, table, function, current)
          nested = parse_loop_local_conditional(source, current.start)
        }
        current = next_token(source, nested.position)
      } else {
        if (is_loop_keyword(source, current) == 1) {
          length = length + while_statement_length(source, table, function, current)
          let nested_while = parse_while_statement(source, current.start)
          current = next_token(source, nested_while.position)
        } else {
          if (is_return_keyword(source, current) == 1) {
            length = length + return_statement_length(source, table, function, current)
            let returned_operand = next_token(source, current.start + current.length)
            current = expression_end(source, returned_operand)
          } else {
            length = length + assignment_length(source, table, function, current)
            current = assignment_end(source, current)
          }
        }
      }
    }
    }
  }
  let after_then = next_token(source, current.start + current.length)
  if (is_else_keyword(source, after_then) == 1) {
    length = length + 1
    let else_open = next_token(source, after_then.start + after_then.length)
    let else_statement = next_token(source, else_open.start + else_open.length)
    while (is_symbol(source, else_statement, 125) == 0) {
      if (is_array_set_call(source, else_statement) == 1) {
        length = length + mutation_length(source, table, function, else_statement)
        else_statement = expression_end(source, else_statement)
      } else {
      if (is_break_keyword(source, else_statement) == 1) {
        length = length + 2
        else_statement = next_token(source, else_statement.start + else_statement.length)
      } else {
        if (is_if_keyword(source, else_statement) == 1) {
          let else_nested_left = condition_left(source, else_statement)
          let else_nested_open = next_token(source, else_nested_left.start + else_nested_left.length)
          let else_nested = function_definition(0, 0, 0, 0, else_statement.start, 0, 0)
          if (is_symbol(source, else_nested_open, 40) == 1) {
            length = length + loop_conditional_length(source, table, function, else_statement)
            else_nested = parse_loop_conditional(source, else_statement.start)
          } else {
            length = length + loop_local_conditional_length(source, table, function, else_statement)
            else_nested = parse_loop_local_conditional(source, else_statement.start)
          }
          else_statement = next_token(source, else_nested.position)
        } else {
          if (is_loop_keyword(source, else_statement) == 1) {
            length = length + while_statement_length(source, table, function, else_statement)
            let else_nested_while = parse_while_statement(source, else_statement.start)
            else_statement = next_token(source, else_nested_while.position)
          } else {
            if (is_return_keyword(source, else_statement) == 1) {
              length = length + return_statement_length(source, table, function, else_statement)
              let else_returned_operand = next_token(source, else_statement.start + else_statement.length)
              else_statement = expression_end(source, else_returned_operand)
            } else {
              length = length + assignment_length(source, table, function, else_statement)
              else_statement = assignment_end(source, else_statement)
          }
          }
        }
      }
      }
    }
  }
  return length
}

fn loop_local_conditional_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let left = condition_left(source, statement)
  let left_operator = next_token(source, left.start + left.length)
  let operator = left_operator
  let right = next_token(source, operator.start + operator.length)
  let length = operand_length(source, function, left) + 4
  if (is_symbol(source, left_operator, 46) == 1) {
    let left_field = next_token(source, left_operator.start + left_operator.length)
    let left_field_index = local_struct_field_index(source, table, function, left, left_field)
    length = length + 2 + u32_leb_length(left_field_index * 4)
    operator = next_token(source, left_field.start + left_field.length)
    right = next_token(source, operator.start + operator.length)
  }
  if (is_arithmetic_operator(source, left_operator) == 1) {
    length = length + operand_length(source, function, right) + 1
    operator = next_token(source, right.start + right.length)
    right = next_token(source, operator.start + operator.length)
  }
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  length = length + operand_length(source, function, right)
  let right_end = next_token(source, right.start + right.length)
  if (is_symbol(source, right_end, 46) == 1) {
    let right_field = next_token(source, right_end.start + right_end.length)
    let right_field_index = local_struct_field_index(source, table, function, right, right_field)
    length = length + 2 + u32_leb_length(right_field_index * 4)
    right_end = next_token(source, right_field.start + right_field.length)
  }
  let open = condition_block_open(source, right_end)
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (is_array_set_call(source, current) == 1) {
      length = length + mutation_length(source, table, function, current)
      current = expression_end(source, current)
    } else {
    if (is_break_keyword(source, current) == 1) {
      length = length + 2
      current = next_token(source, current.start + current.length)
    } else {
      if (is_if_keyword(source, current) == 1) {
        let nested_left = condition_left(source, current)
        let nested_open = next_token(source, nested_left.start + nested_left.length)
        let nested = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, nested_open, 40) == 1) {
          length = length + loop_conditional_length(source, table, function, current)
          nested = parse_loop_conditional(source, current.start)
        } else {
          length = length + loop_local_conditional_length(source, table, function, current)
          nested = parse_loop_local_conditional(source, current.start)
        }
        current = next_token(source, nested.position)
      } else {
        if (is_loop_keyword(source, current) == 1) {
          length = length + while_statement_length(source, table, function, current)
          let nested_while = parse_while_statement(source, current.start)
          current = next_token(source, nested_while.position)
        } else {
          if (is_return_keyword(source, current) == 1) {
            length = length + return_statement_length(source, table, function, current)
            let returned_operand = next_token(source, current.start + current.length)
            current = expression_end(source, returned_operand)
          } else {
            length = length + assignment_length(source, table, function, current)
            current = assignment_end(source, current)
          }
        }
      }
    }
    }
  }
  let after_then = next_token(source, current.start + current.length)
  if (is_else_keyword(source, after_then) == 1) {
    length = length + 1
    let else_open = next_token(source, after_then.start + after_then.length)
    let else_statement = next_token(source, else_open.start + else_open.length)
    while (is_symbol(source, else_statement, 125) == 0) {
      if (is_array_set_call(source, else_statement) == 1) {
        length = length + mutation_length(source, table, function, else_statement)
        else_statement = expression_end(source, else_statement)
      } else {
      if (is_break_keyword(source, else_statement) == 1) {
        length = length + 2
        else_statement = next_token(source, else_statement.start + else_statement.length)
      } else {
        if (is_if_keyword(source, else_statement) == 1) {
          let else_nested_left = condition_left(source, else_statement)
          let else_nested_open = next_token(source, else_nested_left.start + else_nested_left.length)
          let else_nested = function_definition(0, 0, 0, 0, else_statement.start, 0, 0)
          if (is_symbol(source, else_nested_open, 40) == 1) {
            length = length + loop_conditional_length(source, table, function, else_statement)
            else_nested = parse_loop_conditional(source, else_statement.start)
          } else {
            length = length + loop_local_conditional_length(source, table, function, else_statement)
            else_nested = parse_loop_local_conditional(source, else_statement.start)
          }
          else_statement = next_token(source, else_nested.position)
        } else {
          if (is_loop_keyword(source, else_statement) == 1) {
            length = length + while_statement_length(source, table, function, else_statement)
            let else_nested_while = parse_while_statement(source, else_statement.start)
            else_statement = next_token(source, else_nested_while.position)
          } else {
            if (is_return_keyword(source, else_statement) == 1) {
              length = length + return_statement_length(source, table, function, else_statement)
              let else_returned_operand = next_token(source, else_statement.start + else_statement.length)
              else_statement = expression_end(source, else_returned_operand)
            } else {
              length = length + assignment_length(source, table, function, else_statement)
              else_statement = assignment_end(source, else_statement)
          }
          }
        }
      }
      }
    }
  }
  return length
}

// returnの構造体判定と式の境界をthen/elseのlength・writerで共有する。
fn return_is_constructor(source: bytes, function: function_definition, value: token) -> i32 {
  let close = function_parameter_close(source, function)
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  return same_token(source, value, result_type)
}

fn returned_struct_size(source: bytes, function: function_definition) -> i32 {
  let close = function_parameter_close(source, function)
  let minus = next_token(source, close.start + close.length)
  let arrow = next_token(source, minus.start + minus.length)
  let result_type = next_token(source, arrow.start + arrow.length)
  let count = struct_field_count(source, result_type)
  if (count < 0) { return 0 }
  return count * 4
}

fn heap_restore_length(source: bytes, table: [i32], function: function_definition) -> i32 {
  let name_start = function.name_start
  let name_length = function.name_length
  if (function_reclaims_heap(source, table, function) == 0) { return 0 }
  let parameter_count = function_parameter_count_at(source, name_start, name_length)
  let local_count = local_count_of(source, function)
  let scratch = parameter_count + local_count
  let mark = scratch + 2
  let mark_length = u32_leb_length(mark)
  let size = returned_struct_size(source, function)
  if (size == 0) { return 3 + mark_length }
  let scratch_length = u32_leb_length(scratch)
  let size_length = i32_leb_length(size)
  return 25 + scratch_length * 4 + mark_length * 5 + size_length * 2
}

fn write_indexed_instruction(buffer: bytes, index: i32, opcode: i32, operand: i32) -> i32 {
  let position = index
  byte_set(buffer, index, opcode)
  let ignored = write_u32_leb(buffer, index + 1, operand)
  let length = u32_leb_length(operand)
  return index + 1 + length
}

fn write_heap_restore(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition) -> i32 {
  let name_start = function.name_start
  let name_length = function.name_length
  if (function_reclaims_heap(source, table, function) == 0) { return index }
  let parameter_count = function_parameter_count_at(source, name_start, name_length)
  let local_count = local_count_of(source, function)
  let scratch = parameter_count + local_count
  let mark = scratch + 2
  let position = index
  let size = returned_struct_size(source, function)
  if (size == 0) {
    position = write_indexed_instruction(buffer, position, 32, mark)
    position = write_indexed_instruction(buffer, position, 36, 0)
    return position
  }
  // 呼び出し前の値はそのまま返す。新規structだけをcheckpointへ移す。
  position = write_indexed_instruction(buffer, position, 33, scratch)
  position = write_indexed_instruction(buffer, position, 32, scratch)
  position = write_indexed_instruction(buffer, position, 32, mark)
  byte_set(buffer, position, 73)
  byte_set(buffer, position + 1, 4)
  byte_set(buffer, position + 2, 127)
  position = position + 3
  position = write_indexed_instruction(buffer, position, 32, scratch)
  position = write_indexed_instruction(buffer, position, 32, mark)
  position = write_indexed_instruction(buffer, position, 36, 0)
  byte_set(buffer, position, 5)
  position = position + 1
  position = write_indexed_instruction(buffer, position, 32, mark)
  position = write_indexed_instruction(buffer, position, 32, scratch)
  byte_set(buffer, position, 65)
  let ignored = write_i32_leb(buffer, position + 1, size)
  position = position + 1 + i32_leb_length(size)
  byte_set(buffer, position, 252)
  byte_set(buffer, position + 1, 10)
  byte_set(buffer, position + 2, 0)
  byte_set(buffer, position + 3, 0)
  position = position + 4
  position = write_indexed_instruction(buffer, position, 32, mark)
  byte_set(buffer, position, 65)
  ignored = write_i32_leb(buffer, position + 1, size)
  position = position + 1 + i32_leb_length(size)
  byte_set(buffer, position, 106)
  position = position + 1
  position = write_indexed_instruction(buffer, position, 36, 0)
  position = write_indexed_instruction(buffer, position, 32, mark)
  byte_set(buffer, position, 11)
  return position + 1
}

fn return_statement_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let value = next_token(source, statement.start + statement.length)
  if (function_returns_bytes(source, function) == 1) {
    let after = next_token(source, value.start + value.length)
    if (is_symbol(source, after, 40) == 0) {
      let bytes_length = bytes_argument_length(source, function, value) + 1
      return bytes_length
    }
  }
  let length = value_expression_length(source, table, function, value) + 1
  length = length + heap_restore_length(source, table, function)
  return length
}

fn write_return_statement(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let value = next_token(source, statement.start + statement.length)
  let position = index
  let after = next_token(source, value.start + value.length)
  let bytes_variable = 0
  if (function_returns_bytes(source, function) == 1) {
    if (is_symbol(source, after, 40) == 0) {
      bytes_variable = 1
    }
  }
  if (bytes_variable == 1) {
    position = write_bytes_argument(buffer, position, source, function, value)
  } else {
    position = write_value_expression(buffer, position, source, table, function, value)
  }
  position = write_heap_restore(buffer, position, source, table, function)
  byte_set(buffer, position, 15)
  return position + 1
}

fn assignment_name(source: bytes, statement: token) -> token {
  let name = statement
  if (is_let_keyword(source, name) == 1) {
    name = next_token(source, name.start + name.length)
  }
  if (is_set_keyword(source, statement) == 1) {
    name = next_token(source, statement.start + statement.length)
  }
  if (is_symbol(source, name, 40) == 1) {
    name = next_token(source, name.start + name.length)
  }
  return name
}

fn assignment_operand(source: bytes, statement: token) -> token {
  let name = assignment_name(source, statement)
  let equals = next_token(source, name.start + name.length)
  return next_token(source, equals.start + equals.length)
}

fn assignment_end(source: bytes, statement: token) -> token {
  let operand = assignment_operand(source, statement)
  if (is_symbol(source, operand, 45) == 1) {
    operand = next_token(source, operand.start + operand.length)
  }
  let end = expression_end(source, operand)
  let after_keyword = next_token(source, statement.start + statement.length)
  if (is_symbol(source, after_keyword, 40) == 1) {
    if (is_symbol(source, end, 41) == 1) {
      return next_token(source, end.start + end.length)
    }
  }
  return end
}

fn function_parameter_is_bytes(source: bytes, function: function_definition, target: i32) -> i32 {
  let name = token(1, function.name_start, function.name_length)
  let open = next_token(source, name.start + name.length)
  let current = next_token(source, open.start + open.length)
  let index = 0
  while (is_symbol(source, current, 41) == 0) {
    let colon = next_token(source, current.start + current.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    if (index == target) {
      if (is_bytes_type(source, parameter_type) == 1) {
        return 1
      }
      if (is_symbol(source, parameter_type, 91) == 1) {
        return 1
      }
      return 0
    }
    let parameter_type_end = type_end(source, parameter_type)
    current = next_token(source, parameter_type_end.start + parameter_type_end.length)
    if (is_symbol(source, current, 44) == 1) {
      current = next_token(source, current.start + current.length)
    }
    index = index + 1
  }
  return 0
}

fn bytes_argument_length(source: bytes, function: function_definition, argument: token) -> i32 {
  let index = variable_index(source, function, argument)
  if (index < 0) {
    index = lexical_variable_index(source, function, argument)
  }
  if (index < 0) {
    index = fixed_variable_index(source, function, argument)
  }
  let next_index = index + 1
  let result = 2
  result = result + u32_leb_length(index)
  result = result + u32_leb_length(next_index)
  return result
}

fn write_bytes_argument(buffer: bytes, index: i32, source: bytes, function: function_definition, argument: token) -> i32 {
  let ignored = buffer
  let variable = variable_index(source, function, argument)
  if (variable < 0) {
    variable = lexical_variable_index(source, function, argument)
  }
  if (variable < 0) {
    variable = fixed_variable_index(source, function, argument)
  }
  let next_variable = variable + 1
  byte_set(buffer, index, 32)
  let pointer_length = u32_leb_length(variable)
  ignored = write_u32_leb(buffer, index + 1, variable)
  byte_set(buffer, index + 1 + pointer_length, 32)
  let length_length = u32_leb_length(next_variable)
  ignored = write_u32_leb(buffer, index + 2 + pointer_length, next_variable)
  return index + 2 + pointer_length + length_length
}

fn value_operand_length(source: bytes, table: [i32], function: function_definition, operand: token) -> i32 {
  let length = 0
  let after = next_token(source, operand.start + operand.length)
  if (is_symbol(source, operand, 45) == 1) {
    return 3 + value_operand_length(source, table, function, after)
  }
  if (is_symbol(source, after, 40) == 1) {
    let argument = next_token(source, after.start + after.length)
    if (struct_field_count(source, operand) >= 0) {
      let local_count = local_count_of(source, function)
      let parameter_count = function_parameter_count_of(source, function)
      let scratch = parameter_count + local_count
      let field_count = struct_field_count(source, operand)
      let offset = 0
      let scratch_length = u32_leb_length(scratch)
      let value_length = u32_leb_length(scratch + 1)
      let allocation_length = i32_leb_length(field_count * 4)
      while (is_symbol(source, argument, 41) == 0) {
        length = length + value_expression_length(source, table, function, argument)
        length = length + 5 + scratch_length + value_length * 2 + u32_leb_length(offset)
        let constructor_separator = expression_end(source, argument)
        if (is_symbol(source, constructor_separator, 44) == 1) {
          argument = next_token(source, constructor_separator.start + constructor_separator.length)
        } else {
          argument = constructor_separator
        }
        offset = offset + 4
      }
      return length + 8 + scratch_length * 2 + allocation_length
    }
    if (is_byte_length_call(source, operand) == 1) {
      let length_index = variable_index(source, function, argument) + 1
      if (length_index == 0) {
        length_index = lexical_variable_index(source, function, argument) + 1
      }
      return 1 + u32_leb_length(length_index)
    }
    if (is_byte_pointer_call(source, operand) == 1) {
      return operand_length(source, function, argument)
    }
    if (is_array_get_call(source, operand) == 1) {
      let index_separator = next_token(source, argument.start + argument.length)
      let index_expression = next_token(source, index_separator.start + index_separator.length)
      return operand_length(source, function, argument) + value_expression_length(source, table, function, index_expression) + 7
    }
    if (is_allocate_i32_array_call(source, operand) == 1) {
      return 10 + value_expression_length(source, table, function, argument) * 2
    }
    if (is_allocate_bytes_call(source, operand) == 1) {
      return 7 + value_expression_length(source, table, function, argument) * 2
    }
    if (is_byte_at_call(source, operand) == 1) {
      let byte_index_separator = expression_end(source, argument)
      let byte_index_expression = next_token(source, byte_index_separator.start + byte_index_separator.length)
      let byte_result = operand_length(source, function, argument) + value_expression_length(source, table, function, byte_index_expression) + 4
      return byte_result
    }
    let called_index = function_index_in_table(source, table, operand)
    let called = function_at_index(source, called_index)
    let argument_index = 0
    while (is_symbol(source, argument, 41) == 0) {
      if (function_parameter_is_bytes(source, called, argument_index) == 1) {
        length = length + bytes_argument_length(source, function, argument)
      } else {
        length = length + value_expression_length(source, table, function, argument)
      }
      let separator = expression_end(source, argument)
      if (is_symbol(source, separator, 44) == 1) {
        argument = next_token(source, separator.start + separator.length)
      } else {
        argument = separator
      }
      argument_index = argument_index + 1
    }
    let result = length + 1 + u32_leb_length(called_index)
    return result
  }
  length = operand_length(source, function, operand)
  if (is_symbol(source, after, 46) == 1) {
    let field = next_token(source, after.start + after.length)
    let field_index = local_struct_field_index(source, table, function, operand, field)
    length = length + 2 + u32_leb_length(field_index * 4)
  }
  return length
}

fn is_multiplicative_operator(source: bytes, value: token) -> i32 {
  if (is_symbol(source, value, 42) == 1) {
    return 1
  }
  return is_symbol(source, value, 47)
}

fn value_term_length(source: bytes, table: [i32], function: function_definition, operand: token) -> i32 {
  let length = value_operand_length(source, table, function, operand)
  let current = operand_end(source, operand)
  while (is_multiplicative_operator(source, current) == 1) {
    let next_operand = next_token(source, current.start + current.length)
    length = length + value_operand_length(source, table, function, next_operand) + 1
    current = operand_end(source, next_operand)
  }
  return length
}

fn value_expression_length(source: bytes, table: [i32], function: function_definition, operand: token) -> i32 {
  let length = value_term_length(source, table, function, operand)
  let current = operand_end(source, operand)
  while (is_multiplicative_operator(source, current) == 1) {
    let next_operand = next_token(source, current.start + current.length)
    current = operand_end(source, next_operand)
  }
  while (is_arithmetic_operator(source, current) == 1) {
    let additive_operand = next_token(source, current.start + current.length)
    length = length + value_term_length(source, table, function, additive_operand) + 1
    current = operand_end(source, additive_operand)
    while (is_multiplicative_operator(source, current) == 1) {
      let next_factor = next_token(source, current.start + current.length)
      current = operand_end(source, next_factor)
    }
  }
  return length
}

fn assignment_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let name = assignment_name(source, statement)
  let operand = assignment_operand(source, statement)
  let local_index = variable_index(source, function, name)
  if (local_index < 0) {
    local_index = lexical_variable_index(source, function, name)
  }
  if (local_index < 0) {
    local_index = fixed_variable_index(source, function, name)
  }
  let result = value_expression_length(source, table, function, operand)
  if (is_array_assignment(source, operand) == 1) {
    result = result + 2 + u32_leb_length(local_index + 1) + u32_leb_length(local_index)
  } else {
    result = result + 1 + u32_leb_length(local_index)
  }
  return result
}

fn write_value_operand(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, operand: token) -> i32 {
  let position = index
  let after = next_token(source, operand.start + operand.length)
  if (is_symbol(source, operand, 45) == 1) {
    byte_set(buffer, position, 65)
    byte_set(buffer, position + 1, 0)
    position = write_value_operand(buffer, position + 2, source, table, function, after)
    byte_set(buffer, position, 107)
    return position + 1
  }
  if (is_symbol(source, after, 40) == 1) {
    let argument = next_token(source, after.start + after.length)
    if (struct_field_count(source, operand) >= 0) {
      let local_count = local_count_of(source, function)
      let parameter_count = function_parameter_count_of(source, function)
      let scratch = parameter_count + local_count
      let field_count = struct_field_count(source, operand)
      let ignored = buffer
      let scratch_value = scratch + 1
      let allocation_size = field_count * 4
      // 全引数を評価してから確保する。nested call中は値がWasm stackに残る。
      while (is_symbol(source, argument, 41) == 0) {
        position = write_value_expression(buffer, position, source, table, function, argument)
        let constructor_separator = expression_end(source, argument)
        if (is_symbol(source, constructor_separator, 44) == 1) {
          argument = next_token(source, constructor_separator.start + constructor_separator.length)
        } else {
          argument = constructor_separator
        }
      }
      byte_set(buffer, position, 35)
      byte_set(buffer, position + 1, 0)
      byte_set(buffer, position + 2, 34)
      ignored = write_u32_leb(buffer, position + 3, scratch)
      position = position + 3 + u32_leb_length(scratch)
      byte_set(buffer, position, 65)
      ignored = write_i32_leb(buffer, position + 1, allocation_size)
      position = position + 1 + i32_leb_length(allocation_size)
      byte_set(buffer, position, 106)
      byte_set(buffer, position + 1, 36)
      byte_set(buffer, position + 2, 0)
      position = position + 3
      let offset = field_count * 4
      while (offset > 0) {
        offset = offset - 4
        byte_set(buffer, position, 33)
        ignored = write_u32_leb(buffer, position + 1, scratch_value)
        position = position + 1 + u32_leb_length(scratch_value)
        byte_set(buffer, position, 32)
        ignored = write_u32_leb(buffer, position + 1, scratch)
        position = position + 1 + u32_leb_length(scratch)
        byte_set(buffer, position, 32)
        ignored = write_u32_leb(buffer, position + 1, scratch_value)
        position = position + 1 + u32_leb_length(scratch_value)
        byte_set(buffer, position, 54)
        byte_set(buffer, position + 1, 2)
        ignored = write_u32_leb(buffer, position + 2, offset)
        position = position + 2 + u32_leb_length(offset)
      }
      byte_set(buffer, position, 32)
      ignored = write_u32_leb(buffer, position + 1, scratch)
      return position + 1 + u32_leb_length(scratch)
    }
    if (is_byte_length_call(source, operand) == 1) {
      let length_index = variable_index(source, function, argument) + 1
      if (length_index == 0) {
        length_index = lexical_variable_index(source, function, argument) + 1
      }
      byte_set(buffer, position, 32)
      let length_written = write_u32_leb(buffer, position + 1, length_index)
      let result = position + 1 + u32_leb_length(length_index)
      return result
    }
    if (is_byte_pointer_call(source, operand) == 1) {
      return write_operand(buffer, position, source, function, argument)
    }
    if (is_array_get_call(source, operand) == 1) {
      let index_separator = next_token(source, argument.start + argument.length)
      let index_expression = next_token(source, index_separator.start + index_separator.length)
      position = write_operand(buffer, position, source, function, argument)
      position = write_value_expression(buffer, position, source, table, function, index_expression)
      byte_set(buffer, position, 65)
      byte_set(buffer, position + 1, 4)
      byte_set(buffer, position + 2, 108)
      byte_set(buffer, position + 3, 106)
      byte_set(buffer, position + 4, 40)
      byte_set(buffer, position + 5, 2)
      byte_set(buffer, position + 6, 0)
      return position + 7
    }
    if (is_allocate_i32_array_call(source, operand) == 1) {
      byte_set(buffer, position, 35)
      byte_set(buffer, position + 1, 0)
      byte_set(buffer, position + 2, 35)
      byte_set(buffer, position + 3, 0)
      position = write_value_expression(buffer, position + 4, source, table, function, argument)
      byte_set(buffer, position, 65)
      byte_set(buffer, position + 1, 4)
      byte_set(buffer, position + 2, 108)
      byte_set(buffer, position + 3, 106)
      byte_set(buffer, position + 4, 36)
      byte_set(buffer, position + 5, 0)
      position = position + 6
      position = write_value_expression(buffer, position, source, table, function, argument)
      return position
    }
    if (is_allocate_bytes_call(source, operand) == 1) {
      byte_set(buffer, position, 35)
      byte_set(buffer, position + 1, 0)
      byte_set(buffer, position + 2, 35)
      byte_set(buffer, position + 3, 0)
      position = write_value_expression(buffer, position + 4, source, table, function, argument)
      byte_set(buffer, position, 106)
      byte_set(buffer, position + 1, 36)
      byte_set(buffer, position + 2, 0)
      position = position + 3
      position = write_value_expression(buffer, position, source, table, function, argument)
      return position
    }
    if (is_byte_at_call(source, operand) == 1) {
      let byte_index_separator = expression_end(source, argument)
      let byte_index_expression = next_token(source, byte_index_separator.start + byte_index_separator.length)
      position = write_operand(buffer, position, source, function, argument)
      position = write_value_expression(buffer, position, source, table, function, byte_index_expression)
      byte_set(buffer, position, 106)
      byte_set(buffer, position + 1, 45)
      byte_set(buffer, position + 2, 0)
      byte_set(buffer, position + 3, 0)
      return position + 4
    }
    let called_index = function_index_in_table(source, table, operand)
    let called = function_at_index(source, called_index)
    let argument_index = 0
    while (is_symbol(source, argument, 41) == 0) {
      if (function_parameter_is_bytes(source, called, argument_index) == 1) {
        position = write_bytes_argument(buffer, position, source, function, argument)
      } else {
        position = write_value_expression(buffer, position, source, table, function, argument)
      }
      let separator = expression_end(source, argument)
      if (is_symbol(source, separator, 44) == 1) {
        argument = next_token(source, separator.start + separator.length)
      } else {
        argument = separator
      }
      argument_index = argument_index + 1
    }
    byte_set(buffer, position, 16)
    let call_written = write_u32_leb(buffer, position + 1, called_index)
    let call_result = position + 1 + u32_leb_length(called_index)
    return call_result
  }
  position = write_operand(buffer, position, source, function, operand)
  if (is_symbol(source, after, 46) == 1) {
    let field = next_token(source, after.start + after.length)
    let field_index = local_struct_field_index(source, table, function, operand, field)
    byte_set(buffer, position, 40)
    byte_set(buffer, position + 1, 2)
    let field_written = write_u32_leb(buffer, position + 2, field_index * 4)
    position = position + 2 + u32_leb_length(field_index * 4)
  }
  return position
}

fn write_value_term(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, operand: token) -> i32 {
  let position = write_value_operand(buffer, index, source, table, function, operand)
  let current = operand_end(source, operand)
  while (is_multiplicative_operator(source, current) == 1) {
    let next_operand = next_token(source, current.start + current.length)
    position = write_value_operand(buffer, position, source, table, function, next_operand)
    byte_set(buffer, position, arithmetic_opcode(source, current))
    position = position + 1
    current = operand_end(source, next_operand)
  }
  return position
}

fn write_value_expression(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, operand: token) -> i32 {
  let position = write_value_term(buffer, index, source, table, function, operand)
  let current = operand_end(source, operand)
  while (is_multiplicative_operator(source, current) == 1) {
    let next_operand = next_token(source, current.start + current.length)
    current = operand_end(source, next_operand)
  }
  while (is_arithmetic_operator(source, current) == 1) {
    let additive_operator = current
    let additive_operand = next_token(source, current.start + current.length)
    position = write_value_term(buffer, position, source, table, function, additive_operand)
    byte_set(buffer, position, arithmetic_opcode(source, additive_operator))
    position = position + 1
    current = operand_end(source, additive_operand)
    while (is_multiplicative_operator(source, current) == 1) {
      let next_factor = next_token(source, current.start + current.length)
      current = operand_end(source, next_factor)
    }
  }
  return position
}

fn write_array_assignment(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, operand: token, local_index: i32) -> i32 {
  let position = write_value_expression(buffer, index, source, table, function, operand)
  byte_set(buffer, position, 33)
  let length_written = write_u32_leb(buffer, position + 1, local_index + 1)
  let length_position = position + 1 + u32_leb_length(local_index + 1)
  byte_set(length_written, length_position, 33)
  let pointer_written = write_u32_leb(buffer, length_position + 1, local_index)
  let result = length_position + 1 + u32_leb_length(local_index)
  return result
}

fn write_assignment(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let name = assignment_name(source, statement)
  let operand = assignment_operand(source, statement)
  let local_index = variable_index(source, function, name)
  if (local_index < 0) {
    local_index = lexical_variable_index(source, function, name)
  }
  if (local_index < 0) {
    local_index = fixed_variable_index(source, function, name)
  }
  let position = write_value_expression(buffer, index, source, table, function, operand)
  if (is_array_assignment(source, operand) == 1) {
    return write_array_assignment(buffer, index, source, table, function, operand, local_index)
  } else {
    byte_set(buffer, position, 33)
    let written = write_u32_leb(buffer, position + 1, local_index)
    let result = position + 1 + u32_leb_length(local_index)
    return result
  }
  return index
}

fn local_return_conditional_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let length = loop_conditional_length(source, table, function, statement)
  return length
}

fn local_body_length(source: bytes, table: [i32], function: function_definition) -> i32 {
  let local_count = local_count_of(source, function) + 3
  let current = function_body_first_token(source, function)
  let length = 1
  if (local_count > 0) {
    length = 2 + u32_leb_length(local_count)
  }
  if (function_reclaims_heap(source, table, function) == 1) {
    let mark = function_parameter_count_of(source, function) + local_count - 1
    length = length + 3 + u32_leb_length(mark)
  }
  while (is_return_keyword(source, current) == 0) {
    while (is_local_assignment(source, current) == 1) {
      length = length + assignment_length(source, table, function, current)
      current = assignment_end(source, current)
    }
    while (is_array_set_call(source, current) == 1) {
      length = length + mutation_length(source, table, function, current)
      current = expression_end(source, current)
    }
    if (is_loop_keyword(source, current) == 1) {
      length = length + while_statement_length(source, table, function, current)
      let statement = parse_while_statement(source, current.start)
      current = next_token(source, statement.position)
    }
    while (is_if_keyword(source, current) == 1) {
      let conditional_left = condition_left(source, current)
      let conditional_operator = next_token(source, conditional_left.start + conditional_left.length)
      let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
      if (is_symbol(source, conditional_operator, 40) == 1) {
        let call_conditional_open = next_token(source, conditional_operator.start + conditional_operator.length)
        let call_conditional_first = next_token(source, call_conditional_open.start + call_conditional_open.length)
        if (is_return_keyword(source, call_conditional_first) == 1) {
          length = length + local_return_conditional_length(source, table, function, current)
          conditional = parse_local_return_conditional(source, current.start)
        } else {
          length = length + loop_conditional_length(source, table, function, current)
          conditional = parse_loop_conditional(source, current.start)
        }
      } else {
        if (is_symbol(source, conditional_operator, 46) == 1) {
          length = length + local_return_conditional_length(source, table, function, current)
          conditional = parse_local_return_conditional(source, current.start)
        } else {
          length = length + local_return_conditional_length(source, table, function, current)
          conditional = parse_local_return_conditional(source, current.start)
        }
      }
      current = next_token(source, conditional.position)
    }
  }
  let result = length + return_statement_length(source, table, function, current) + 1
  return result
}

fn write_operand(buffer: bytes, index: i32, source: bytes, function: function_definition, operand: token) -> i32 {
  if (is_symbol(source, operand, 45) == 1) {
    let negative_operand = next_token(source, operand.start + operand.length)
    byte_set(buffer, index, 65)
    byte_set(buffer, index + 1, 0)
    let negative_written = write_operand(buffer, index + 2, source, function, negative_operand)
    byte_set(buffer, negative_written, 107)
    return negative_written + 1
  }
  let after = next_token(source, operand.start + operand.length)
  if (is_byte_at_call(source, operand) == 1) {
    let first_argument = next_token(source, after.start + after.length)
    let first_written = write_operand(buffer, index, source, function, first_argument)
    let separator = next_token(source, first_argument.start + first_argument.length)
    let second_argument = next_token(source, separator.start + separator.length)
    let second_written = write_operand(buffer, first_written, source, function, second_argument)
    byte_set(buffer, second_written, 106)
    byte_set(buffer, second_written + 1, 45)
    byte_set(buffer, second_written + 2, 0)
    byte_set(buffer, second_written + 3, 0)
    return second_written + 4
  }
  if (operand.kind == 2) {
    byte_set(buffer, index, 65)
    let value = read_small_integer(source, operand)
    let integer_written = write_i32_leb(buffer, index + 1, value)
    let integer_length = i32_leb_length(value)
    let result = index + 1 + integer_length
    return result
  }
  byte_set(buffer, index, 32)
  let variable = variable_index(source, function, operand)
  if (variable < 0) {
    variable = lexical_variable_index(source, function, operand)
  }
  if (variable < 0) {
    variable = fixed_variable_index(source, function, operand)
  }
  let variable_written = write_u32_leb(buffer, index + 1, variable)
  let variable_length = u32_leb_length(variable)
  let variable_result = index + 1 + variable_length
  return variable_result
}

fn mutation_length(source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let called = statement
  let open = next_token(source, called.start + called.length)
  let target = next_token(source, open.start + open.length)
  let separator = next_token(source, target.start + target.length)
  let mutation_index = next_token(source, separator.start + separator.length)
  separator = expression_end(source, mutation_index)
  let value = next_token(source, separator.start + separator.length)
  let length = value_expression_length(source, table, function, target)
  length = length + value_expression_length(source, table, function, mutation_index)
  length = length + value_expression_length(source, table, function, value)
  if (called.length == 8) {
    return length + 4
  }
  return length + 7
}

fn write_mutation(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let called = statement
  let open = next_token(source, called.start + called.length)
  let target = next_token(source, open.start + open.length)
  let separator = next_token(source, target.start + target.length)
  let mutation_index = next_token(source, separator.start + separator.length)
  separator = expression_end(source, mutation_index)
  let value = next_token(source, separator.start + separator.length)
  let position = write_value_expression(buffer, index, source, table, function, target)
  position = write_value_expression(buffer, position, source, table, function, mutation_index)
  if (called.length == 8) {
    byte_set(buffer, position, 106)
    position = position + 1
  } else {
    byte_set(buffer, position, 65)
    byte_set(buffer, position + 1, 4)
    byte_set(buffer, position + 2, 108)
    byte_set(buffer, position + 3, 106)
    position = position + 4
  }
  position = write_value_expression(buffer, position, source, table, function, value)
  if (called.length == 8) {
    byte_set(buffer, position, 58)
    byte_set(buffer, position + 1, 0)
    byte_set(buffer, position + 2, 0)
  } else {
    byte_set(buffer, position, 54)
    byte_set(buffer, position + 1, 2)
    byte_set(buffer, position + 2, 0)
  }
  return position + 3
}

fn write_while_statement(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  if (is_do_keyword(source, statement) == 1) {
    return write_do_until_statement(buffer, index, source, table, function, statement)
  }
  let position = index
  byte_set(buffer, position, 2)
  byte_set(buffer, position + 1, 64)
  byte_set(buffer, position + 2, 3)
  byte_set(buffer, position + 3, 64)
  position = position + 4
  let left = condition_left(source, statement)
  let operator = expression_end(source, left)
  position = write_value_expression(buffer, position, source, table, function, left)
  let right = next_token(source, operator.start + operator.length)
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  let right_end = expression_end(source, right)
  position = write_value_expression(buffer, position, source, table, function, right)
  byte_set(buffer, position, comparison_opcode(source, operator))
  byte_set(buffer, position + 1, 69)
  byte_set(buffer, position + 2, 13)
  byte_set(buffer, position + 3, 1)
  position = position + 4
  let open = condition_block_open(source, right_end)
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (is_array_set_call(source, current) == 1) {
      position = write_mutation(buffer, position, source, table, function, current)
      current = expression_end(source, current)
    } else {
    if (is_loop_keyword(source, current) == 1) {
      position = write_while_statement(buffer, position, source, table, function, current)
      let nested_while = parse_while_statement(source, current.start)
      current = next_token(source, nested_while.position)
    } else {
    if (is_if_keyword(source, current) == 1) {
      let conditional_left = condition_left(source, current)
      let conditional_open = next_token(source, conditional_left.start + conditional_left.length)
      let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
      if (is_symbol(source, conditional_open, 40) == 1) {
        position = write_loop_conditional(buffer, position, source, table, function, current, 2)
        conditional = parse_loop_conditional(source, current.start)
      } else {
        position = write_loop_local_conditional(buffer, position, source, table, function, current, 2)
        conditional = parse_loop_local_conditional(source, current.start)
      }
      current = next_token(source, conditional.position)
    } else {
      position = write_assignment(buffer, position, source, table, function, current)
      current = assignment_end(source, current)
    }
    }
    }
  }
  byte_set(buffer, position, 12)
  byte_set(buffer, position + 1, 0)
  byte_set(buffer, position + 2, 11)
  byte_set(buffer, position + 3, 11)
  return position + 4
}

fn write_do_until_statement(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token) -> i32 {
  let position = index
  byte_set(buffer, position, 2)
  byte_set(buffer, position + 1, 64)
  byte_set(buffer, position + 2, 3)
  byte_set(buffer, position + 3, 64)
  position = position + 4
  let open = next_token(source, statement.start + statement.length)
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (is_return_keyword(source, current) == 1) {
      position = write_return_statement(buffer, position, source, table, function, current)
      let returned = next_token(source, current.start + current.length)
      current = expression_end(source, returned)
    } else {
      if (is_array_set_call(source, current) == 1) {
        position = write_mutation(buffer, position, source, table, function, current)
        current = expression_end(source, current)
      } else {
        if (is_break_keyword(source, current) == 1) {
          byte_set(buffer, position, 12)
          byte_set(buffer, position + 1, 1)
          position = position + 2
          current = next_token(source, current.start + current.length)
        } else {
          if (is_loop_keyword(source, current) == 1) {
            position = write_while_statement(buffer, position, source, table, function, current)
            let nested = parse_while_statement(source, current.start)
            current = next_token(source, nested.position)
          } else {
            if (is_if_keyword(source, current) == 1) {
              let conditional_left = condition_left(source, current)
              let after_left = next_token(source, conditional_left.start + conditional_left.length)
              if (is_symbol(source, after_left, 40) == 1) {
                position = write_loop_conditional(buffer, position, source, table, function, current, 2)
              } else {
                position = write_loop_local_conditional(buffer, position, source, table, function, current, 2)
              }
              let conditional = parse_loop_conditional_if(source, current)
              current = next_token(source, conditional.position)
            } else {
              position = write_assignment(buffer, position, source, table, function, current)
              current = assignment_end(source, current)
            }
          }
        }
      }
    }
  }
  let until_token = next_token(source, current.start + current.length)
  let condition_open = next_token(source, until_token.start + until_token.length)
  let left = next_token(source, condition_open.start + condition_open.length)
  let operator = expression_end(source, left)
  position = write_value_expression(buffer, position, source, table, function, left)
  if (is_symbol(source, operator, 41) == 0) {
    let right = next_token(source, operator.start + operator.length)
    if (is_symbol(source, right, 61) == 1) {
      right = next_token(source, right.start + right.length)
    }
    position = write_value_expression(buffer, position, source, table, function, right)
    byte_set(buffer, position, comparison_opcode(source, operator))
    position = position + 1
  }
  byte_set(buffer, position, 69)
  byte_set(buffer, position + 1, 13)
  byte_set(buffer, position + 2, 0)
  byte_set(buffer, position + 3, 11)
  byte_set(buffer, position + 4, 11)
  return position + 5
}

fn write_loop_conditional(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition, statement: token, break_depth: i32) -> i32 {
  let position = index
  let called = condition_left(source, statement)
  position = write_value_operand(buffer, position, source, table, function, called)
  let operator = operand_end(source, called)
  let right = next_token(source, operator.start + operator.length)
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  position = write_value_expression(buffer, position, source, table, function, right)
  let condition_end = expression_end(source, right)
  let open = condition_block_open(source, condition_end)
  byte_set(buffer, position, comparison_opcode(source, operator))
  byte_set(buffer, position + 1, 4)
  byte_set(buffer, position + 2, 64)
  position = position + 3
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (is_array_set_call(source, current) == 1) {
      position = write_mutation(buffer, position, source, table, function, current)
      current = expression_end(source, current)
    } else {
    if (is_break_keyword(source, current) == 1) {
      byte_set(buffer, position, 12)
      byte_set(buffer, position + 1, break_depth)
      position = position + 2
      current = next_token(source, current.start + current.length)
    } else {
      if (is_if_keyword(source, current) == 1) {
        let nested_left = condition_left(source, current)
        let nested_open = next_token(source, nested_left.start + nested_left.length)
        let nested = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, nested_open, 40) == 1) {
          position = write_loop_conditional(buffer, position, source, table, function, current, break_depth + 1)
          nested = parse_loop_conditional(source, current.start)
        } else {
          position = write_loop_local_conditional(buffer, position, source, table, function, current, break_depth + 1)
          nested = parse_loop_local_conditional(source, current.start)
        }
        current = next_token(source, nested.position)
      } else {
        if (is_loop_keyword(source, current) == 1) {
          position = write_while_statement(buffer, position, source, table, function, current)
          let nested_while = parse_while_statement(source, current.start)
          current = next_token(source, nested_while.position)
        } else {
          if (is_return_keyword(source, current) == 1) {
            position = write_return_statement(buffer, position, source, table, function, current)
            let returned_operand = next_token(source, current.start + current.length)
            current = expression_end(source, returned_operand)
          } else {
            position = write_assignment(buffer, position, source, table, function, current)
            current = assignment_end(source, current)
          }
        }
      }
    }
    }
  }
  let after_then = next_token(source, current.start + current.length)
  if (is_else_keyword(source, after_then) == 1) {
    byte_set(buffer, position, 5)
    position = position + 1
    let else_open = next_token(source, after_then.start + after_then.length)
    let else_statement = next_token(source, else_open.start + else_open.length)
    while (is_symbol(source, else_statement, 125) == 0) {
      if (is_array_set_call(source, else_statement) == 1) {
        position = write_mutation(buffer, position, source, table, function, else_statement)
        else_statement = expression_end(source, else_statement)
      } else {
      if (is_break_keyword(source, else_statement) == 1) {
        byte_set(buffer, position, 12)
        byte_set(buffer, position + 1, break_depth)
        position = position + 2
        else_statement = next_token(source, else_statement.start + else_statement.length)
      } else {
        if (is_if_keyword(source, else_statement) == 1) {
          let else_nested_left = condition_left(source, else_statement)
          let else_nested_open = next_token(source, else_nested_left.start + else_nested_left.length)
          let else_nested = function_definition(0, 0, 0, 0, else_statement.start, 0, 0)
          if (is_symbol(source, else_nested_open, 40) == 1) {
            position = write_loop_conditional(buffer, position, source, table, function, else_statement, break_depth + 1)
            else_nested = parse_loop_conditional(source, else_statement.start)
          } else {
            position = write_loop_local_conditional(buffer, position, source, table, function, else_statement, break_depth + 1)
            else_nested = parse_loop_local_conditional(source, else_statement.start)
          }
          else_statement = next_token(source, else_nested.position)
        } else {
          if (is_loop_keyword(source, else_statement) == 1) {
            position = write_while_statement(buffer, position, source, table, function, else_statement)
            let else_nested_while = parse_while_statement(source, else_statement.start)
            else_statement = next_token(source, else_nested_while.position)
          } else {
            if (is_return_keyword(source, else_statement) == 1) {
              position = write_return_statement(buffer, position, source, table, function, else_statement)
              let else_returned_operand = next_token(source, else_statement.start + else_statement.length)
              else_statement = expression_end(source, else_returned_operand)
            } else {
              position = write_assignment(buffer, position, source, table, function, else_statement)
              else_statement = assignment_end(source, else_statement)
          }
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
  let left = condition_left(source, statement)
  let left_operator = next_token(source, left.start + left.length)
  let operator = left_operator
  let right = next_token(source, operator.start + operator.length)
  position = write_operand(buffer, position, source, function, left)
  if (is_symbol(source, left_operator, 46) == 1) {
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
  if (is_arithmetic_operator(source, left_operator) == 1) {
    position = write_operand(buffer, position, source, function, right)
    byte_set(buffer, position, arithmetic_opcode(source, left_operator))
    position = position + 1
    operator = next_token(source, right.start + right.length)
    right = next_token(source, operator.start + operator.length)
  }
  if (is_symbol(source, right, 61) == 1) {
    right = next_token(source, right.start + right.length)
  }
  position = write_operand(buffer, position, source, function, right)
  let right_end = next_token(source, right.start + right.length)
  if (is_symbol(source, right_end, 46) == 1) {
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
  let open = condition_block_open(source, right_end)
  let current = next_token(source, open.start + open.length)
  while (is_symbol(source, current, 125) == 0) {
    if (is_array_set_call(source, current) == 1) {
      position = write_mutation(buffer, position, source, table, function, current)
      current = expression_end(source, current)
    } else {
    if (is_break_keyword(source, current) == 1) {
      byte_set(buffer, position, 12)
      byte_set(buffer, position + 1, break_depth)
      position = position + 2
      current = next_token(source, current.start + current.length)
    } else {
      if (is_if_keyword(source, current) == 1) {
        let nested_left = condition_left(source, current)
        let nested_open = next_token(source, nested_left.start + nested_left.length)
        let nested = function_definition(0, 0, 0, 0, current.start, 0, 0)
        if (is_symbol(source, nested_open, 40) == 1) {
          position = write_loop_conditional(buffer, position, source, table, function, current, break_depth + 1)
          nested = parse_loop_conditional(source, current.start)
        } else {
          position = write_loop_local_conditional(buffer, position, source, table, function, current, break_depth + 1)
          nested = parse_loop_local_conditional(source, current.start)
        }
        current = next_token(source, nested.position)
      } else {
        if (is_loop_keyword(source, current) == 1) {
          position = write_while_statement(buffer, position, source, table, function, current)
          let nested_while = parse_while_statement(source, current.start)
          current = next_token(source, nested_while.position)
        } else {
          if (is_return_keyword(source, current) == 1) {
            position = write_return_statement(buffer, position, source, table, function, current)
            let returned_operand = next_token(source, current.start + current.length)
            current = expression_end(source, returned_operand)
          } else {
            position = write_assignment(buffer, position, source, table, function, current)
            current = assignment_end(source, current)
          }
        }
      }
    }
    }
  }
  let after_then = next_token(source, current.start + current.length)
  if (is_else_keyword(source, after_then) == 1) {
    byte_set(buffer, position, 5)
    position = position + 1
    let else_open = next_token(source, after_then.start + after_then.length)
    let else_statement = next_token(source, else_open.start + else_open.length)
    while (is_symbol(source, else_statement, 125) == 0) {
      if (is_array_set_call(source, else_statement) == 1) {
        position = write_mutation(buffer, position, source, table, function, else_statement)
        else_statement = expression_end(source, else_statement)
      } else {
      if (is_break_keyword(source, else_statement) == 1) {
        byte_set(buffer, position, 12)
        byte_set(buffer, position + 1, break_depth)
        position = position + 2
        else_statement = next_token(source, else_statement.start + else_statement.length)
      } else {
        if (is_if_keyword(source, else_statement) == 1) {
          let else_nested_left = condition_left(source, else_statement)
          let else_nested_open = next_token(source, else_nested_left.start + else_nested_left.length)
          let else_nested = function_definition(0, 0, 0, 0, else_statement.start, 0, 0)
          if (is_symbol(source, else_nested_open, 40) == 1) {
            position = write_loop_conditional(buffer, position, source, table, function, else_statement, break_depth + 1)
            else_nested = parse_loop_conditional(source, else_statement.start)
          } else {
            position = write_loop_local_conditional(buffer, position, source, table, function, else_statement, break_depth + 1)
            else_nested = parse_loop_local_conditional(source, else_statement.start)
          }
          else_statement = next_token(source, else_nested.position)
        } else {
          if (is_loop_keyword(source, else_statement) == 1) {
            position = write_while_statement(buffer, position, source, table, function, else_statement)
            let else_nested_while = parse_while_statement(source, else_statement.start)
            else_statement = next_token(source, else_nested_while.position)
          } else {
            if (is_return_keyword(source, else_statement) == 1) {
              position = write_return_statement(buffer, position, source, table, function, else_statement)
              let else_returned_operand = next_token(source, else_statement.start + else_statement.length)
              else_statement = expression_end(source, else_returned_operand)
            } else {
              position = write_assignment(buffer, position, source, table, function, else_statement)
              else_statement = assignment_end(source, else_statement)
          }
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
  let position = write_loop_conditional(buffer, index, source, table, function, statement, 1)
  return position
}

fn write_local_body(buffer: bytes, index: i32, source: bytes, table: [i32], function: function_definition) -> bytes {
  let position = index
  let local_count = local_count_of(source, function) + 3
  if (local_count > 0) {
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
  if (function_reclaims_heap(source, table, function) == 1) {
    let mark = function_parameter_count_of(source, function) + local_count - 1
    position = write_indexed_instruction(buffer, position, 35, 0)
    position = write_indexed_instruction(buffer, position, 33, mark)
  }
  let current = function_body_first_token(source, function)
  while (is_return_keyword(source, current) == 0) {
    while (is_local_assignment(source, current) == 1) {
      position = write_assignment(buffer, position, source, table, function, current)
      current = assignment_end(source, current)
    }
    while (is_array_set_call(source, current) == 1) {
      position = write_mutation(buffer, position, source, table, function, current)
      current = expression_end(source, current)
    }
    if (is_loop_keyword(source, current) == 1) {
      position = write_while_statement(buffer, position, source, table, function, current)
      let statement = parse_while_statement(source, current.start)
      current = next_token(source, statement.position)
    }
    while (is_if_keyword(source, current) == 1) {
      let conditional_left = condition_left(source, current)
      let conditional_operator = next_token(source, conditional_left.start + conditional_left.length)
      let conditional = function_definition(0, 0, 0, 0, current.start, 0, 0)
      if (is_symbol(source, conditional_operator, 40) == 1) {
        let call_conditional_open = next_token(source, conditional_operator.start + conditional_operator.length)
        let call_conditional_first = next_token(source, call_conditional_open.start + call_conditional_open.length)
        if (is_return_keyword(source, call_conditional_first) == 1) {
          position = write_local_return_conditional(buffer, position, source, table, function, current)
          conditional = parse_local_return_conditional(source, current.start)
        } else {
          position = write_loop_conditional(buffer, position, source, table, function, current, 1)
          conditional = parse_loop_conditional(source, current.start)
        }
      } else {
        if (is_symbol(source, conditional_operator, 46) == 1) {
          position = write_local_return_conditional(buffer, position, source, table, function, current)
          conditional = parse_local_return_conditional(source, current.start)
        } else {
          position = write_local_return_conditional(buffer, position, source, table, function, current)
          conditional = parse_local_return_conditional(source, current.start)
        }
      }
      current = next_token(source, conditional.position)
    }
  }
  position = write_return_statement(buffer, position, source, table, function, current)
  byte_set(buffer, position, 11)
  return buffer
}

fn byte_access_requires_memory(source: bytes) -> i32 {
  let current = next_token(source, 0)
  while (current.kind != 0) {
    if (is_struct_keyword(source, current) == 1) { return 1 }
    if (is_allocate_i32_array_call(source, current) == 1) {
      return 1
    }
    if (is_allocate_bytes_call(source, current) == 1) {
      return 1
    }
    if (is_byte_at_call(source, current) == 1) {
      let after = next_token(source, current.start + current.length)
      if (is_symbol(source, after, 40) == 1) {
        return 1
      }
    }
    if (is_array_set_call(source, current) == 1) {
      let after_mutation = next_token(source, current.start + current.length)
      if (is_symbol(source, after_mutation, 40) == 1) {
        return 1
      }
    }
    current = next_token(source, current.start + current.length)
  }
  return 0
}

fn single_function_module(source: bytes, table: [i32]) -> bytes {
  let name_start = array_get(table, 1)
  let name_length = array_get(table, 2)
  let parameter_count = array_get(table, 3)
  let body_kind = array_get(table, 4)
  let body_value = array_get(table, 5)
  let result_function = first_function(source)
  let result_count = 1 + function_returns_bytes(source, result_function)
  let type_payload_length = 4 + parameter_count + result_count
  let function_payload_length = 2
  let export_payload_length = 1 + u32_leb_length(name_length) + name_length + 1 + 1
  let body_length = 3 + i32_leb_length(body_value)
  if (body_kind == 1) {
    body_length = 3 + u32_leb_length(body_value)
  }
  if (body_kind == 4) {
    body_length = conditional_body_length(source, table, result_function)
  }
  if (body_kind == 5) {
    body_length = struct_constructor_body_length(source, table, result_function)
  }
  if (body_kind == 6) {
    body_length = local_body_length(source, table, result_function)
  }
  let code_payload_length = 1 + u32_leb_length(body_length) + body_length
  let memory_section_length = 0
  let memory_required = byte_access_requires_memory(source)
  if (body_kind == 5) {
    memory_required = 1
  }
  if (body_kind == 6) {
    let function_close = function_parameter_close(source, result_function)
    let function_minus = next_token(source, function_close.start + function_close.length)
    let function_arrow = next_token(source, function_minus.start + function_minus.length)
    let function_result_type = next_token(source, function_arrow.start + function_arrow.length)
    if (struct_field_count(source, function_result_type) >= 0) {
      memory_required = 1
    }
  }
  if (memory_required == 1) {
    memory_section_length = 5
    export_payload_length = export_payload_length + 9
  }
  let global_section_length = 0
  if (memory_required == 1) {
    global_section_length = 8
  }
  let output_length = 8 + 1 + u32_leb_length(type_payload_length) + type_payload_length + 1 + u32_leb_length(function_payload_length) + function_payload_length + memory_section_length + global_section_length + 1 + u32_leb_length(export_payload_length) + export_payload_length + 1 + u32_leb_length(code_payload_length) + code_payload_length
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
  while (parameter_index < parameter_count) {
    byte_set(parameter_count_written, position, 127)
    position = position + 1
    parameter_index = parameter_index + 1
  }
  byte_set(output, position, result_count)
  position = position + 1
  let result_index = 0
  while (result_index < result_count) {
    byte_set(output, position, 127)
    position = position + 1
    result_index = result_index + 1
  }
  byte_set(output, position, 3)
  position = position + 1
  let function_length_written = write_u32_leb(output, position, function_payload_length)
  position = position + 1
  let function_count_written = write_u32_leb(function_length_written, position, 1)
  position = position + 1
  let type_index_written = write_u32_leb(function_count_written, position, 0)
  position = position + 1
  if (memory_required == 1) {
    byte_set(type_index_written, position, 5)
    byte_set(type_index_written, position + 1, 3)
    byte_set(type_index_written, position + 2, 1)
    byte_set(type_index_written, position + 3, 0)
    byte_set(type_index_written, position + 4, 1)
    position = position + 5
  }
  if (memory_required == 1) {
    byte_set(type_index_written, position, 6)
    byte_set(type_index_written, position + 1, 6)
    byte_set(type_index_written, position + 2, 1)
    byte_set(type_index_written, position + 3, 127)
    byte_set(type_index_written, position + 4, 1)
    byte_set(type_index_written, position + 5, 65)
    byte_set(type_index_written, position + 6, 32)
    byte_set(type_index_written, position + 7, 11)
    position = position + 8
  }
  byte_set(type_index_written, position, 7)
  position = position + 1
  let export_length_written = write_u32_leb(output, position, export_payload_length)
  position = position + u32_leb_length(export_payload_length)
  let export_count = 1
  if (memory_required == 1) {
    export_count = 2
  }
  let export_count_written = write_u32_leb(export_length_written, position, export_count)
  position = position + 1
  let name_length_written = write_u32_leb(export_count_written, position, name_length)
  position = position + u32_leb_length(name_length)
  let index = 0
  while (index < name_length) {
    byte_set(name_length_written, position, byte_at(source, name_start + index))
    position = position + 1
    index = index + 1
  }
  byte_set(output, position, 0)
  position = position + 1
  let export_index_written = write_u32_leb(output, position, 0)
  position = position + 1
  if (memory_required == 1) {
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
  if (body_kind == 4) {
    return write_conditional_body(output, position, source, table, result_function)
  }
  if (body_kind == 5) {
    return write_struct_constructor_body(output, position, source, table, result_function)
  }
  if (body_kind == 6) {
    return write_local_body(output, position, source, table, result_function)
  }
  byte_set(body_length_written, position, 0)
  position = position + 1
  if (body_kind == 1) {
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
  while (index < count) {
    let sized_body_kind = array_get(table, index * 7 + 4)
    let body_length = 4
    if (sized_body_kind == 0) {
      let integer_body_value = array_get(table, index * 7 + 5)
      let integer_body_value_length = i32_leb_length(integer_body_value)
      body_length = 3 + integer_body_value_length
    }
    if (sized_body_kind == 3) {
      let signed_body_value = array_get(table, index * 7 + 5)
      let signed_body_value_length = i32_leb_length(signed_body_value)
      body_length = 3 + signed_body_value_length
    }
    if (sized_body_kind == 1) {
      let unsigned_body_value = array_get(table, index * 7 + 5)
      let unsigned_body_value_length = u32_leb_length(unsigned_body_value)
      body_length = 3 + unsigned_body_value_length
    }
    if (sized_body_kind == 2) {
      let sized_argument_kind = array_get(table, index * 7 + 6)
      let sized_target = array_get(table, index * 7 + 5)
      let sized_target_length = u32_leb_length(sized_target)
      body_length = 3 + sized_target_length
      if (sized_argument_kind == 1) {
        let signed_argument = array_get(table, index * 7 + 7)
        let signed_argument_length = i32_leb_length(signed_argument)
        body_length = 4 + signed_argument_length + sized_target_length
      }
      if (sized_argument_kind == 2) {
        let unsigned_argument = array_get(table, index * 7 + 7)
        let unsigned_argument_length = u32_leb_length(unsigned_argument)
        body_length = 4 + unsigned_argument_length + sized_target_length
      }
    }
    if (sized_body_kind == 4) {
      body_length = conditional_body_length(source, table, function_at_index(source, index))
    }
    if (sized_body_kind == 5) {
      body_length = struct_constructor_body_length(source, table, function_at_index(source, index))
    }
    if (sized_body_kind == 6) {
      body_length = local_body_length(source, table, function_at_index(source, index))
    }
    code_payload_length = code_payload_length + u32_leb_length(body_length) + body_length
    index = index + 1
  }
  let type_payload_length = u32_leb_length(count)
  let function_payload_length = u32_leb_length(count)
  index = 0
  while (index < count) {
    let type_parameter_count = array_get(table, index * 7 + 3)
    let type_function = function_at_index(source, index)
    let type_result_count = 1 + function_returns_bytes(source, type_function)
    type_payload_length = type_payload_length + 2 + u32_leb_length(type_parameter_count) + type_parameter_count + type_result_count
    function_payload_length = function_payload_length + u32_leb_length(index)
    index = index + 1
  }
  let memory_required = byte_access_requires_memory(source)
  let memory_function = first_function(source)
  index = 0
  while (index < count) {
    if (function_returns_struct(source, memory_function) == 1) {
      memory_required = 1
    }
    index = index + 1
    if (index < count) {
      let next_memory_function = next_token(source, memory_function.position)
      memory_function = parse_function(source, next_memory_function.start)
    }
  }
  let memory_section_length = 0
  let exported_count = 0
  let export_payload_length = 0
  index = 0
  while (index < count) {
    let exported_function = function_at_index(source, index)
    if (function_is_exported(source, exported_function) == 1) {
      exported_count = exported_count + 1
      export_payload_length = export_payload_length + u32_leb_length(exported_function.name_length) + exported_function.name_length + 1 + u32_leb_length(index)
    }
    index = index + 1
  }
  let export_count = exported_count
  if (memory_required == 1) {
    memory_section_length = 5
    export_count = export_count + 1
    export_payload_length = export_payload_length + 9
  }
  export_payload_length = export_payload_length + u32_leb_length(export_count)
  let global_section_length = 0
  if (memory_required == 1) {
    global_section_length = 8
  }
  let output_length = 8 + 1 + u32_leb_length(type_payload_length) + type_payload_length + 1 + u32_leb_length(function_payload_length) + function_payload_length + memory_section_length + global_section_length + 1 + u32_leb_length(export_payload_length) + export_payload_length + 1 + u32_leb_length(code_payload_length) + code_payload_length
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
  while (index < count) {
    byte_set(type_count_written, position, 96)
    position = position + 1
    let emitted_parameter_count = array_get(table, index * 7 + 3)
    let emitted_parameter_count_written = write_u32_leb(output, position, emitted_parameter_count)
    position = position + u32_leb_length(emitted_parameter_count)
    let emitted_parameter_index = 0
    while (emitted_parameter_index < emitted_parameter_count) {
      byte_set(emitted_parameter_count_written, position, 127)
      position = position + 1
      emitted_parameter_index = emitted_parameter_index + 1
    }
    let emitted_function = function_at_index(source, index)
    let emitted_result_count = 1 + function_returns_bytes(source, emitted_function)
    byte_set(output, position, emitted_result_count)
    position = position + 1
    let emitted_result_index = 0
    while (emitted_result_index < emitted_result_count) {
      byte_set(output, position, 127)
      position = position + 1
      emitted_result_index = emitted_result_index + 1
    }
    index = index + 1
  }
  byte_set(output, position, 3)
  position = position + 1
  let function_length_written = write_u32_leb(output, position, function_payload_length)
  position = position + u32_leb_length(function_payload_length)
  let function_count_written = write_u32_leb(function_length_written, position, count)
  position = position + u32_leb_length(count)
  index = 0
  while (index < count) {
    let type_index_written = write_u32_leb(function_count_written, position, index)
    position = position + u32_leb_length(index)
    index = index + 1
  }
  if (memory_required == 1) {
    byte_set(output, position, 5)
    byte_set(output, position + 1, 3)
    byte_set(output, position + 2, 1)
    byte_set(output, position + 3, 0)
    byte_set(output, position + 4, 1)
    position = position + 5
  }
  if (memory_required == 1) {
    byte_set(output, position, 6)
    byte_set(output, position + 1, 6)
    byte_set(output, position + 2, 1)
    byte_set(output, position + 3, 127)
    byte_set(output, position + 4, 1)
    byte_set(output, position + 5, 65)
    byte_set(output, position + 6, 32)
    byte_set(output, position + 7, 11)
    position = position + 8
  }
  byte_set(output, position, 7)
  position = position + 1
  let export_length_written = write_u32_leb(output, position, export_payload_length)
  position = position + u32_leb_length(export_payload_length)
  let export_count_written = write_u32_leb(export_length_written, position, export_count)
  position = position + u32_leb_length(export_count)
  if (memory_required == 1) {
    byte_set(export_count_written, position, 6)
    byte_set(export_count_written, position + 1, 109)
    byte_set(export_count_written, position + 2, 101)
    byte_set(export_count_written, position + 3, 109)
    byte_set(export_count_written, position + 4, 111)
    byte_set(export_count_written, position + 5, 114)
    byte_set(export_count_written, position + 6, 121)
    byte_set(export_count_written, position + 7, 2)
    byte_set(export_count_written, position + 8, 0)
    position = position + 9
  }
  index = 0
  while (index < count) {
    let emitted_export_function = function_at_index(source, index)
    if (function_is_exported(source, emitted_export_function) == 1) {
      let name_length_written = write_u32_leb(output, position, emitted_export_function.name_length)
      position = position + u32_leb_length(emitted_export_function.name_length)
      let name_index = 0
      while (name_index < emitted_export_function.name_length) {
        byte_set(name_length_written, position, byte_at(source, emitted_export_function.name_start + name_index))
        position = position + 1
        name_index = name_index + 1
      }
      byte_set(output, position, 0)
      position = position + 1
      let export_index_written = write_u32_leb(output, position, index)
      position = position + u32_leb_length(index)
    }
    index = index + 1
  }
  byte_set(export_count_written, position, 10)
  position = position + 1
  let code_length_written = write_u32_leb(output, position, code_payload_length)
  position = position + u32_leb_length(code_payload_length)
  let code_count_written = write_u32_leb(code_length_written, position, count)
  position = position + u32_leb_length(count)
  index = 0
  while (index < count) {
    let body_kind = array_get(table, index * 7 + 4)
    let body_value = array_get(table, index * 7 + 5)
    let emitted_body_length = 4
    if (body_kind == 0) {
      emitted_body_length = 3 + i32_leb_length(body_value)
    }
    if (body_kind == 3) {
      emitted_body_length = 3 + i32_leb_length(body_value)
    }
    if (body_kind == 1) {
      emitted_body_length = 3 + u32_leb_length(body_value)
    }
    if (body_kind == 2) {
      let emitted_argument_kind = array_get(table, index * 7 + 6)
      let emitted_target_length = u32_leb_length(body_value)
      emitted_body_length = 3 + emitted_target_length
      if (emitted_argument_kind == 1) {
        let emitted_signed_argument = array_get(table, index * 7 + 7)
        let emitted_signed_argument_length = i32_leb_length(emitted_signed_argument)
        emitted_body_length = 4 + emitted_signed_argument_length + emitted_target_length
      }
      if (emitted_argument_kind == 2) {
        let emitted_unsigned_argument = array_get(table, index * 7 + 7)
        let emitted_unsigned_argument_length = u32_leb_length(emitted_unsigned_argument)
        emitted_body_length = 4 + emitted_unsigned_argument_length + emitted_target_length
      }
    }
    if (body_kind == 4) {
      emitted_body_length = conditional_body_length(source, table, function_at_index(source, index))
    }
    if (body_kind == 5) {
      emitted_body_length = struct_constructor_body_length(source, table, function_at_index(source, index))
    }
    if (body_kind == 6) {
      emitted_body_length = local_body_length(source, table, function_at_index(source, index))
    }
    let body_length_written = write_u32_leb(code_count_written, position, emitted_body_length)
    position = position + u32_leb_length(emitted_body_length)
    if (body_kind == 5) {
      let constructor_written = write_struct_constructor_body(output, position, source, table, function_at_index(source, index))
      position = position + emitted_body_length
    } else {
      if (body_kind == 6) {
        let local_written = write_local_body(output, position, source, table, function_at_index(source, index))
        position = position + emitted_body_length
      } else {
        if (body_kind == 4) {
          let conditional_written = write_conditional_body(output, position, source, table, function_at_index(source, index))
          position = position + emitted_body_length
        } else {
          if (body_kind == 2) {
          let argument_kind = array_get(table, index * 7 + 6)
          let argument_value = array_get(table, index * 7 + 7)
          if (argument_kind == 0) {
            byte_set(body_length_written, position, 0)
            byte_set(body_length_written, position + 1, 16)
            position = position + 2
            let empty_call_index_written = write_u32_leb(output, position, body_value)
            position = position + u32_leb_length(body_value)
            byte_set(empty_call_index_written, position, 11)
            position = position + 1
          }
          if (argument_kind == 1) {
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
          if (argument_kind == 2) {
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
            if (body_kind == 1) {
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

fn function_argument_count(source: bytes, function: function_definition) -> i32 {
  let open = next_token(source, function.name_start + function.name_length)
  let parameter = next_token(source, open.start + open.length)
  let count = 0
  while (is_symbol(source, parameter, 41) == 0) {
    let colon = next_token(source, parameter.start + parameter.length)
    let parameter_type = next_token(source, colon.start + colon.length)
    let end = type_end(source, parameter_type)
    parameter = next_token(source, end.start + end.length)
    count = count + 1
    if (is_symbol(source, parameter, 44) == 1) {
      parameter = next_token(source, parameter.start + parameter.length)
    }
  }
  return count
}

fn call_argument_count(source: bytes, function: function_definition) -> i32 {
  let argument = call_argument_token(source, function)
  let count = 0
  while (is_symbol(source, argument, 41) == 0) {
    count = count + 1
    argument = expression_end(source, argument)
    if (is_symbol(source, argument, 44) == 1) {
      argument = next_token(source, argument.start + argument.length)
    }
  }
  return count
}

fn multiple_function_diagnostic(source: bytes, table: [i32]) -> compile_diagnostic {
  let count = array_get(table, 0)
  let current_function = first_function(source)
  let index = 0
  while (index < count) {
    let parameter_count = array_get(table, index * 7 + 3)
    let body_kind = array_get(table, index * 7 + 4)
    if (body_kind == 2) {
      let called_index = array_get(table, index * 7 + 5)
      if (called_index < 0) {
        let unknown = returned_value_token(source, current_function)
        return compile_diagnostic(2, unknown.start, 0)
      }
      let called = function_at_index(source, called_index)
      let expected = function_argument_count(source, called)
      let actual = call_argument_count(source, current_function)
      if (actual != expected) {
        let argument = call_argument_token(source, current_function)
        return compile_diagnostic(3, argument.start, 0)
      }
    }
    index = index + 1
    if (index < count) {
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
  let output_address = byte_pointer(output)
  let output_pointer = write_i32(status, 4, output_address)
  let output_size = byte_length(output)
  let output_length = write_i32(output_pointer, 8, output_size)
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
  while (remaining >= 10) {
    remaining = remaining / 10
    length = length + 1
  }
  return length
}

fn write_decimal(buffer: bytes, index: i32, value: i32) -> bytes {
  let remaining = value
  let position = index + decimal_length(value) - 1
  while (position >= index) {
    let quotient = remaining / 10
    byte_set(buffer, position, 48 + remaining - quotient * 10)
    remaining = quotient
    position = position - 1
  }
  return buffer
}

fn diagnostic_prefix_length(kind: i32) -> i32 {
  if (kind == 1) {
    return 11
  }
  if (kind == 2) {
    return 16
  }
  return 23
}

fn write_diagnostic_prefix(buffer: bytes, kind: i32) -> bytes {
  if (kind == 1) {
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
  if (kind == 2) {
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
  let diagnostic_address = byte_pointer(diagnostic_written)
  let diagnostic_pointer = write_i32(output_length, 12, diagnostic_address)
  let diagnostic_size = byte_length(diagnostic_written)
  let diagnostic_length = write_i32(diagnostic_pointer, 16, diagnostic_size)
  let diagnostic_code = write_i32(diagnostic_length, 20, kind)
  let diagnostic_offset = write_i32(diagnostic_code, 24, offset)
  let diagnostic_source_length = write_i32(diagnostic_offset, 28, diagnostic_token.length)
  let diagnostic_expected = write_i32(diagnostic_source_length, 32, expected)
  let diagnostic_address_result = byte_pointer(diagnostic_expected)
  return diagnostic_address_result
}

// host は入力を配置した後、このページ数を追加確保してから compile を呼ぶ。
// 文書 emitter の 8 buffer、AST arena、作業領域を source 長から見積もる。
export fn workspace_pages(source: bytes) -> i32 {
  let initial = next_token(source, 0)
  let size = byte_length(source)
  let required = size * 2304 + 1048576
  if (is_module_keyword(source, initial) == 1) {
    required = size * 4 + 8388608
  }
  let rounded = required + 65535
  return rounded / 65536
}

export fn compile(source: bytes) -> i32 {
  let initial = next_token(source, 0)
  if (is_module_keyword(source, initial) == 0) { return unified_compile_record(source) }
  if (parse_empty_program(source) == 1) {
    let function = first_function(source)
    let table = function_table(source)
    let output = empty_module()
    if (function.status == 1) {
      output = single_function_module(source, table)
      if (array_get(table, 0) > 1) {
        let diagnostic = multiple_function_diagnostic(source, table)
        if (diagnostic.kind == 0) {
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

// 統一文法 frontend の状態は i32 配列、構文木は 8-field record の arena とする。
// state: cursor/kind/start/length/enclosed/bare/node/function/loop/error/nodes/functions/head/tail。
// node: kind/a/b/c/d/next/source/aux。0 は空リスト。
fn unified_get(nodes: [i32], node: i32, field: i32) -> i32 {
  let offset = node * 8 + field
  return array_get(nodes, offset)
}

fn unified_node(state: [i32], nodes: [i32], kind: i32, a: i32, b: i32, c: i32, d: i32) -> i32 {
  let index = array_get(state, 10) + 1
  array_set(state, 10, index)
  array_set(nodes, index * 8, kind)
  array_set(nodes, index * 8 + 1, a)
  array_set(nodes, index * 8 + 2, b)
  array_set(nodes, index * 8 + 3, c)
  array_set(nodes, index * 8 + 4, d)
  array_set(nodes, index * 8 + 5, 0)
  let argument_1 = array_get(state, 2)
  array_set(nodes, index * 8 + 6, argument_1)
  array_set(nodes, index * 8 + 7, 0)
  return index
}

fn unified_error(state: [i32]) -> i32 {
  if (array_get(state, 9) == 0) {
    let argument_2 = array_get(state, 2)
    array_set(state, 9, argument_2 + 1)
  }
  return 0
}

fn unified_next(source: bytes, state: [i32]) -> i32 {
  let position = array_get(state, 0)
  let size = byte_length(source)
  let current = 0
  while (position < size) {
    current = byte_at(source, position)
    if (current == 32) {
      position = position + 1
    }
    else {
      if (current == 9) {
        position = position + 1
      }
      else {
        if (current == 13) {
          position = position + 1
        }
        else {
          if (current == 47) {
            let following_position = position + 1
            if (following_position < size) {
              if (byte_at(source, position + 1) == 47) {
                while (position < size) {
                  if (byte_at(source, position) == 10) {
                    break
                  }
                  position = position + 1

                }

              }
              else {
                break
              }

            }
            else {
              break
            }

          }
          else {
            break
          }

        }

      }
    }
  }
  let start = position
  let kind = 0
  if (position < size) {
    current = byte_at(source, position)
    position = position + 1
    kind = 4
    if (current == 10) {
      kind = 5
    }
    else {
      if (current == 34) {
        kind = 3
        while (position < size) {
          let character = byte_at(source, position)
          if (character == 34) {
            break
          }
          if (character == 92) {
            array_set(state, 9, position + 1)
          }
          if (character == 10) {
            array_set(state, 9, position + 1)
          }
          if (character == 13) {
            array_set(state, 9, position + 1)
          }
          position = position + 1

        }
        if (position == size) {
          array_set(state, 9, start + 1)
        }
        else {
          position = position + 1
        }

      }
      else {
        if (is_identifier(current) == 1) {
          kind = 1
          while (position < size) {
            let character_2 = byte_at(source, position)
            let accepted = is_identifier(character_2)
            let digit = is_digit(character_2)
            accepted = accepted + digit
            if (character_2 == 45) {
              accepted = 1
            }
            if (accepted == 0) {
              break
            }
            position = position + 1

          }

        }
        else {
          let number = is_digit(current)
          if (current == 46) {
            if (position < size) {
              let argument_3 = byte_at(source, position)
              number = is_digit(argument_3)
            }

          }
          if (number == 1) {
            kind = 2
            let dot = 0
            if (current == 46) {
              dot = 1
            }
            while (position < size) {
              let character_3 = byte_at(source, position)
              if (is_digit(character_3) == 0) {
                if (character_3 != 46) {
                  break
                }
                if (dot == 1) {
                  break
                }
                dot = 1

              }
              position = position + 1

            }

          }
          else {
            if (position < size) {
              let following = byte_at(source, position)
              let doubled = 0
              if (following == 61) {
                if (current == 61) {
                  doubled = 1
                }
                if (current == 33) {
                  doubled = 1
                }
                if (current == 60) {
                  doubled = 1
                }
                if (current == 62) {
                  doubled = 1
                }

              }
              if (following == current) {
                if (current == 38) {
                  doubled = 1
                }
                if (current == 124) {
                  doubled = 1
                }

              }
              if (doubled == 1) {
                position = position + 1
              }
              if (current == 46) {
                if (following == 46) {
                  let following_position_2 = position + 1
                  if (following_position_2 < size) {
                    if (byte_at(source, position + 1) == 46) {
                      position = position + 2
                    }

                  }

                }

              }

            }

          }

        }

      }
    }
  }
  array_set(state, 0, position)
  array_set(state, 1, kind)
  array_set(state, 2, start)
  array_set(state, 3, position - start)
  return kind
}

fn unified_symbol(source: bytes, state: [i32]) -> i32 {
  if (array_get(state, 1) != 4) {
    return 0
  }
  let position = array_get(state, 2)
  let length = array_get(state, 3)
  let value = byte_at(source, position)
  if (length == 2) {
    return value * 256 + byte_at(source, position + 1)
  }
  if (length == 3) {
    return 1000
  }
  return value
}

fn unified_take(source: bytes, state: [i32], symbol: i32) -> i32 {
  if (unified_symbol(source, state) != symbol) {
    return 0
  }
  let ignored = unified_next(source, state)
  return 1
}

fn unified_expect(source: bytes, state: [i32], symbol: i32) -> i32 {
  if (unified_take(source, state, symbol) == 1) {
    return 1
  }
  return unified_error(state)
}

fn unified_inline(source: bytes, state: [i32]) -> i32 {
  while (array_get(state, 1) == 5) {
    let ignored = unified_next(source, state)
  }
  return 0
}

fn unified_trivia(source: bytes, state: [i32]) -> i32 {
  if (array_get(state, 4) == 1) {
    return unified_inline(source, state)
  }
  return 0
}

fn unified_separators(source: bytes, state: [i32]) -> i32 {
  let consumed = 0
  while (array_get(state, 9) == 0) {
    if (array_get(state, 1) != 5) {
      if (unified_symbol(source, state) != 59) {
        break
      }
    }
    let ignored = unified_next(source, state)
    consumed = 1
  }
  return consumed
}

fn unified_name(source: bytes, state: [i32], nodes: [i32]) -> i32 {
  if (unified_keyword(source, state) != 0) { return unified_error(state) }
  return unified_property_name(source, state, nodes)
}

fn unified_property_name(source: bytes, state: [i32], nodes: [i32]) -> i32 {
  if (array_get(state, 1) != 1) { return unified_error(state) }
  let argument_4 = array_get(state, 2)
  let argument_5 = array_get(state, 3)
  let node = unified_node(state, nodes, 2, argument_4, argument_5, 0, 0)
  let ignored = unified_next(source, state)
  return node
}

fn unified_body(source: bytes, state: [i32], nodes: [i32], document: i32) -> i32 {
  let ignored = unified_expect(source, state, 123)
  let enclosed = array_get(state, 4)
  let bare = array_get(state, 5)
  let outer = array_get(state, 6)
  array_set(state, 4, 0)
  array_set(state, 5, 0)
  array_set(state, 6, document)
  let body = unified_statements(source, state, nodes, 125)
  ignored = unified_expect(source, state, 125)
  array_set(state, 4, enclosed)
  array_set(state, 5, bare)
  array_set(state, 6, outer)
  return body
}

fn unified_statements(source: bytes, state: [i32], nodes: [i32], end: i32) -> i32 {
  let head = 0
  let tail = 0
  let ignored = unified_separators(source, state)
  while (array_get(state, 9) == 0) {
    if (unified_ended(source, state, end) == 1) {
      break
    }
    if (array_get(state, 1) == 0) {
      if (end != 0) {
        ignored = unified_error(state)
      }
      break
    }
    let statement = unified_statement(source, state, nodes)
    if (head == 0) {
      head = statement
    }
    else {
      array_set(nodes, tail * 8 + 5, statement)
    }
    tail = statement
    if (unified_ended(source, state, end) == 0) {
      if (array_get(state, 1) != 0) {
        if (unified_separators(source, state) == 0) {
          ignored = unified_error(state)
        }

      }
    }
  }
  return head
}

fn unified_statement(source: bytes, state: [i32], nodes: [i32]) -> i32 {
  let keyword = unified_keyword(source, state)
  let ignored = 0
  if (keyword == 1) {
    ignored = unified_next(source, state)
    let parenthesized = unified_take(source, state, 40)
    let enclosed = array_get(state, 4)
    if (parenthesized == 1) {
      array_set(state, 4, 1)
    }
    ignored = unified_trivia(source, state)
    let name = unified_name(source, state, nodes)
    ignored = unified_trivia(source, state)
    ignored = unified_expect(source, state, 61)
    let value = unified_expression(source, state, nodes, 1)
    if (parenthesized == 1) {
      ignored = unified_expect(source, state, 41)
    }
    array_set(state, 4, enclosed)
    return unified_node(state, nodes, 21, name, value, 0, 0)
  }
  if (keyword == 2) {
    ignored = unified_next(source, state)
    if (array_get(state, 7) == 0) {
      return unified_error(state)
    }
    let value_2 = unified_expression(source, state, nodes, 1)
    return unified_node(state, nodes, 23, value_2, 0, 0, 0)
  }
  if (keyword == 3) {
    ignored = unified_next(source, state)
    if (array_get(state, 8) == 0) {
      return unified_error(state)
    }
    return unified_node(state, nodes, 24, 0, 0, 0, 0)
  }
  if (keyword == 4) {
    ignored = unified_next(source, state)
    let name_2 = unified_name(source, state, nodes)
    ignored = unified_expect(source, state, 40)
    let parameters = unified_list(source, state, nodes, 41, 2)
    let parameter = parameters
    while (parameter != 0) {
      let previous = parameters
      while (previous != parameter) {
        if (unified_same_name(source, nodes, previous, parameter) == 1) { return unified_error(state) }
        previous = unified_get(nodes, previous, 5)
      }
      parameter = unified_get(nodes, parameter, 5)
    }
    let id = array_get(state, 11)
    array_set(state, 11, id + 1)
    let node = unified_node(state, nodes, 25, name_2, parameters, 0, id)
    let tail = array_get(state, 13)
    if (tail == 0) {
      array_set(state, 12, node)
    }
    else {
      array_set(nodes, tail * 8 + 7, node)
    }
    array_set(state, 13, node)
    let loops = array_get(state, 8)
    array_set(state, 8, 0)
    let argument_6 = array_get(state, 7)
    array_set(state, 7, argument_6 + 1)
    let body = unified_body(source, state, nodes, 0)
    let argument_7 = array_get(state, 7)
    array_set(state, 7, argument_7 - 1)
    array_set(state, 8, loops)
    array_set(nodes, node * 8 + 3, body)
    return node
  }
  if (unified_take(source, state, 1000) == 1) {
    if (array_get(state, 6) == 0) {
      return unified_error(state)
    }
    let value_3 = unified_expression(source, state, nodes, 1)
    return unified_node(state, nodes, 26, value_3, 0, 0, 0)
  }
  let value_4 = unified_expression(source, state, nodes, 1)
  if (unified_take(source, state, 61) == 1) {
    if (unified_get(nodes, value_4, 0) != 2) {
      return unified_error(state)
    }
    let assigned = unified_expression(source, state, nodes, 1)
    return unified_node(state, nodes, 22, value_4, assigned, 0, 0)
  }
  return unified_node(state, nodes, 20, value_4, 0, 0, 0)
}
// list mode: 0 は式、1 は object entry、2 は parameter、3 は node attribute。
fn unified_list(source: bytes, state: [i32], nodes: [i32], end: i32, mode: i32) -> i32 {
  let enclosed = array_get(state, 4)
  let bare = array_get(state, 5)
  array_set(state, 4, 1)
  array_set(state, 5, 0)
  let ignored = unified_inline(source, state)
  let head = 0
  let tail = 0
  if (unified_take(source, state, end) == 0) {
    while (array_get(state, 9) == 0) {
      ignored = unified_inline(source, state)
      let item = 0
      if (mode == 0) {
        item = unified_expression(source, state, nodes, 1)
      }
      else {
        let name = 0
        if (mode == 1) {
          if (array_get(state, 1) == 3) {
            let argument_8 = array_get(state, 2)
            let argument_9 = array_get(state, 3)
            name = unified_node(state, nodes, 1, argument_8, argument_9, 0, 0)
            ignored = unified_next(source, state)

          }
          else {
            name = unified_property_name(source, state, nodes)
          }

        }
        else {
          if (mode == 2) {
            name = unified_name(source, state, nodes)
          } else {
            name = unified_property_name(source, state, nodes)
          }
        }
        item = name
        if (mode != 2) {
          ignored = unified_trivia(source, state)
          if (mode == 1) {
            ignored = unified_expect(source, state, 58)
          }
          else {
            ignored = unified_expect(source, state, 61)
          }
          let value = unified_expression(source, state, nodes, 1)
          item = unified_node(state, nodes, 14, name, value, 0, 0)

        }

      }
      if (head == 0) {
        head = item
      }
      else {
        array_set(nodes, tail * 8 + 5, item)
      }
      tail = item
      ignored = unified_inline(source, state)
      if (unified_take(source, state, end) == 1) {
        break
      }
      ignored = unified_expect(source, state, 44)
    }
  }
  array_set(state, 4, enclosed)
  array_set(state, 5, bare)
  return head
}

fn unified_condition(source: bytes, state: [i32], nodes: [i32]) -> i32 {
  let parentheses = unified_take(source, state, 40)
  let enclosed = array_get(state, 4)
  let bare = array_get(state, 5)
  array_set(state, 4, parentheses)
  array_set(state, 5, 1 - parentheses)
  let value = unified_expression(source, state, nodes, 1)
  if (parentheses == 1) {
    let ignored = unified_expect(source, state, 41)
  }
  array_set(state, 4, enclosed)
  array_set(state, 5, bare)
  return value
}

fn unified_expression(source: bytes, state: [i32], nodes: [i32], minimum: i32) -> i32 {
  let ignored = unified_trivia(source, state)
  let left = unified_unary(source, state, nodes)
  while (array_get(state, 9) == 0) {
    ignored = unified_trivia(source, state)
    let operator = unified_symbol(source, state)
    let precedence = unified_precedence(operator)
    if (precedence < minimum) {
      break
    }
    let argument_10 = array_get(state, 2)
    let argument_11 = array_get(state, 3)
    let operation = unified_node(state, nodes, 2, argument_10, argument_11, 0, 0)
    ignored = unified_next(source, state)
    let right = unified_expression(source, state, nodes, precedence + 1)
    left = unified_node(state, nodes, 8, operation, left, right, operator)
  }
  return left
}

fn unified_unary(source: bytes, state: [i32], nodes: [i32]) -> i32 {
  let ignored = unified_trivia(source, state)
  let symbol = unified_symbol(source, state)
  let prefix = 0
  if (symbol == 33) {
    prefix = 1
  }
  if (symbol == 45) {
    prefix = 1
  }
  if (prefix == 1) {
    let argument_12 = array_get(state, 2)
    let argument_13 = array_get(state, 3)
    let operator = unified_node(state, nodes, 2, argument_12, argument_13, 0, 0)
    ignored = unified_next(source, state)
    let value = unified_unary(source, state, nodes)
    return unified_node(state, nodes, 7, operator, value, 0, 0)
  }
  let value_2 = unified_primary(source, state, nodes)
  while (array_get(state, 9) == 0) {
    ignored = unified_trivia(source, state)
    if (unified_take(source, state, 46) == 1) {
      let name = unified_property_name(source, state, nodes)
      value_2 = unified_node(state, nodes, 5, value_2, name, 0, 0)
    }
    else {
      if (unified_take(source, state, 40) == 1) {
        let arguments = unified_list(source, state, nodes, 41, 0)
        value_2 = unified_node(state, nodes, 6, value_2, arguments, 0, 0)

      }
      else {
        break
      }
    }
  }
  return value_2
}

fn unified_primary(source: bytes, state: [i32], nodes: [i32]) -> i32 {
  let ignored = unified_trivia(source, state)
  if (array_get(state, 9) != 0) {
    return 0
  }
  let keyword = unified_keyword(source, state)
  if (keyword == 5) {
    ignored = unified_next(source, state)
    let condition = unified_condition(source, state, nodes)
    let yes = unified_body(source, state, nodes, 0)
    let cursor = array_get(state, 2)
    ignored = unified_inline(source, state)
    let no = 0
    if (unified_keyword(source, state) == 6) {
      ignored = unified_next(source, state)
      no = unified_body(source, state, nodes, 0)
    }
    else {
      array_set(state, 0, cursor)
      ignored = unified_next(source, state)
    }
    return unified_node(state, nodes, 10, condition, yes, no, 0)
  }
  if (keyword == 7) {
    ignored = unified_next(source, state)
    let parentheses = unified_take(source, state, 40)
    let enclosed = array_get(state, 4)
    let bare = array_get(state, 5)
    array_set(state, 4, parentheses)
    array_set(state, 5, 1 - parentheses)
    ignored = unified_trivia(source, state)
    let name = unified_name(source, state, nodes)
    ignored = unified_trivia(source, state)
    if (unified_keyword(source, state) != 8) {
      return unified_error(state)
    }
    ignored = unified_next(source, state)
    let iterable = unified_expression(source, state, nodes, 1)
    if (parentheses == 1) {
      ignored = unified_expect(source, state, 41)
    }
    array_set(state, 4, enclosed)
    array_set(state, 5, bare)
    let argument_14 = array_get(state, 8)
    array_set(state, 8, argument_14 + 1)
    let body = unified_body(source, state, nodes, 0)
    let argument_15 = array_get(state, 8)
    array_set(state, 8, argument_15 - 1)
    return unified_node(state, nodes, 11, name, iterable, body, 0)
  }
  if (keyword == 9) {
    ignored = unified_next(source, state)
    let condition_2 = unified_condition(source, state, nodes)
    let argument_16 = array_get(state, 8)
    array_set(state, 8, argument_16 + 1)
    let body_2 = unified_body(source, state, nodes, 0)
    let argument_17 = array_get(state, 8)
    array_set(state, 8, argument_17 - 1)
    return unified_node(state, nodes, 12, condition_2, body_2, 0, 0)
  }
  if (keyword == 10) {
    ignored = unified_next(source, state)
    let argument_18 = array_get(state, 8)
    array_set(state, 8, argument_18 + 1)
    let body_3 = unified_body(source, state, nodes, 0)
    let argument_19 = array_get(state, 8)
    array_set(state, 8, argument_19 - 1)
    ignored = unified_inline(source, state)
    if (unified_keyword(source, state) != 11) {
      return unified_error(state)
    }
    ignored = unified_next(source, state)
    if (unified_symbol(source, state) != 40) {
      return unified_error(state)
    }
    let condition_3 = unified_condition(source, state, nodes)
    return unified_node(state, nodes, 13, body_3, condition_3, 0, 0)
  }
  let literal = 0
  if (array_get(state, 1) == 2) {
    literal = 1
  }
  if (array_get(state, 1) == 3) {
    literal = 1
  }
  if (keyword >= 12) {
    if (keyword <= 14) {
      literal = 1
    }
  }
  if (literal == 1) {
    let argument_20 = array_get(state, 2)
    let argument_21 = array_get(state, 3)
    let value = unified_node(state, nodes, 1, argument_20, argument_21, 0, 0)
    ignored = unified_next(source, state)
    return value
  }
  if (unified_take(source, state, 40) == 1) {
    let enclosed_2 = array_get(state, 4)
    let bare_2 = array_get(state, 5)
    array_set(state, 4, 1)
    array_set(state, 5, 0)
    let value_2 = unified_expression(source, state, nodes, 1)
    ignored = unified_expect(source, state, 41)
    array_set(state, 4, enclosed_2)
    array_set(state, 5, bare_2)
    return value_2
  }
  if (unified_take(source, state, 91) == 1) {
    let values = unified_list(source, state, nodes, 93, 0)
    return unified_node(state, nodes, 3, values, 0, 0, 0)
  }
  if (unified_take(source, state, 123) == 1) {
    let entries = unified_list(source, state, nodes, 125, 1)
    return unified_node(state, nodes, 4, entries, 0, 0, 0)
  }
  let name_2 = unified_name(source, state, nodes)
  let checkpoint = array_get(state, 2)
  let classes = 0
  let tail = 0
  while (unified_take(source, state, 46) == 1) {
    let item = unified_property_name(source, state, nodes)
    if (classes == 0) {
      classes = item
    }
    else {
      array_set(nodes, tail * 8 + 5, item)
    }
    tail = item
  }
  let attributes_start = array_get(state, 2)
  if (unified_take(source, state, 40) == 1) {
    let depth = 1
    while (depth > 0) {
      if (array_get(state, 1) == 0) {
        ignored = unified_error(state)
        break
      }
      if (array_get(state, 9) != 0) {
        break
      }
      let symbol = unified_symbol(source, state)
      if (symbol == 40) {
        depth = depth + 1
      }
      if (symbol == 41) {
        depth = depth - 1
      }
      ignored = unified_next(source, state)
    }
  }
  let document = 0
  if (array_get(state, 5) == 0) {
    if (unified_symbol(source, state) == 123) {
      document = 1
    }
  }
  if (document == 1) {
    array_set(state, 0, attributes_start)
    ignored = unified_next(source, state)
    let attributes = 0
    if (unified_take(source, state, 40) == 1) {
      attributes = unified_list(source, state, nodes, 41, 3)
    }
    let body_4 = unified_body(source, state, nodes, 1)
    return unified_node(state, nodes, 9, name_2, classes, attributes, body_4)
  }
  array_set(state, 0, checkpoint)
  ignored = unified_next(source, state)
  return name_2
}

fn unified_keyword(source: bytes, state: [i32]) -> i32 {
  if (array_get(state, 1) != 1) {
    return 0
  }
  let start = array_get(state, 2)
  let size = array_get(state, 3)
  if (size == 3) {
    let matches_1 = 1
    if (byte_at(source, start + 0) != 108) {
      matches_1 = 0
    }
    if (byte_at(source, start + 1) != 101) {
      matches_1 = 0
    }
    if (byte_at(source, start + 2) != 116) {
      matches_1 = 0
    }
    if (matches_1 == 1) {
      return 1
    }
  }
  if (size == 6) {
    let matches_2 = 1
    if (byte_at(source, start + 0) != 114) {
      matches_2 = 0
    }
    if (byte_at(source, start + 1) != 101) {
      matches_2 = 0
    }
    if (byte_at(source, start + 2) != 116) {
      matches_2 = 0
    }
    if (byte_at(source, start + 3) != 117) {
      matches_2 = 0
    }
    if (byte_at(source, start + 4) != 114) {
      matches_2 = 0
    }
    if (byte_at(source, start + 5) != 110) {
      matches_2 = 0
    }
    if (matches_2 == 1) {
      return 2
    }
  }
  if (size == 5) {
    let matches_3 = 1
    if (byte_at(source, start + 0) != 98) {
      matches_3 = 0
    }
    if (byte_at(source, start + 1) != 114) {
      matches_3 = 0
    }
    if (byte_at(source, start + 2) != 101) {
      matches_3 = 0
    }
    if (byte_at(source, start + 3) != 97) {
      matches_3 = 0
    }
    if (byte_at(source, start + 4) != 107) {
      matches_3 = 0
    }
    if (matches_3 == 1) {
      return 3
    }
  }
  if (size == 2) {
    let matches_4 = 1
    if (byte_at(source, start + 0) != 102) {
      matches_4 = 0
    }
    if (byte_at(source, start + 1) != 110) {
      matches_4 = 0
    }
    if (matches_4 == 1) {
      return 4
    }
  }
  if (size == 2) {
    let matches_5 = 1
    if (byte_at(source, start + 0) != 105) {
      matches_5 = 0
    }
    if (byte_at(source, start + 1) != 102) {
      matches_5 = 0
    }
    if (matches_5 == 1) {
      return 5
    }
  }
  if (size == 4) {
    let matches_6 = 1
    if (byte_at(source, start + 0) != 101) {
      matches_6 = 0
    }
    if (byte_at(source, start + 1) != 108) {
      matches_6 = 0
    }
    if (byte_at(source, start + 2) != 115) {
      matches_6 = 0
    }
    if (byte_at(source, start + 3) != 101) {
      matches_6 = 0
    }
    if (matches_6 == 1) {
      return 6
    }
  }
  if (size == 3) {
    let matches_7 = 1
    if (byte_at(source, start + 0) != 102) {
      matches_7 = 0
    }
    if (byte_at(source, start + 1) != 111) {
      matches_7 = 0
    }
    if (byte_at(source, start + 2) != 114) {
      matches_7 = 0
    }
    if (matches_7 == 1) {
      return 7
    }
  }
  if (size == 2) {
    let matches_8 = 1
    if (byte_at(source, start + 0) != 105) {
      matches_8 = 0
    }
    if (byte_at(source, start + 1) != 110) {
      matches_8 = 0
    }
    if (matches_8 == 1) {
      return 8
    }
  }
  if (size == 5) {
    let matches_9 = 1
    if (byte_at(source, start + 0) != 119) {
      matches_9 = 0
    }
    if (byte_at(source, start + 1) != 104) {
      matches_9 = 0
    }
    if (byte_at(source, start + 2) != 105) {
      matches_9 = 0
    }
    if (byte_at(source, start + 3) != 108) {
      matches_9 = 0
    }
    if (byte_at(source, start + 4) != 101) {
      matches_9 = 0
    }
    if (matches_9 == 1) {
      return 9
    }
  }
  if (size == 2) {
    let matches_10 = 1
    if (byte_at(source, start + 0) != 100) {
      matches_10 = 0
    }
    if (byte_at(source, start + 1) != 111) {
      matches_10 = 0
    }
    if (matches_10 == 1) {
      return 10
    }
  }
  if (size == 5) {
    let matches_11 = 1
    if (byte_at(source, start + 0) != 117) {
      matches_11 = 0
    }
    if (byte_at(source, start + 1) != 110) {
      matches_11 = 0
    }
    if (byte_at(source, start + 2) != 116) {
      matches_11 = 0
    }
    if (byte_at(source, start + 3) != 105) {
      matches_11 = 0
    }
    if (byte_at(source, start + 4) != 108) {
      matches_11 = 0
    }
    if (matches_11 == 1) {
      return 11
    }
  }
  if (size == 4) {
    let matches_12 = 1
    if (byte_at(source, start + 0) != 116) {
      matches_12 = 0
    }
    if (byte_at(source, start + 1) != 114) {
      matches_12 = 0
    }
    if (byte_at(source, start + 2) != 117) {
      matches_12 = 0
    }
    if (byte_at(source, start + 3) != 101) {
      matches_12 = 0
    }
    if (matches_12 == 1) {
      return 12
    }
  }
  if (size == 5) {
    let matches_13 = 1
    if (byte_at(source, start + 0) != 102) {
      matches_13 = 0
    }
    if (byte_at(source, start + 1) != 97) {
      matches_13 = 0
    }
    if (byte_at(source, start + 2) != 108) {
      matches_13 = 0
    }
    if (byte_at(source, start + 3) != 115) {
      matches_13 = 0
    }
    if (byte_at(source, start + 4) != 101) {
      matches_13 = 0
    }
    if (matches_13 == 1) {
      return 13
    }
  }
  if (size == 4) {
    let matches_14 = 1
    if (byte_at(source, start + 0) != 110) {
      matches_14 = 0
    }
    if (byte_at(source, start + 1) != 117) {
      matches_14 = 0
    }
    if (byte_at(source, start + 2) != 108) {
      matches_14 = 0
    }
    if (byte_at(source, start + 3) != 108) {
      matches_14 = 0
    }
    if (matches_14 == 1) {
      return 14
    }
  }
  if (size == 6) {
    let matches_15 = 1
    if (byte_at(source, start + 0) != 109) {
      matches_15 = 0
    }
    if (byte_at(source, start + 1) != 111) {
      matches_15 = 0
    }
    if (byte_at(source, start + 2) != 100) {
      matches_15 = 0
    }
    if (byte_at(source, start + 3) != 117) {
      matches_15 = 0
    }
    if (byte_at(source, start + 4) != 108) {
      matches_15 = 0
    }
    if (byte_at(source, start + 5) != 101) {
      matches_15 = 0
    }
    if (matches_15 == 1) {
      return 15
    }
  }
  if (size == 6) {
    let matches_16 = 1
    if (byte_at(source, start + 0) != 105) {
      matches_16 = 0
    }
    if (byte_at(source, start + 1) != 109) {
      matches_16 = 0
    }
    if (byte_at(source, start + 2) != 112) {
      matches_16 = 0
    }
    if (byte_at(source, start + 3) != 111) {
      matches_16 = 0
    }
    if (byte_at(source, start + 4) != 114) {
      matches_16 = 0
    }
    if (byte_at(source, start + 5) != 116) {
      matches_16 = 0
    }
    if (matches_16 == 1) {
      return 16
    }
  }
  if (size == 6) {
    let matches_17 = 1
    if (byte_at(source, start + 0) != 101) {
      matches_17 = 0
    }
    if (byte_at(source, start + 1) != 120) {
      matches_17 = 0
    }
    if (byte_at(source, start + 2) != 112) {
      matches_17 = 0
    }
    if (byte_at(source, start + 3) != 111) {
      matches_17 = 0
    }
    if (byte_at(source, start + 4) != 114) {
      matches_17 = 0
    }
    if (byte_at(source, start + 5) != 116) {
      matches_17 = 0
    }
    if (matches_17 == 1) {
      return 17
    }
  }
  if (size == 6) {
    let matches_18 = 1
    if (byte_at(source, start + 0) != 115) {
      matches_18 = 0
    }
    if (byte_at(source, start + 1) != 116) {
      matches_18 = 0
    }
    if (byte_at(source, start + 2) != 114) {
      matches_18 = 0
    }
    if (byte_at(source, start + 3) != 117) {
      matches_18 = 0
    }
    if (byte_at(source, start + 4) != 99) {
      matches_18 = 0
    }
    if (byte_at(source, start + 5) != 116) {
      matches_18 = 0
    }
    if (matches_18 == 1) {
      return 18
    }
  }
  if (size == 3) {
    let matches_19 = 1
    if (byte_at(source, start + 0) != 115) {
      matches_19 = 0
    }
    if (byte_at(source, start + 1) != 101) {
      matches_19 = 0
    }
    if (byte_at(source, start + 2) != 116) {
      matches_19 = 0
    }
    if (matches_19 == 1) {
      return 19
    }
  }
  return 0
}

fn unified_precedence(operator: i32) -> i32 {
  if (operator == 31868) {
    return 1
  }
  if (operator == 9766) {
    return 2
  }
  if (operator == 15677) {
    return 3
  }
  if (operator == 8509) {
    return 3
  }
  if (operator == 60) {
    return 4
  }
  if (operator == 15421) {
    return 4
  }
  if (operator == 62) {
    return 4
  }
  if (operator == 15933) {
    return 4
  }
  if (operator == 43) {
    return 5
  }
  if (operator == 45) {
    return 5
  }
  if (operator == 42) {
    return 6
  }
  if (operator == 47) {
    return 6
  }
  return 0
}
// emitter state: 14 local数、15 scope local、16 結果local、17 block深さ、18 break先、19 code位置、20 data位置。
fn unified_ins(code: bytes, state: [i32], opcode: i32, operand: i32) -> i32 {
  let position = array_get(state, 19)
  byte_set(code, position, opcode)
  let ignored = code
  let length = 0
  if (opcode == 65) {
    ignored = write_i32_leb(code, position + 1, operand)
    length = i32_leb_length(operand)
  }
  else {
    ignored = write_u32_leb(code, position + 1, operand)
    length = u32_leb_length(operand)
  }
  array_set(state, 19, position + 1 + length)
  return 0
}

fn unified_byte(code: bytes, state: [i32], value: i32) -> i32 {
  let position = array_get(state, 19)
  byte_set(code, position, value)
  array_set(state, 19, position + 1)
  return 0
}

fn unified_local(state: [i32]) -> i32 {
  let value = array_get(state, 14)
  array_set(state, 14, value + 1)
  return value
}

fn unified_null(code: bytes, state: [i32]) -> i32 {
  let ignored = unified_ins(code, state, 65, 0)
  ignored = unified_ins(code, state, 65, 4)
  ignored = unified_ins(code, state, 16, 0)
  return 0
}

fn unified_reset(code: bytes, state: [i32]) -> i32 {
  let ignored = unified_null(code, state)
  let argument_22 = array_get(state, 16)
  return unified_ins(code, state, 33, argument_22)
}

fn unified_literal(source: bytes, data: bytes, code: bytes, state: [i32], start: i32, size: i32, quoted: i32) -> i32 {
  let begin = array_get(state, 20)
  let position = begin
  if (quoted == 1) {
    byte_set(data, position, 34)
    position = position + 1
  }
  let first = byte_at(source, start)
  if (quoted == 0) {
    if (first == 46) {
      byte_set(data, position, 48)
      position = position + 1
    }
  }
  let index = 0
  while (index < size) {
    let character = byte_at(source, start + index)
    if (character < 32) {
      byte_set(data, position, 92)
      byte_set(data, position + 1, 117)
      byte_set(data, position + 2, 48)
      byte_set(data, position + 3, 48)
      byte_set(data, position + 4, 48 + character / 16)
      let low = character - character / 16 * 16
      if (low < 10) {
        low = low + 48
      }
      else {
        low = low + 87
      }
      byte_set(data, position + 5, low)
      position = position + 6
    }
    else {
      byte_set(data, position, character)
      position = position + 1
    }
    index = index + 1
  }
  if (quoted == 1) {
    byte_set(data, position, 34)
    position = position + 1
  }
  else {
    if (byte_at(source, start + size - 1) == 46) {
      byte_set(data, position, 48)
      position = position + 1
    }
  }
  array_set(state, 20, position)
  let ignored = unified_ins(code, state, 65, begin)
  ignored = unified_ins(code, state, 65, position - begin)
  return unified_ins(code, state, 16, 0)
}

fn unified_emit_name(source: bytes, data: bytes, code: bytes, state: [i32], nodes: [i32], node: i32) -> i32 {
  let quoted = 0
  if (unified_get(nodes, node, 0) == 2) {
    quoted = 1
  }
  let argument_23 = unified_get(nodes, node, 1)
  let argument_24 = unified_get(nodes, node, 2)
  return unified_literal(source, data, code, state, argument_23, argument_24, quoted)
}

fn unified_same_name(source: bytes, nodes: [i32], left: i32, right: i32) -> i32 {
  let size = unified_get(nodes, left, 2)
  if (size != unified_get(nodes, right, 2)) {
    return 0
  }
  let index = 0
  let a = unified_get(nodes, left, 1)
  let b = unified_get(nodes, right, 1)
  while (index < size) {
    if (byte_at(source, a + index) != byte_at(source, b + index)) {
      return 0
    }
    index = index + 1
  }
  return 1
}

fn unified_classes(source: bytes, data: bytes, code: bytes, state: [i32], nodes: [i32], classes: i32) -> i32 {
  let begin = array_get(state, 20)
  let position = begin + 1
  byte_set(data, begin, 34)
  let current = classes
  let count = 0
  while (current != 0) {
    let previous = classes
    let duplicate = 0
    while (previous != current) {
      if (unified_same_name(source, nodes, previous, current) == 1) {
        duplicate = 1
      }
      previous = unified_get(nodes, previous, 5)
    }
    if (duplicate == 0) {
      if (count > 0) {
        byte_set(data, position, 32)
        position = position + 1
      }
      let start = unified_get(nodes, current, 1)
      let size = unified_get(nodes, current, 2)
      let index = 0
      while (index < size) {
        let argument_25 = byte_at(source, start + index)
        byte_set(data, position, argument_25)
        position = position + 1
        index = index + 1

      }
      count = count + 1
    }
    current = unified_get(nodes, current, 5)
  }
  byte_set(data, position, 34)
  position = position + 1
  array_set(state, 20, position)
  let ignored = unified_ins(code, state, 65, begin)
  ignored = unified_ins(code, state, 65, position - begin)
  return unified_ins(code, state, 16, 0)
}

fn unified_emit_list(source: bytes, data: bytes, code: bytes, state: [i32], nodes: [i32], head: i32, object: i32) -> i32 {
  let constructor = 5
  let push = 6
  if (object == 1) {
    constructor = 7
    push = 8
  }
  let ignored = unified_ins(code, state, 16, constructor)
  let current = head
  while (current != 0) {
    if (object == 1) {
      let argument_26 = unified_get(nodes, current, 1)
      ignored = unified_emit_name(source, data, code, state, nodes, argument_26)
      let argument_27 = unified_get(nodes, current, 2)
      ignored = unified_emit_expression(source, data, code, state, nodes, argument_27)
    }
    else {
      ignored = unified_emit_expression(source, data, code, state, nodes, current)
    }
    ignored = unified_ins(code, state, 16, push)
    current = unified_get(nodes, current, 5)
  }
  return 0
}

fn unified_emit_scoped(source: bytes, data: bytes, code: bytes, state: [i32], nodes: [i32], body: i32, children: i32) -> i32 {
  let outer = array_get(state, 15)
  let local = unified_local(state)
  let ignored = unified_ins(code, state, 32, outer)
  ignored = unified_ins(code, state, 16, 1)
  ignored = unified_ins(code, state, 33, local)
  array_set(state, 15, local)
  ignored = unified_emit_statements(source, data, code, state, nodes, body, children)
  array_set(state, 15, outer)
  return 0
}

fn unified_emit_statements(source: bytes, data: bytes, code: bytes, state: [i32], nodes: [i32], body: i32, children: i32) -> i32 {
  let ignored = unified_reset(code, state)
  let current = body
  while (current != 0) {
    let kind = unified_get(nodes, current, 0)
    let a = unified_get(nodes, current, 1)
    let b = unified_get(nodes, current, 2)
    ignored = unified_reset(code, state)
    if (kind == 20) {
      ignored = unified_emit_expression(source, data, code, state, nodes, a)
      let argument_28 = array_get(state, 16)
      ignored = unified_ins(code, state, 33, argument_28)
      if (children >= 0) {
        ignored = unified_ins(code, state, 32, children)
        let argument_29 = array_get(state, 16)
        ignored = unified_ins(code, state, 32, argument_29)
        ignored = unified_ins(code, state, 16, 6)
        ignored = unified_byte(code, state, 26)

      }
    }
    if (kind == 26) {
      ignored = unified_ins(code, state, 32, children)
      ignored = unified_emit_expression(source, data, code, state, nodes, a)
      ignored = unified_ins(code, state, 16, 18)
      ignored = unified_byte(code, state, 26)
      ignored = unified_reset(code, state)
    }
    if (kind == 21) {
      let argument_30 = array_get(state, 15)
      ignored = unified_ins(code, state, 32, argument_30)
      ignored = unified_emit_name(source, data, code, state, nodes, a)
      ignored = unified_emit_expression(source, data, code, state, nodes, b)
      ignored = unified_ins(code, state, 16, 2)
      ignored = unified_byte(code, state, 26)
      ignored = unified_reset(code, state)
    }
    if (kind == 22) {
      let argument_31 = array_get(state, 15)
      ignored = unified_ins(code, state, 32, argument_31)
      ignored = unified_emit_name(source, data, code, state, nodes, a)
      ignored = unified_emit_expression(source, data, code, state, nodes, b)
      ignored = unified_ins(code, state, 16, 3)
      ignored = unified_byte(code, state, 26)
      ignored = unified_reset(code, state)
    }
    if (kind == 23) {
      ignored = unified_emit_expression(source, data, code, state, nodes, a)
      ignored = unified_byte(code, state, 15)
    }
    if (kind == 24) {
      let argument_32 = array_get(state, 17)
      let argument_33 = array_get(state, 18)
      ignored = unified_ins(code, state, 12, argument_32 - argument_33)
    }
    if (kind == 25) {
      let argument_34 = array_get(state, 15)
      ignored = unified_ins(code, state, 32, argument_34)
      ignored = unified_emit_name(source, data, code, state, nodes, a)
      let argument_35 = unified_get(nodes, current, 4)
      ignored = unified_ins(code, state, 65, argument_35)
      let argument_36 = array_get(state, 15)
      ignored = unified_ins(code, state, 32, argument_36)
      ignored = unified_ins(code, state, 16, 13)
      ignored = unified_ins(code, state, 16, 2)
      ignored = unified_byte(code, state, 26)
    }
    current = unified_get(nodes, current, 5)
  }
  return 0
}

fn unified_emit_expression(source: bytes, data: bytes, code: bytes, state: [i32], nodes: [i32], node: i32) -> i32 {
  let kind = unified_get(nodes, node, 0)
  let a = unified_get(nodes, node, 1)
  let b = unified_get(nodes, node, 2)
  let c = unified_get(nodes, node, 3)
  let d = unified_get(nodes, node, 4)
  let ignored = 0
  if (kind == 1) {
    return unified_emit_name(source, data, code, state, nodes, node)
  }
  if (kind == 2) {
    let argument_37 = array_get(state, 15)
    ignored = unified_ins(code, state, 32, argument_37)
    ignored = unified_emit_name(source, data, code, state, nodes, node)
    return unified_ins(code, state, 16, 4)
  }
  if (kind == 3) {
    return unified_emit_list(source, data, code, state, nodes, a, 0)
  }
  if (kind == 4) {
    return unified_emit_list(source, data, code, state, nodes, a, 1)
  }
  if (kind == 5) {
    ignored = unified_emit_expression(source, data, code, state, nodes, a)
    ignored = unified_emit_name(source, data, code, state, nodes, b)
    return unified_ins(code, state, 16, 9)
  }
  if (kind == 6) {
    ignored = unified_emit_expression(source, data, code, state, nodes, a)
    ignored = unified_emit_list(source, data, code, state, nodes, b, 0)
    return unified_ins(code, state, 16, 14)
  }
  if (kind == 7) {
    ignored = unified_emit_name(source, data, code, state, nodes, a)
    ignored = unified_emit_expression(source, data, code, state, nodes, b)
    return unified_ins(code, state, 16, 10)
  }
  if (kind == 8) {
    let logical = 0
    if (d == 9766) {
      logical = 1
    }
    if (d == 31868) {
      logical = 1
    }
    if (logical == 1) {
      let local = unified_local(state)
      ignored = unified_emit_expression(source, data, code, state, nodes, b)
      ignored = unified_ins(code, state, 34, local)
      ignored = unified_ins(code, state, 16, 12)
      ignored = unified_ins(code, state, 4, 127)
      let argument_38 = array_get(state, 17)
      array_set(state, 17, argument_38 + 1)
      if (d == 9766) {
        ignored = unified_emit_expression(source, data, code, state, nodes, c)
      }
      else {
        ignored = unified_ins(code, state, 32, local)
      }
      ignored = unified_byte(code, state, 5)
      if (d == 9766) {
        ignored = unified_ins(code, state, 32, local)
      }
      else {
        ignored = unified_emit_expression(source, data, code, state, nodes, c)
      }
      ignored = unified_byte(code, state, 11)
      let argument_39 = array_get(state, 17)
      array_set(state, 17, argument_39 - 1)
      return 0
    }
    ignored = unified_emit_name(source, data, code, state, nodes, a)
    ignored = unified_emit_expression(source, data, code, state, nodes, b)
    ignored = unified_emit_expression(source, data, code, state, nodes, c)
    return unified_ins(code, state, 16, 11)
  }
  if (kind == 9) {
    let saved = unified_local(state)
    let argument_40 = array_get(state, 16)
    ignored = unified_ins(code, state, 32, argument_40)
    ignored = unified_ins(code, state, 33, saved)
    let props = unified_local(state)
    ignored = unified_emit_list(source, data, code, state, nodes, c, 1)
    if (b != 0) {
      ignored = unified_ins(code, state, 65, 4)
      ignored = unified_ins(code, state, 65, 7)
      ignored = unified_ins(code, state, 16, 0)
      ignored = unified_classes(source, data, code, state, nodes, b)
      ignored = unified_ins(code, state, 16, 8)
    }
    ignored = unified_ins(code, state, 33, props)
    let children = unified_local(state)
    ignored = unified_ins(code, state, 16, 5)
    ignored = unified_ins(code, state, 33, children)
    ignored = unified_emit_scoped(source, data, code, state, nodes, d, children)
    ignored = unified_ins(code, state, 32, saved)
    let argument_41 = array_get(state, 16)
    ignored = unified_ins(code, state, 33, argument_41)
    ignored = unified_emit_name(source, data, code, state, nodes, a)
    ignored = unified_ins(code, state, 32, props)
    ignored = unified_ins(code, state, 32, children)
    return unified_ins(code, state, 16, 15)
  }
  if (kind == 10) {
    ignored = unified_emit_expression(source, data, code, state, nodes, a)
    ignored = unified_ins(code, state, 16, 12)
    ignored = unified_ins(code, state, 4, 64)
    let argument_42 = array_get(state, 17)
    array_set(state, 17, argument_42 + 1)
    ignored = unified_emit_scoped(source, data, code, state, nodes, b, -1)
    ignored = unified_byte(code, state, 5)
    ignored = unified_emit_scoped(source, data, code, state, nodes, c, -1)
    ignored = unified_byte(code, state, 11)
    let argument_43 = array_get(state, 17)
    array_set(state, 17, argument_43 - 1)
    let argument_44 = array_get(state, 16)
    return unified_ins(code, state, 32, argument_44)
  }
  if (kind == 11) {
    let results = unified_local(state)
    let values = unified_local(state)
    let index = unified_local(state)
    let size = unified_local(state)
    let scope = unified_local(state)
    ignored = unified_ins(code, state, 16, 5)
    ignored = unified_ins(code, state, 33, results)
    ignored = unified_emit_expression(source, data, code, state, nodes, b)
    ignored = unified_ins(code, state, 34, values)
    ignored = unified_ins(code, state, 16, 16)
    ignored = unified_ins(code, state, 33, size)
    ignored = unified_ins(code, state, 65, 0)
    ignored = unified_ins(code, state, 33, index)
    let outer_break = array_get(state, 18)
    let argument_45 = array_get(state, 17)
    array_set(state, 18, argument_45 + 1)
    let argument_46 = array_get(state, 17)
    array_set(state, 17, argument_46 + 2)
    ignored = unified_ins(code, state, 2, 64)
    ignored = unified_ins(code, state, 3, 64)
    ignored = unified_ins(code, state, 32, index)
    ignored = unified_ins(code, state, 32, size)
    ignored = unified_byte(code, state, 79)
    ignored = unified_ins(code, state, 13, 1)
    let outer = array_get(state, 15)
    ignored = unified_ins(code, state, 32, outer)
    ignored = unified_ins(code, state, 16, 1)
    ignored = unified_ins(code, state, 34, scope)
    ignored = unified_emit_name(source, data, code, state, nodes, a)
    ignored = unified_ins(code, state, 32, values)
    ignored = unified_ins(code, state, 32, index)
    ignored = unified_ins(code, state, 16, 17)
    ignored = unified_ins(code, state, 16, 2)
    ignored = unified_byte(code, state, 26)
    array_set(state, 15, scope)
    ignored = unified_emit_statements(source, data, code, state, nodes, c, -1)
    array_set(state, 15, outer)
    ignored = unified_ins(code, state, 32, results)
    let argument_47 = array_get(state, 16)
    ignored = unified_ins(code, state, 32, argument_47)
    ignored = unified_ins(code, state, 16, 6)
    ignored = unified_byte(code, state, 26)
    ignored = unified_ins(code, state, 32, index)
    ignored = unified_ins(code, state, 65, 1)
    ignored = unified_byte(code, state, 106)
    ignored = unified_ins(code, state, 33, index)
    ignored = unified_ins(code, state, 12, 0)
    ignored = unified_byte(code, state, 11)
    ignored = unified_byte(code, state, 11)
    let argument_48 = array_get(state, 17)
    array_set(state, 17, argument_48 - 2)
    array_set(state, 18, outer_break)
    return unified_ins(code, state, 32, results)
  }
  if (kind >= 12) {
    let condition = a
    let body = b
    if (kind == 13) {
      condition = b
      body = a
    }
    let outer_break_2 = array_get(state, 18)
    let argument_49 = array_get(state, 17)
    array_set(state, 18, argument_49 + 1)
    let argument_50 = array_get(state, 17)
    array_set(state, 17, argument_50 + 2)
    ignored = unified_ins(code, state, 2, 64)
    ignored = unified_ins(code, state, 3, 64)
    if (kind == 12) {
      ignored = unified_emit_expression(source, data, code, state, nodes, condition)
      ignored = unified_ins(code, state, 16, 12)
      ignored = unified_byte(code, state, 69)
      ignored = unified_ins(code, state, 13, 1)
    }
    ignored = unified_emit_scoped(source, data, code, state, nodes, body, -1)
    if (kind == 13) {
      ignored = unified_emit_expression(source, data, code, state, nodes, condition)
      ignored = unified_ins(code, state, 16, 12)
      ignored = unified_byte(code, state, 69)
      ignored = unified_ins(code, state, 13, 0)
    }
    else {
      ignored = unified_ins(code, state, 12, 0)
    }
    ignored = unified_byte(code, state, 11)
    ignored = unified_byte(code, state, 11)
    let argument_51 = array_get(state, 17)
    array_set(state, 17, argument_51 - 2)
    array_set(state, 18, outer_break_2)
    return unified_null(code, state)
  }
  return 0
}

fn unified_out_u32(output: bytes, index: i32, value: i32) -> i32 {
  let ignored = write_u32_leb(output, index, value)
  let length = u32_leb_length(value)
  return index + length
}

fn unified_copy(output: bytes, index: i32, source: bytes, size: i32) -> i32 {
  let offset = 0
  while (offset < size) {
    let argument_52 = byte_at(source, offset)
    byte_set(output, index + offset, argument_52)
    offset = offset + 1
  }
  return index + size
}

fn unified_section(output: bytes, index: i32, id: i32, source: bytes, size: i32) -> i32 {
  byte_set(output, index, id)
  let position = unified_out_u32(output, index + 1, size)
  return unified_copy(output, position, source, size)
}

fn unified_emit_module(source: bytes, state: [i32], nodes: [i32], root: i32) -> bytes {
  let capacity = byte_length(source) * 256 + 65536
  let data = allocate_bytes(capacity)
  let code = allocate_bytes(capacity)
  let bodies = allocate_bytes(capacity)
  let scratch = allocate_bytes(capacity)
  byte_set(data, 0, 110)
  byte_set(data, 1, 117)
  byte_set(data, 2, 108)
  byte_set(data, 3, 108)
  byte_set(data, 4, 34)
  byte_set(data, 5, 99)
  byte_set(data, 6, 108)
  byte_set(data, 7, 97)
  byte_set(data, 8, 115)
  byte_set(data, 9, 115)
  byte_set(data, 10, 34)
  array_set(state, 20, 11)
  let count = array_get(state, 11)
  let current = array_get(state, 12)
  let function_index = 0
  let body_position = unified_out_u32(bodies, 0, count + 1)
  while (function_index <= count) {
    let parameters = 2
    if (function_index == count) {
      parameters = 0
    }
    array_set(state, 14, parameters + 2)
    array_set(state, 15, parameters)
    array_set(state, 16, parameters + 1)
    array_set(state, 17, 0)
    array_set(state, 18, 0)
    array_set(state, 19, 0)
    let ignored = 0
    if (parameters == 0) {
      ignored = unified_ins(code, state, 65, 0)
    }
    else {
      ignored = unified_ins(code, state, 32, 0)
    }
    ignored = unified_ins(code, state, 16, 1)
    ignored = unified_ins(code, state, 33, parameters)
    let body = root
    if (parameters != 0) {
      body = unified_get(nodes, current, 3)
      let parameter = unified_get(nodes, current, 2)
      let argument_index = 0
      while (parameter != 0) {
        ignored = unified_ins(code, state, 32, parameters)
        ignored = unified_emit_name(source, data, code, state, nodes, parameter)
        ignored = unified_ins(code, state, 32, 1)
        ignored = unified_ins(code, state, 65, argument_index)
        ignored = unified_ins(code, state, 16, 17)
        ignored = unified_ins(code, state, 16, 2)
        ignored = unified_byte(code, state, 26)
        parameter = unified_get(nodes, parameter, 5)
        argument_index = argument_index + 1

      }
    }
    ignored = unified_emit_statements(source, data, code, state, nodes, body, -1)
    ignored = unified_ins(code, state, 32, parameters + 1)
    ignored = unified_byte(code, state, 11)
    let local_count = array_get(state, 14) - parameters
    let local_length = 2 + u32_leb_length(local_count)
    let code_length = array_get(state, 19)
    body_position = unified_out_u32(bodies, body_position, local_length + code_length)
    byte_set(bodies, body_position, 1)
    body_position = unified_out_u32(bodies, body_position + 1, local_count)
    byte_set(bodies, body_position, 127)
    body_position = unified_copy(bodies, body_position + 1, code, code_length)
    if (current != 0) {
      current = unified_get(nodes, current, 7)
    }
    function_index = function_index + 1
  }
  let output = allocate_bytes(capacity * 2)
  let position = unified_header(output)
  let cursor = unified_out_u32(scratch, 0, count + 1)
  let index = 0
  while (index < count) {
    byte_set(scratch, cursor, 2)
    cursor = cursor + 1
    index = index + 1
  }
  byte_set(scratch, cursor, 0)
  position = unified_section(output, position, 3, scratch, cursor + 1)
  byte_set(scratch, 0, 1)
  byte_set(scratch, 1, 112)
  byte_set(scratch, 2, 0)
  cursor = unified_out_u32(scratch, 3, count)
  position = unified_section(output, position, 4, scratch, cursor)
  byte_set(scratch, 0, 1)
  byte_set(scratch, 1, 0)
  let data_length = array_get(state, 20)
  let page_bytes = data_length + 65535
  let pages = page_bytes / 65536
  if (pages == 0) {
    pages = 1
  }
  cursor = unified_out_u32(scratch, 2, pages)
  position = unified_section(output, position, 5, scratch, cursor)
  cursor = unified_exports(scratch, count)
  position = unified_section(output, position, 7, scratch, cursor)
  byte_set(scratch, 0, 1)
  byte_set(scratch, 1, 0)
  byte_set(scratch, 2, 65)
  byte_set(scratch, 3, 0)
  byte_set(scratch, 4, 11)
  cursor = unified_out_u32(scratch, 5, count)
  index = 0
  while (index < count) {
    cursor = unified_out_u32(scratch, cursor, index + 19)
    index = index + 1
  }
  position = unified_section(output, position, 9, scratch, cursor)
  position = unified_section(output, position, 10, bodies, body_position)
  byte_set(scratch, 0, 1)
  byte_set(scratch, 1, 0)
  byte_set(scratch, 2, 65)
  byte_set(scratch, 3, 0)
  byte_set(scratch, 4, 11)
  cursor = unified_out_u32(scratch, 5, data_length)
  cursor = unified_copy(scratch, cursor, data, data_length)
  position = unified_section(output, position, 11, scratch, cursor)
  let result = allocate_bytes(position)
  let copied = unified_copy(result, 0, output, position)
  return result
}

fn unified_compile_record(source: bytes) -> i32 {
  let state = allocate_i32_array(32)
  let argument_53 = byte_length(source)
  let nodes = allocate_i32_array(argument_53 * 32 + 32)
  let index = 0
  while (index < 32) {
    array_set(state, index, 0)
    index = index + 1
  }
  let ignored = unified_next(source, state)
  let root = unified_statements(source, state, nodes, 0)
  let error = array_get(state, 9)
  if (error != 0) {
    return diagnostic_record(source, 1, error - 1, 12)
  }
  let output = unified_emit_module(source, state, nodes, root)
  return success_record(output)
}

fn unified_ended(source: bytes, state: [i32], end: i32) -> i32 {
  if (end == 0) {
    if (array_get(state, 1) == 0) {
      return 1
    }
    return 0
  }
  if (unified_symbol(source, state) == end) {
    return 1
  }
  return 0
}

fn unified_header(output: bytes) -> i32 {
  byte_set(output, 0, 0)
  byte_set(output, 1, 97)
  byte_set(output, 2, 115)
  byte_set(output, 3, 109)
  byte_set(output, 4, 1)
  byte_set(output, 5, 0)
  byte_set(output, 6, 0)
  byte_set(output, 7, 0)
  byte_set(output, 8, 1)
  byte_set(output, 9, 23)
  byte_set(output, 10, 4)
  byte_set(output, 11, 96)
  byte_set(output, 12, 0)
  byte_set(output, 13, 1)
  byte_set(output, 14, 127)
  byte_set(output, 15, 96)
  byte_set(output, 16, 1)
  byte_set(output, 17, 127)
  byte_set(output, 18, 1)
  byte_set(output, 19, 127)
  byte_set(output, 20, 96)
  byte_set(output, 21, 2)
  byte_set(output, 22, 127)
  byte_set(output, 23, 127)
  byte_set(output, 24, 1)
  byte_set(output, 25, 127)
  byte_set(output, 26, 96)
  byte_set(output, 27, 3)
  byte_set(output, 28, 127)
  byte_set(output, 29, 127)
  byte_set(output, 30, 127)
  byte_set(output, 31, 1)
  byte_set(output, 32, 127)
  byte_set(output, 33, 2)
  byte_set(output, 34, 147)
  byte_set(output, 35, 2)
  byte_set(output, 36, 19)
  byte_set(output, 37, 5)
  byte_set(output, 38, 109)
  byte_set(output, 39, 97)
  byte_set(output, 40, 116)
  byte_set(output, 41, 114)
  byte_set(output, 42, 97)
  byte_set(output, 43, 7)
  byte_set(output, 44, 108)
  byte_set(output, 45, 105)
  byte_set(output, 46, 116)
  byte_set(output, 47, 101)
  byte_set(output, 48, 114)
  byte_set(output, 49, 97)
  byte_set(output, 50, 108)
  byte_set(output, 51, 0)
  byte_set(output, 52, 2)
  byte_set(output, 53, 5)
  byte_set(output, 54, 109)
  byte_set(output, 55, 97)
  byte_set(output, 56, 116)
  byte_set(output, 57, 114)
  byte_set(output, 58, 97)
  byte_set(output, 59, 5)
  byte_set(output, 60, 115)
  byte_set(output, 61, 99)
  byte_set(output, 62, 111)
  byte_set(output, 63, 112)
  byte_set(output, 64, 101)
  byte_set(output, 65, 0)
  byte_set(output, 66, 1)
  byte_set(output, 67, 5)
  byte_set(output, 68, 109)
  byte_set(output, 69, 97)
  byte_set(output, 70, 116)
  byte_set(output, 71, 114)
  byte_set(output, 72, 97)
  byte_set(output, 73, 4)
  byte_set(output, 74, 98)
  byte_set(output, 75, 105)
  byte_set(output, 76, 110)
  byte_set(output, 77, 100)
  byte_set(output, 78, 0)
  byte_set(output, 79, 3)
  byte_set(output, 80, 5)
  byte_set(output, 81, 109)
  byte_set(output, 82, 97)
  byte_set(output, 83, 116)
  byte_set(output, 84, 114)
  byte_set(output, 85, 97)
  byte_set(output, 86, 6)
  byte_set(output, 87, 97)
  byte_set(output, 88, 115)
  byte_set(output, 89, 115)
  byte_set(output, 90, 105)
  byte_set(output, 91, 103)
  byte_set(output, 92, 110)
  byte_set(output, 93, 0)
  byte_set(output, 94, 3)
  byte_set(output, 95, 5)
  byte_set(output, 96, 109)
  byte_set(output, 97, 97)
  byte_set(output, 98, 116)
  byte_set(output, 99, 114)
  byte_set(output, 100, 97)
  byte_set(output, 101, 3)
  byte_set(output, 102, 103)
  byte_set(output, 103, 101)
  byte_set(output, 104, 116)
  byte_set(output, 105, 0)
  byte_set(output, 106, 2)
  byte_set(output, 107, 5)
  byte_set(output, 108, 109)
  byte_set(output, 109, 97)
  byte_set(output, 110, 116)
  byte_set(output, 111, 114)
  byte_set(output, 112, 97)
  byte_set(output, 113, 5)
  byte_set(output, 114, 97)
  byte_set(output, 115, 114)
  byte_set(output, 116, 114)
  byte_set(output, 117, 97)
  byte_set(output, 118, 121)
  byte_set(output, 119, 0)
  byte_set(output, 120, 0)
  byte_set(output, 121, 5)
  byte_set(output, 122, 109)
  byte_set(output, 123, 97)
  byte_set(output, 124, 116)
  byte_set(output, 125, 114)
  byte_set(output, 126, 97)
  byte_set(output, 127, 4)
  byte_set(output, 128, 112)
  byte_set(output, 129, 117)
  byte_set(output, 130, 115)
  byte_set(output, 131, 104)
  byte_set(output, 132, 0)
  byte_set(output, 133, 2)
  byte_set(output, 134, 5)
  byte_set(output, 135, 109)
  byte_set(output, 136, 97)
  byte_set(output, 137, 116)
  byte_set(output, 138, 114)
  byte_set(output, 139, 97)
  byte_set(output, 140, 6)
  byte_set(output, 141, 111)
  byte_set(output, 142, 98)
  byte_set(output, 143, 106)
  byte_set(output, 144, 101)
  byte_set(output, 145, 99)
  byte_set(output, 146, 116)
  byte_set(output, 147, 0)
  byte_set(output, 148, 0)
  byte_set(output, 149, 5)
  byte_set(output, 150, 109)
  byte_set(output, 151, 97)
  byte_set(output, 152, 116)
  byte_set(output, 153, 114)
  byte_set(output, 154, 97)
  byte_set(output, 155, 8)
  byte_set(output, 156, 112)
  byte_set(output, 157, 114)
  byte_set(output, 158, 111)
  byte_set(output, 159, 112)
  byte_set(output, 160, 101)
  byte_set(output, 161, 114)
  byte_set(output, 162, 116)
  byte_set(output, 163, 121)
  byte_set(output, 164, 0)
  byte_set(output, 165, 3)
  byte_set(output, 166, 5)
  byte_set(output, 167, 109)
  byte_set(output, 168, 97)
  byte_set(output, 169, 116)
  byte_set(output, 170, 114)
  byte_set(output, 171, 97)
  byte_set(output, 172, 6)
  byte_set(output, 173, 109)
  byte_set(output, 174, 101)
  byte_set(output, 175, 109)
  byte_set(output, 176, 98)
  byte_set(output, 177, 101)
  byte_set(output, 178, 114)
  byte_set(output, 179, 0)
  byte_set(output, 180, 2)
  byte_set(output, 181, 5)
  byte_set(output, 182, 109)
  byte_set(output, 183, 97)
  byte_set(output, 184, 116)
  byte_set(output, 185, 114)
  byte_set(output, 186, 97)
  byte_set(output, 187, 5)
  byte_set(output, 188, 117)
  byte_set(output, 189, 110)
  byte_set(output, 190, 97)
  byte_set(output, 191, 114)
  byte_set(output, 192, 121)
  byte_set(output, 193, 0)
  byte_set(output, 194, 2)
  byte_set(output, 195, 5)
  byte_set(output, 196, 109)
  byte_set(output, 197, 97)
  byte_set(output, 198, 116)
  byte_set(output, 199, 114)
  byte_set(output, 200, 97)
  byte_set(output, 201, 6)
  byte_set(output, 202, 98)
  byte_set(output, 203, 105)
  byte_set(output, 204, 110)
  byte_set(output, 205, 97)
  byte_set(output, 206, 114)
  byte_set(output, 207, 121)
  byte_set(output, 208, 0)
  byte_set(output, 209, 3)
  byte_set(output, 210, 5)
  byte_set(output, 211, 109)
  byte_set(output, 212, 97)
  byte_set(output, 213, 116)
  byte_set(output, 214, 114)
  byte_set(output, 215, 97)
  byte_set(output, 216, 6)
  byte_set(output, 217, 116)
  byte_set(output, 218, 114)
  byte_set(output, 219, 117)
  byte_set(output, 220, 116)
  byte_set(output, 221, 104)
  byte_set(output, 222, 121)
  byte_set(output, 223, 0)
  byte_set(output, 224, 1)
  byte_set(output, 225, 5)
  byte_set(output, 226, 109)
  byte_set(output, 227, 97)
  byte_set(output, 228, 116)
  byte_set(output, 229, 114)
  byte_set(output, 230, 97)
  byte_set(output, 231, 8)
  byte_set(output, 232, 102)
  byte_set(output, 233, 117)
  byte_set(output, 234, 110)
  byte_set(output, 235, 99)
  byte_set(output, 236, 116)
  byte_set(output, 237, 105)
  byte_set(output, 238, 111)
  byte_set(output, 239, 110)
  byte_set(output, 240, 0)
  byte_set(output, 241, 2)
  byte_set(output, 242, 5)
  byte_set(output, 243, 109)
  byte_set(output, 244, 97)
  byte_set(output, 245, 116)
  byte_set(output, 246, 114)
  byte_set(output, 247, 97)
  byte_set(output, 248, 4)
  byte_set(output, 249, 99)
  byte_set(output, 250, 97)
  byte_set(output, 251, 108)
  byte_set(output, 252, 108)
  byte_set(output, 253, 0)
  byte_set(output, 254, 2)
  byte_set(output, 255, 5)
  byte_set(output, 256, 109)
  byte_set(output, 257, 97)
  byte_set(output, 258, 116)
  byte_set(output, 259, 114)
  byte_set(output, 260, 97)
  byte_set(output, 261, 4)
  byte_set(output, 262, 110)
  byte_set(output, 263, 111)
  byte_set(output, 264, 100)
  byte_set(output, 265, 101)
  byte_set(output, 266, 0)
  byte_set(output, 267, 3)
  byte_set(output, 268, 5)
  byte_set(output, 269, 109)
  byte_set(output, 270, 97)
  byte_set(output, 271, 116)
  byte_set(output, 272, 114)
  byte_set(output, 273, 97)
  byte_set(output, 274, 6)
  byte_set(output, 275, 108)
  byte_set(output, 276, 101)
  byte_set(output, 277, 110)
  byte_set(output, 278, 103)
  byte_set(output, 279, 116)
  byte_set(output, 280, 104)
  byte_set(output, 281, 0)
  byte_set(output, 282, 1)
  byte_set(output, 283, 5)
  byte_set(output, 284, 109)
  byte_set(output, 285, 97)
  byte_set(output, 286, 116)
  byte_set(output, 287, 114)
  byte_set(output, 288, 97)
  byte_set(output, 289, 4)
  byte_set(output, 290, 105)
  byte_set(output, 291, 116)
  byte_set(output, 292, 101)
  byte_set(output, 293, 109)
  byte_set(output, 294, 0)
  byte_set(output, 295, 2)
  byte_set(output, 296, 5)
  byte_set(output, 297, 109)
  byte_set(output, 298, 97)
  byte_set(output, 299, 116)
  byte_set(output, 300, 114)
  byte_set(output, 301, 97)
  byte_set(output, 302, 6)
  byte_set(output, 303, 115)
  byte_set(output, 304, 112)
  byte_set(output, 305, 114)
  byte_set(output, 306, 101)
  byte_set(output, 307, 97)
  byte_set(output, 308, 100)
  byte_set(output, 309, 0)
  byte_set(output, 310, 2)
  return 311
}

fn unified_exports(output: bytes, functions: i32) -> i32 {
  byte_set(output, 0, 3)
  byte_set(output, 1, 6)
  byte_set(output, 2, 109)
  byte_set(output, 3, 101)
  byte_set(output, 4, 109)
  byte_set(output, 5, 111)
  byte_set(output, 6, 114)
  byte_set(output, 7, 121)
  byte_set(output, 8, 2)
  byte_set(output, 9, 0)
  byte_set(output, 10, 11)
  byte_set(output, 11, 95)
  byte_set(output, 12, 95)
  byte_set(output, 13, 102)
  byte_set(output, 14, 117)
  byte_set(output, 15, 110)
  byte_set(output, 16, 99)
  byte_set(output, 17, 116)
  byte_set(output, 18, 105)
  byte_set(output, 19, 111)
  byte_set(output, 20, 110)
  byte_set(output, 21, 115)
  byte_set(output, 22, 1)
  byte_set(output, 23, 0)
  byte_set(output, 24, 3)
  byte_set(output, 25, 114)
  byte_set(output, 26, 117)
  byte_set(output, 27, 110)
  byte_set(output, 28, 0)
  return unified_out_u32(output, 29, functions + 19)
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
