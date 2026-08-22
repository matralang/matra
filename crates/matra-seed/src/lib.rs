//! Matra Program の最小 seed compiler。
//!
//! Markdown 内の `*.matra.program` fence から WebAssembly module を生成する。
//! 現在は `i32` 関数、局所変数、四則演算、関数呼び出しを実装する。

use std::collections::{HashMap, HashSet};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CompileError {
    message: String,
}

impl CompileError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl fmt::Display for CompileError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.message.fmt(formatter)
    }
}

impl std::error::Error for CompileError {}

/// Compile the selected `*.matra.program` Markdown fence into a Wasm binary.
pub fn compile_markdown(markdown: &str, entry: Option<&str>) -> Result<Vec<u8>, CompileError> {
    let fences = extract_programs(markdown)?;
    let entry_index = select_entry(&fences, entry)?;
    let modules: Vec<_> = fences
        .iter()
        .map(|fence| parse_program(&fence.source).map(|program| (fence.filename.clone(), program)))
        .collect::<Result<_, _>>()?;
    let mut modules_by_name = HashMap::new();
    for (index, (_, program)) in modules.iter().enumerate() {
        if modules_by_name
            .insert(program.name.clone(), index)
            .is_some()
        {
            return Err(CompileError::new(format!(
                "Duplicate module: {}",
                program.name
            )));
        }
    }
    let mut states = vec![0u8; modules.len()];
    let mut functions = Vec::new();
    collect_module(
        entry_index,
        &modules,
        &modules_by_name,
        &mut states,
        &mut functions,
    )?;
    emit_module(&Program {
        name: "entry".to_owned(),
        imports: Vec::new(),
        functions,
    })
}

struct ProgramFence {
    filename: String,
    source: String,
}

fn extract_programs(markdown: &str) -> Result<Vec<ProgramFence>, CompileError> {
    let mut fences = Vec::new();
    let mut lines = markdown.split_inclusive('\n').peekable();

    while let Some(line) = lines.next() {
        let trimmed = line.trim_start_matches([' ', '\t']);
        let marker_length = trimmed
            .chars()
            .take_while(|character| *character == '`')
            .count();
        if marker_length < 3 {
            continue;
        }
        let name = trimmed[marker_length..]
            .split_whitespace()
            .next()
            .unwrap_or_default();
        if !name.ends_with(".matra.program") {
            continue;
        }

        let mut source = String::new();
        let closing = "`".repeat(marker_length);
        let mut closed = false;
        for body_line in lines.by_ref() {
            if body_line
                .trim_start_matches([' ', '\t'])
                .trim_end_matches(['\r', '\n'])
                == closing
            {
                closed = true;
                break;
            }
            source.push_str(body_line);
        }
        if !closed {
            return Err(CompileError::new(format!(
                "Unclosed Matra Program fence: {name}"
            )));
        }
        fences.push(ProgramFence {
            filename: name.to_owned(),
            source,
        });
    }
    Ok(fences)
}

fn select_entry(fences: &[ProgramFence], entry: Option<&str>) -> Result<usize, CompileError> {
    match entry {
        Some(entry) => fences
            .iter()
            .position(|fence| fence.filename == entry)
            .ok_or_else(|| {
                CompileError::new(format!("The Matra Program entry '{entry}' was not found."))
            }),
        None if fences.len() == 1 => Ok(0),
        None if fences.is_empty() => Err(CompileError::new(
            "Markdown must contain one `*.matra.program` fenced code block.",
        )),
        None => Err(CompileError::new(
            "Set an entry when Markdown contains multiple Matra Program blocks.",
        )),
    }
}

#[derive(Debug, PartialEq, Eq)]
struct Program {
    name: String,
    imports: Vec<String>,
    functions: Vec<Function>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Function {
    exported: bool,
    name: String,
    parameters: Vec<Parameter>,
    return_type: ValueType,
    statements: Vec<Statement>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Parameter {
    name: String,
    value_type: ValueType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ValueType {
    I32,
    Bytes,
    ArrayI32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Statement {
    Let(String, Option<ValueType>, Expression),
    Assign(String, Expression),
    ByteSet(Expression, Expression, Expression),
    ArraySet(Expression, Expression, Expression),
    If(Expression, Vec<Statement>, Vec<Statement>),
    While(Expression, Vec<Statement>),
    Break,
    Return(Expression),
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Expression {
    Integer(i32),
    Variable(String),
    Call(String, Vec<Expression>),
    Negate(Box<Expression>),
    Binary(BinaryOperator, Box<Expression>, Box<Expression>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BinaryOperator {
    Add,
    Subtract,
    Multiply,
    Divide,
    Equal,
    NotEqual,
    LessThan,
    LessThanOrEqual,
    GreaterThan,
    GreaterThanOrEqual,
}

fn parse_program(source: &str) -> Result<Program, CompileError> {
    let mut parser = Parser::new(source);
    parser.expect_keyword("module")?;
    let name = parser.identifier()?;
    let mut imports = Vec::new();
    while parser.consume_keyword("import") {
        imports.push(parser.identifier()?);
    }
    let mut functions = Vec::new();
    while !parser.at_end() {
        functions.push(parser.function()?);
    }
    if functions.is_empty() {
        return Err(parser.error("A program must declare at least one function."));
    }
    parser.expect_end()?;
    Ok(Program {
        name,
        imports,
        functions,
    })
}

fn collect_module(
    index: usize,
    modules: &[(String, Program)],
    modules_by_name: &HashMap<String, usize>,
    states: &mut [u8],
    functions: &mut Vec<Function>,
) -> Result<(), CompileError> {
    match states[index] {
        1 => {
            return Err(CompileError::new(format!(
                "Cyclic import involving module: {}",
                modules[index].1.name
            )));
        }
        2 => return Ok(()),
        _ => {}
    }
    states[index] = 1;
    for import in &modules[index].1.imports {
        let dependency = modules_by_name
            .get(import)
            .copied()
            .ok_or_else(|| CompileError::new(format!("Unknown module: {import}")))?;
        collect_module(dependency, modules, modules_by_name, states, functions)?;
    }
    functions.extend(modules[index].1.functions.iter().cloned());
    states[index] = 2;
    Ok(())
}

fn always_returns(statements: &[Statement]) -> bool {
    match statements.last() {
        Some(Statement::Return(_)) => true,
        Some(Statement::If(_, then_body, else_body)) if !else_body.is_empty() => {
            always_returns(then_body) && always_returns(else_body)
        }
        _ => false,
    }
}

struct Parser<'a> {
    source: &'a str,
    offset: usize,
}

impl<'a> Parser<'a> {
    fn new(source: &'a str) -> Self {
        Self { source, offset: 0 }
    }

    fn expect_keyword(&mut self, keyword: &str) -> Result<(), CompileError> {
        let identifier = self.raw_identifier()?;
        if identifier == keyword {
            Ok(())
        } else {
            Err(self.error(format!("Expected '{keyword}', found '{identifier}'.")))
        }
    }

    fn consume_keyword(&mut self, keyword: &str) -> bool {
        let checkpoint = self.offset;
        let Ok(identifier) = self.raw_identifier() else {
            self.offset = checkpoint;
            return false;
        };
        if identifier == keyword {
            true
        } else {
            self.offset = checkpoint;
            false
        }
    }

    fn function(&mut self) -> Result<Function, CompileError> {
        let exported = self.consume_keyword("export");
        self.expect_keyword("fn")?;
        let name = self.identifier()?;
        self.expect('(')?;
        let mut parameters = Vec::new();
        if !self.consume(')') {
            loop {
                let parameter = self.identifier()?;
                self.expect(':')?;
                parameters.push(Parameter {
                    name: parameter,
                    value_type: self.parse_type()?,
                });
                if self.consume(')') {
                    break;
                }
                self.expect(',')?;
            }
        }
        self.expect_arrow()?;
        let return_type = self.parse_type()?;
        self.expect('{')?;
        let mut statements = Vec::new();
        while !self.consume('}') {
            if self.at_end() {
                return Err(self.error("Expected '}' to close function body."));
            }
            statements.push(self.statement()?);
        }
        if !always_returns(&statements) {
            return Err(self.error(format!("Function '{name}' must end with return.")));
        }
        Ok(Function {
            exported,
            name,
            parameters,
            return_type,
            statements,
        })
    }

    fn statement(&mut self) -> Result<Statement, CompileError> {
        if self.consume_keyword("let") {
            let name = self.identifier()?;
            let value_type = if self.consume(':') {
                Some(self.parse_type()?)
            } else {
                None
            };
            self.expect('=')?;
            return Ok(Statement::Let(name, value_type, self.expression()?));
        }
        if self.consume_keyword("return") {
            return Ok(Statement::Return(self.expression()?));
        }
        if self.consume_keyword("break") {
            return Ok(Statement::Break);
        }
        if self.consume_keyword("if") {
            let condition = self.expression()?;
            let then_body = self.block()?;
            let else_body = if self.consume_keyword("else") {
                self.block()?
            } else {
                Vec::new()
            };
            return Ok(Statement::If(condition, then_body, else_body));
        }
        if self.consume_keyword("while") {
            let condition = self.expression()?;
            return Ok(Statement::While(condition, self.block()?));
        }
        let name = self.identifier()?;
        if name == "byte_set" {
            self.expect('(')?;
            let bytes = self.expression()?;
            self.expect(',')?;
            let index = self.expression()?;
            self.expect(',')?;
            let value = self.expression()?;
            self.expect(')')?;
            return Ok(Statement::ByteSet(bytes, index, value));
        }
        if name == "array_set" {
            self.expect('(')?;
            let array = self.expression()?;
            self.expect(',')?;
            let index = self.expression()?;
            self.expect(',')?;
            let value = self.expression()?;
            self.expect(')')?;
            return Ok(Statement::ArraySet(array, index, value));
        }
        self.expect('=')?;
        Ok(Statement::Assign(name, self.expression()?))
    }

    fn block(&mut self) -> Result<Vec<Statement>, CompileError> {
        self.expect('{')?;
        let mut statements = Vec::new();
        while !self.consume('}') {
            if self.at_end() {
                return Err(self.error("Expected '}' to close block."));
            }
            statements.push(self.statement()?);
        }
        Ok(statements)
    }

    fn expression(&mut self) -> Result<Expression, CompileError> {
        self.comparison()
    }

    fn comparison(&mut self) -> Result<Expression, CompileError> {
        let mut expression = self.additive()?;
        loop {
            let operator = if self.consume_text("==") {
                Some(BinaryOperator::Equal)
            } else if self.consume_text("!=") {
                Some(BinaryOperator::NotEqual)
            } else if self.consume_text("<=") {
                Some(BinaryOperator::LessThanOrEqual)
            } else if self.consume_text(">=") {
                Some(BinaryOperator::GreaterThanOrEqual)
            } else if self.consume('<') {
                Some(BinaryOperator::LessThan)
            } else if self.consume('>') {
                Some(BinaryOperator::GreaterThan)
            } else {
                None
            };
            let Some(operator) = operator else {
                return Ok(expression);
            };
            expression =
                Expression::Binary(operator, Box::new(expression), Box::new(self.additive()?));
        }
    }

    fn additive(&mut self) -> Result<Expression, CompileError> {
        let mut expression = self.multiplicative()?;
        loop {
            let operator = if self.consume('+') {
                Some(BinaryOperator::Add)
            } else if self.consume('-') {
                Some(BinaryOperator::Subtract)
            } else {
                None
            };
            let Some(operator) = operator else {
                return Ok(expression);
            };
            expression = Expression::Binary(
                operator,
                Box::new(expression),
                Box::new(self.multiplicative()?),
            );
        }
    }

    fn multiplicative(&mut self) -> Result<Expression, CompileError> {
        let mut expression = self.unary()?;
        loop {
            let operator = if self.consume('*') {
                Some(BinaryOperator::Multiply)
            } else if self.consume('/') {
                Some(BinaryOperator::Divide)
            } else {
                None
            };
            let Some(operator) = operator else {
                return Ok(expression);
            };
            expression =
                Expression::Binary(operator, Box::new(expression), Box::new(self.unary()?));
        }
    }

    fn unary(&mut self) -> Result<Expression, CompileError> {
        if self.consume('-') {
            return Ok(Expression::Negate(Box::new(self.unary()?)));
        }
        self.primary()
    }

    fn primary(&mut self) -> Result<Expression, CompileError> {
        if self.consume('(') {
            let expression = self.expression()?;
            self.expect(')')?;
            return Ok(expression);
        }
        self.skip_trivia();
        if matches!(self.peek(), Some('0'..='9')) {
            return Ok(Expression::Integer(self.integer()?));
        }
        let name = self.identifier()?;
        if !self.consume('(') {
            return Ok(Expression::Variable(name));
        }
        let mut arguments = Vec::new();
        if !self.consume(')') {
            loop {
                arguments.push(self.expression()?);
                if self.consume(')') {
                    break;
                }
                self.expect(',')?;
            }
        }
        Ok(Expression::Call(name, arguments))
    }

    fn parse_type(&mut self) -> Result<ValueType, CompileError> {
        if self.consume('[') {
            self.expect_keyword("i32")?;
            self.expect(']')?;
            return Ok(ValueType::ArrayI32);
        }
        match self.identifier()?.as_str() {
            "i32" => Ok(ValueType::I32),
            "bytes" => Ok(ValueType::Bytes),
            value => Err(self.error(format!("Unknown type: {value}"))),
        }
    }

    fn identifier(&mut self) -> Result<String, CompileError> {
        let identifier = self.raw_identifier()?;
        if is_reserved_word(&identifier) {
            return Err(self.error(format!(
                "Reserved word cannot be an identifier: {identifier}"
            )));
        }
        Ok(identifier)
    }

    fn raw_identifier(&mut self) -> Result<String, CompileError> {
        self.skip_trivia();
        let start = self.offset;
        let Some(first) = self.peek() else {
            return Err(self.error("Expected an identifier."));
        };
        if !matches!(first, 'A'..='Z' | 'a'..='z' | '_') {
            return Err(self.error("Expected an identifier."));
        }
        self.bump();
        while matches!(self.peek(), Some('A'..='Z' | 'a'..='z' | '0'..='9' | '_')) {
            self.bump();
        }
        Ok(self.source[start..self.offset].to_owned())
    }

    fn integer(&mut self) -> Result<i32, CompileError> {
        self.skip_trivia();
        let start = self.offset;
        if self.peek() == Some('-') {
            self.bump();
        }
        let digit_start = self.offset;
        while matches!(self.peek(), Some('0'..='9')) {
            self.bump();
        }
        if digit_start == self.offset {
            return Err(self.error("Expected an i32 literal."));
        }
        self.source[start..self.offset]
            .parse()
            .map_err(|_| self.error("i32 literal is out of range."))
    }

    fn expect(&mut self, character: char) -> Result<(), CompileError> {
        if self.consume(character) {
            Ok(())
        } else {
            Err(self.error(format!("Expected '{character}'.")))
        }
    }

    fn consume(&mut self, character: char) -> bool {
        self.skip_trivia();
        if self.peek() != Some(character) {
            return false;
        }
        self.bump();
        true
    }

    fn consume_text(&mut self, text: &str) -> bool {
        self.skip_trivia();
        if !self.source[self.offset..].starts_with(text) {
            return false;
        }
        self.offset += text.len();
        true
    }

    fn expect_arrow(&mut self) -> Result<(), CompileError> {
        self.skip_trivia();
        if self.source[self.offset..].starts_with("->") {
            self.offset += 2;
            Ok(())
        } else {
            Err(self.error("Expected '->'."))
        }
    }

    fn expect_end(&mut self) -> Result<(), CompileError> {
        self.skip_trivia();
        if self.offset == self.source.len() {
            Ok(())
        } else {
            Err(self.error("Expected the end of the program."))
        }
    }

    fn at_end(&mut self) -> bool {
        self.skip_trivia();
        self.offset == self.source.len()
    }

    fn skip_trivia(&mut self) {
        loop {
            while matches!(self.peek(), Some(' ' | '\t' | '\r' | '\n')) {
                self.bump();
            }
            if !self.source[self.offset..].starts_with("//") {
                return;
            }
            while !matches!(self.peek(), None | Some('\n')) {
                self.bump();
            }
        }
    }

    fn peek(&self) -> Option<char> {
        self.source[self.offset..].chars().next()
    }

    fn bump(&mut self) {
        self.offset += self.peek().expect("bump requires a character").len_utf8();
    }

    fn error(&self, message: impl Into<String>) -> CompileError {
        let before = &self.source[..self.offset];
        let line = before.bytes().filter(|byte| *byte == b'\n').count() + 1;
        CompileError::new(format!("{} (line {line})", message.into()))
    }
}

fn is_reserved_word(identifier: &str) -> bool {
    matches!(
        identifier,
        "fn" | "let"
            | "if"
            | "else"
            | "while"
            | "return"
            | "break"
            | "module"
            | "import"
            | "export"
    )
}

fn emit_module(program: &Program) -> Result<Vec<u8>, CompileError> {
    let functions = collect_functions(program)?;
    let mut output = vec![0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

    let mut types = Vec::new();
    encode_u32(&mut types, program.functions.len() as u32);
    for function in &program.functions {
        types.push(0x60);
        let parameter_count: usize = function.parameters.iter().map(parameter_slots).sum();
        encode_u32(&mut types, parameter_count as u32);
        types.extend(std::iter::repeat_n(0x7f, parameter_count));
        let result_count = value_slots(function.return_type);
        encode_u32(&mut types, result_count as u32);
        types.extend(std::iter::repeat_n(0x7f, result_count));
    }
    section(&mut output, 1, &types);

    let mut declarations = Vec::new();
    encode_u32(&mut declarations, program.functions.len() as u32);
    for index in 0..program.functions.len() {
        encode_u32(&mut declarations, index as u32);
    }
    section(&mut output, 3, &declarations);

    // 1 page (64 KiB) of linear memory is the initial host/Program boundary.
    section(&mut output, 5, &[0x01, 0x00, 0x01]);

    // The bump allocator starts after the bootstrap compiler's static bytes.
    section(&mut output, 6, &[0x01, 0x7f, 0x01, 0x41, 0x08, 0x0b]);

    let exported: Vec<_> = program
        .functions
        .iter()
        .enumerate()
        .filter(|(_, function)| function.exported)
        .collect();
    {
        let mut exports = Vec::new();
        encode_u32(&mut exports, (exported.len() + 1) as u32);
        encode_name(&mut exports, "memory");
        exports.push(0x02);
        exports.push(0x00);
        for (index, function) in exported {
            encode_name(&mut exports, &function.name);
            exports.push(0x00);
            encode_u32(&mut exports, index as u32);
        }
        section(&mut output, 7, &exports);
    }

    let mut code = Vec::new();
    encode_u32(&mut code, program.functions.len() as u32);
    for function in &program.functions {
        let body = emit_function(function, &functions)?;
        encode_u32(&mut code, body.len() as u32);
        code.extend(body);
    }
    section(&mut output, 10, &code);

    // The bootstrap compiler's first output is this valid empty Wasm module.
    // A later Program implementation will construct outputs with allocation and
    // byte_set; keeping these bytes in memory makes the initial compiler useful.
    let empty_module = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
    let mut data = vec![0x01, 0x00, 0x41, 0x00, 0x0b];
    encode_u32(&mut data, empty_module.len() as u32);
    data.extend(empty_module);
    section(&mut output, 11, &data);
    Ok(output)
}

#[derive(Clone)]
struct FunctionSignature {
    index: u32,
    parameters: Vec<ValueType>,
    return_type: ValueType,
}

fn collect_functions(program: &Program) -> Result<HashMap<&str, FunctionSignature>, CompileError> {
    let mut functions = HashMap::new();
    for (index, function) in program.functions.iter().enumerate() {
        if functions
            .insert(
                function.name.as_str(),
                FunctionSignature {
                    index: index as u32,
                    parameters: function
                        .parameters
                        .iter()
                        .map(|parameter| parameter.value_type)
                        .collect(),
                    return_type: function.return_type,
                },
            )
            .is_some()
        {
            return Err(CompileError::new(format!(
                "Duplicate function: {}",
                function.name
            )));
        }
    }
    Ok(functions)
}

fn parameter_slots(parameter: &Parameter) -> usize {
    value_slots(parameter.value_type)
}

fn value_slots(value_type: ValueType) -> usize {
    match value_type {
        ValueType::I32 => 1,
        ValueType::Bytes | ValueType::ArrayI32 => 2,
    }
}

fn emit_function(
    function: &Function,
    functions: &HashMap<&str, FunctionSignature>,
) -> Result<Vec<u8>, CompileError> {
    let mut locals = HashMap::new();
    let mut bytes = HashMap::new();
    let mut parameter_names = HashSet::new();
    let mut parameter_index = 0u32;
    for parameter in &function.parameters {
        if !parameter_names.insert(parameter.name.as_str()) {
            return Err(CompileError::new(format!(
                "Duplicate parameter in {}: {}",
                function.name, parameter.name
            )));
        }
        let inserted = match parameter.value_type {
            ValueType::I32 => locals
                .insert(parameter.name.as_str(), parameter_index)
                .is_none(),
            ValueType::Bytes | ValueType::ArrayI32 => bytes
                .insert(
                    parameter.name.as_str(),
                    (parameter_index, parameter_index + 1),
                )
                .is_none(),
        };
        debug_assert!(inserted);
        parameter_index += parameter_slots(parameter) as u32;
    }
    let mut local_count = 0u32;
    collect_locals(
        &function.statements,
        function,
        &mut locals,
        &mut bytes,
        parameter_index,
        &mut local_count,
        functions,
    )?;

    let mut body = Vec::new();
    if local_count == 0 {
        body.push(0);
    } else {
        body.extend([0x01]);
        encode_u32(&mut body, local_count);
        body.push(0x7f);
    }
    emit_statements(
        &mut body,
        &function.statements,
        &locals,
        &bytes,
        functions,
        function.return_type,
        &mut Vec::new(),
    )?;
    // 両方の分岐がreturnするifでも、WebAssemblyは構文上のfallthrough pathに値を要求する。
    for _ in 0..value_slots(function.return_type) {
        body.extend([0x41, 0x00]);
    }
    body.push(0x0f);
    body.push(0x0b);
    Ok(body)
}

fn collect_locals<'a>(
    statements: &'a [Statement],
    function: &Function,
    locals: &mut HashMap<&'a str, u32>,
    bytes: &mut HashMap<&'a str, (u32, u32)>,
    parameter_count: u32,
    local_count: &mut u32,
    functions: &HashMap<&str, FunctionSignature>,
) -> Result<(), CompileError> {
    for statement in statements {
        match statement {
            Statement::Let(name, annotation, expression) => {
                if locals.contains_key(name.as_str()) || bytes.contains_key(name.as_str()) {
                    return Err(CompileError::new(format!(
                        "Duplicate local in {}: {name}",
                        function.name
                    )));
                }
                let value_type =
                    annotation.unwrap_or(expression_type(expression, locals, bytes, functions)?);
                let index = parameter_count + *local_count;
                match value_type {
                    ValueType::I32 => {
                        locals.insert(name, index);
                        *local_count += 1;
                    }
                    ValueType::Bytes | ValueType::ArrayI32 => {
                        bytes.insert(name, (index, index + 1));
                        *local_count += 2;
                    }
                }
            }
            Statement::If(_, then_body, else_body) => {
                collect_locals(
                    then_body,
                    function,
                    locals,
                    bytes,
                    parameter_count,
                    local_count,
                    functions,
                )?;
                collect_locals(
                    else_body,
                    function,
                    locals,
                    bytes,
                    parameter_count,
                    local_count,
                    functions,
                )?;
            }
            Statement::While(_, body) => collect_locals(
                body,
                function,
                locals,
                bytes,
                parameter_count,
                local_count,
                functions,
            )?,
            Statement::Assign(_, _)
            | Statement::ByteSet(_, _, _)
            | Statement::ArraySet(_, _, _)
            | Statement::Break
            | Statement::Return(_) => {}
        }
    }
    Ok(())
}

#[derive(Clone, Copy)]
enum ControlFrame {
    Block,
    LoopBreak,
}

fn emit_statements(
    output: &mut Vec<u8>,
    statements: &[Statement],
    locals: &HashMap<&str, u32>,
    bytes: &HashMap<&str, (u32, u32)>,
    functions: &HashMap<&str, FunctionSignature>,
    return_type: ValueType,
    controls: &mut Vec<ControlFrame>,
) -> Result<(), CompileError> {
    for statement in statements {
        match statement {
            Statement::Let(name, _, expression) | Statement::Assign(name, expression) => {
                if let Some(index) = locals.get(name.as_str()) {
                    emit_expression(output, expression, locals, bytes, functions)?;
                    output.push(0x21);
                    encode_u32(output, *index);
                } else if let Some((pointer, length)) = bytes.get(name.as_str()) {
                    emit_bytes_expression(output, expression, locals, bytes, functions)?;
                    output.push(0x21);
                    encode_u32(output, *length);
                    output.push(0x21);
                    encode_u32(output, *pointer);
                } else {
                    return Err(CompileError::new(format!("Unknown variable: {name}")));
                }
            }
            Statement::ByteSet(bytes_value, index, value) => {
                let Expression::Variable(name) = bytes_value else {
                    return Err(CompileError::new("byte_set expects a bytes variable."));
                };
                let (pointer, _) = bytes
                    .get(name.as_str())
                    .ok_or_else(|| CompileError::new(format!("Unknown bytes variable: {name}")))?;
                output.push(0x20);
                encode_u32(output, *pointer);
                emit_expression(output, index, locals, bytes, functions)?;
                output.push(0x6a);
                emit_expression(output, value, locals, bytes, functions)?;
                output.extend([0x3a, 0x00, 0x00]);
            }
            Statement::ArraySet(array_value, index, value) => {
                let Expression::Variable(name) = array_value else {
                    return Err(CompileError::new("array_set expects an array variable."));
                };
                let (pointer, _) = bytes
                    .get(name.as_str())
                    .ok_or_else(|| CompileError::new(format!("Unknown array variable: {name}")))?;
                output.push(0x20);
                encode_u32(output, *pointer);
                emit_expression(output, index, locals, bytes, functions)?;
                output.extend([0x41, 0x04, 0x6c, 0x6a]);
                emit_expression(output, value, locals, bytes, functions)?;
                output.extend([0x36, 0x02, 0x00]);
            }
            Statement::Return(expression) => {
                match return_type {
                    ValueType::I32 => {
                        emit_expression(output, expression, locals, bytes, functions)?
                    }
                    ValueType::Bytes | ValueType::ArrayI32 => {
                        emit_bytes_expression(output, expression, locals, bytes, functions)?
                    }
                }
                output.push(0x0f);
            }
            Statement::Break => {
                let index = controls
                    .iter()
                    .rposition(|frame| matches!(frame, ControlFrame::LoopBreak))
                    .ok_or_else(|| CompileError::new("break is only valid inside while."))?;
                output.push(0x0c);
                encode_u32(output, (controls.len() - index - 1) as u32);
            }
            Statement::If(condition, then_body, else_body) => {
                emit_expression(output, condition, locals, bytes, functions)?;
                output.extend([0x04, 0x40]);
                controls.push(ControlFrame::Block);
                emit_statements(
                    output,
                    then_body,
                    locals,
                    bytes,
                    functions,
                    return_type,
                    controls,
                )?;
                if !else_body.is_empty() {
                    output.push(0x05);
                    emit_statements(
                        output,
                        else_body,
                        locals,
                        bytes,
                        functions,
                        return_type,
                        controls,
                    )?;
                }
                controls.pop();
                output.push(0x0b);
            }
            Statement::While(condition, body) => {
                output.extend([0x02, 0x40, 0x03, 0x40]);
                controls.push(ControlFrame::LoopBreak);
                controls.push(ControlFrame::Block);
                emit_expression(output, condition, locals, bytes, functions)?;
                output.extend([0x45, 0x0d, 0x01]);
                emit_statements(
                    output,
                    body,
                    locals,
                    bytes,
                    functions,
                    return_type,
                    controls,
                )?;
                output.extend([0x0c, 0x00, 0x0b, 0x0b]);
                controls.pop();
                controls.pop();
            }
        }
    }
    Ok(())
}

fn emit_expression(
    output: &mut Vec<u8>,
    expression: &Expression,
    locals: &HashMap<&str, u32>,
    bytes: &HashMap<&str, (u32, u32)>,
    functions: &HashMap<&str, FunctionSignature>,
) -> Result<(), CompileError> {
    match expression {
        Expression::Integer(value) => {
            output.push(0x41);
            encode_i32(output, *value);
        }
        Expression::Variable(name) => {
            let index = locals
                .get(name.as_str())
                .ok_or_else(|| CompileError::new(format!("Unknown variable: {name}")))?;
            output.push(0x20);
            encode_u32(output, *index);
        }
        Expression::Call(name, arguments) => {
            if name == "byte_pointer" {
                let [Expression::Variable(source)] = arguments.as_slice() else {
                    return Err(CompileError::new(
                        "byte_pointer expects one bytes variable.",
                    ));
                };
                let (pointer, _) = bytes.get(source.as_str()).ok_or_else(|| {
                    CompileError::new(format!("Unknown bytes variable: {source}"))
                })?;
                output.push(0x20);
                encode_u32(output, *pointer);
                return Ok(());
            }
            if name == "byte_length" {
                let [Expression::Variable(source)] = arguments.as_slice() else {
                    return Err(CompileError::new("byte_length expects one bytes variable."));
                };
                let (_, length) = bytes.get(source.as_str()).ok_or_else(|| {
                    CompileError::new(format!("Unknown bytes variable: {source}"))
                })?;
                output.push(0x20);
                encode_u32(output, *length);
                return Ok(());
            }
            if name == "array_get" {
                let [Expression::Variable(array), index] = arguments.as_slice() else {
                    return Err(CompileError::new(
                        "array_get expects an array variable and an index.",
                    ));
                };
                let (pointer, _) = bytes
                    .get(array.as_str())
                    .ok_or_else(|| CompileError::new(format!("Unknown array variable: {array}")))?;
                output.push(0x20);
                encode_u32(output, *pointer);
                emit_expression(output, index, locals, bytes, functions)?;
                output.extend([0x41, 0x04, 0x6c, 0x6a, 0x28, 0x02, 0x00]);
                return Ok(());
            }
            if name == "byte_at" {
                if arguments.len() != 2 {
                    return Err(CompileError::new(format!(
                        "Function byte_at expects 2 arguments, found {}",
                        arguments.len()
                    )));
                }
                let Expression::Variable(source) = &arguments[0] else {
                    return Err(CompileError::new(
                        "byte_at expects a bytes variable as its first argument.",
                    ));
                };
                let (pointer, _) = bytes.get(source.as_str()).ok_or_else(|| {
                    CompileError::new(format!("Unknown bytes variable: {source}"))
                })?;
                output.push(0x20);
                encode_u32(output, *pointer);
                emit_expression(output, &arguments[1], locals, bytes, functions)?;
                output.extend([0x6a, 0x2d, 0x00, 0x00]);
                return Ok(());
            }
            let signature = functions
                .get(name.as_str())
                .ok_or_else(|| CompileError::new(format!("Unknown function: {name}")))?;
            if signature.return_type != ValueType::I32 {
                return Err(CompileError::new(format!(
                    "Function {name} returns bytes where i32 is required."
                )));
            }
            if arguments.len() != signature.parameters.len() {
                return Err(CompileError::new(format!(
                    "Function {name} expects {} arguments, found {}",
                    signature.parameters.len(),
                    arguments.len()
                )));
            }
            for (argument, parameter_type) in arguments.iter().zip(&signature.parameters) {
                emit_argument(output, argument, *parameter_type, locals, bytes, functions)?;
            }
            output.push(0x10);
            encode_u32(output, signature.index);
        }
        Expression::Negate(value) => {
            output.push(0x41);
            encode_i32(output, 0);
            emit_expression(output, value, locals, bytes, functions)?;
            output.push(0x6b);
        }
        Expression::Binary(operator, left, right) => {
            emit_expression(output, left, locals, bytes, functions)?;
            emit_expression(output, right, locals, bytes, functions)?;
            output.push(match operator {
                BinaryOperator::Add => 0x6a,
                BinaryOperator::Subtract => 0x6b,
                BinaryOperator::Multiply => 0x6c,
                BinaryOperator::Divide => 0x6d,
                BinaryOperator::Equal => 0x46,
                BinaryOperator::NotEqual => 0x47,
                BinaryOperator::LessThan => 0x48,
                BinaryOperator::LessThanOrEqual => 0x4c,
                BinaryOperator::GreaterThan => 0x4a,
                BinaryOperator::GreaterThanOrEqual => 0x4e,
            });
        }
    }
    Ok(())
}

fn emit_bytes_expression(
    output: &mut Vec<u8>,
    expression: &Expression,
    locals: &HashMap<&str, u32>,
    bytes: &HashMap<&str, (u32, u32)>,
    functions: &HashMap<&str, FunctionSignature>,
) -> Result<(), CompileError> {
    match expression {
        Expression::Call(name, arguments)
            if name == "allocate_i32_array" && !functions.contains_key(name.as_str()) =>
        {
            if arguments.len() != 1 {
                return Err(CompileError::new(format!(
                    "Function allocate_i32_array expects 1 argument, found {}",
                    arguments.len()
                )));
            }
            output.extend([0x23, 0x00, 0x23, 0x00]);
            emit_expression(output, &arguments[0], locals, bytes, functions)?;
            output.extend([0x41, 0x04, 0x6c, 0x6a, 0x24, 0x00]);
            emit_expression(output, &arguments[0], locals, bytes, functions)?;
            Ok(())
        }
        Expression::Call(name, arguments)
            if name == "allocate_bytes" && !functions.contains_key(name.as_str()) =>
        {
            if arguments.len() != 1 {
                return Err(CompileError::new(format!(
                    "Function allocate_bytes expects 1 argument, found {}",
                    arguments.len()
                )));
            }
            output.extend([0x23, 0x00, 0x23, 0x00]);
            emit_expression(output, &arguments[0], locals, bytes, functions)?;
            output.extend([0x6a, 0x24, 0x00]);
            emit_expression(output, &arguments[0], locals, bytes, functions)?;
            Ok(())
        }
        Expression::Call(name, arguments)
            if name == "__seed_empty_module" && !functions.contains_key(name.as_str()) =>
        {
            if !arguments.is_empty() {
                return Err(CompileError::new(format!(
                    "Function {name} expects 0 arguments, found {}",
                    arguments.len()
                )));
            }
            output.extend([0x41, 0x00, 0x41, 0x08]);
            Ok(())
        }
        Expression::Variable(name) => {
            let (pointer, length) = bytes
                .get(name.as_str())
                .ok_or_else(|| CompileError::new(format!("Unknown bytes variable: {name}")))?;
            output.push(0x20);
            encode_u32(output, *pointer);
            output.push(0x20);
            encode_u32(output, *length);
            Ok(())
        }
        Expression::Call(name, arguments) => {
            let signature = functions
                .get(name.as_str())
                .ok_or_else(|| CompileError::new(format!("Unknown function: {name}")))?;
            if signature.return_type != ValueType::Bytes {
                return Err(CompileError::new(format!(
                    "Function {name} returns i32 where bytes is required."
                )));
            }
            if arguments.len() != signature.parameters.len() {
                return Err(CompileError::new(format!(
                    "Function {name} expects {} arguments, found {}",
                    signature.parameters.len(),
                    arguments.len()
                )));
            }
            for (argument, parameter_type) in arguments.iter().zip(&signature.parameters) {
                emit_argument(output, argument, *parameter_type, locals, bytes, functions)?;
            }
            output.push(0x10);
            encode_u32(output, signature.index);
            Ok(())
        }
        _ => Err(CompileError::new("Expected a bytes expression.")),
    }
}

fn expression_type(
    expression: &Expression,
    locals: &HashMap<&str, u32>,
    bytes: &HashMap<&str, (u32, u32)>,
    functions: &HashMap<&str, FunctionSignature>,
) -> Result<ValueType, CompileError> {
    match expression {
        Expression::Variable(name) if locals.contains_key(name.as_str()) => Ok(ValueType::I32),
        Expression::Variable(name) if bytes.contains_key(name.as_str()) => Ok(ValueType::Bytes),
        Expression::Variable(name) => Err(CompileError::new(format!("Unknown variable: {name}"))),
        Expression::Call(name, _)
            if name == "allocate_bytes" && !functions.contains_key(name.as_str()) =>
        {
            Ok(ValueType::Bytes)
        }
        Expression::Call(name, _)
            if name == "allocate_i32_array" && !functions.contains_key(name.as_str()) =>
        {
            Ok(ValueType::ArrayI32)
        }
        Expression::Call(name, _) if name == "byte_pointer" => Ok(ValueType::I32),
        Expression::Call(name, _) => functions
            .get(name.as_str())
            .map(|signature| signature.return_type)
            .ok_or_else(|| CompileError::new(format!("Unknown function: {name}"))),
        Expression::Integer(_) | Expression::Negate(_) | Expression::Binary(_, _, _) => {
            Ok(ValueType::I32)
        }
    }
}

fn emit_argument(
    output: &mut Vec<u8>,
    argument: &Expression,
    parameter_type: ValueType,
    locals: &HashMap<&str, u32>,
    bytes: &HashMap<&str, (u32, u32)>,
    functions: &HashMap<&str, FunctionSignature>,
) -> Result<(), CompileError> {
    match parameter_type {
        ValueType::I32 => emit_expression(output, argument, locals, bytes, functions),
        ValueType::Bytes | ValueType::ArrayI32 => {
            let Expression::Variable(name) = argument else {
                return Err(CompileError::new(
                    "A bytes argument must be a bytes variable.",
                ));
            };
            let (pointer, length) = bytes
                .get(name.as_str())
                .ok_or_else(|| CompileError::new(format!("Unknown bytes variable: {name}")))?;
            output.push(0x20);
            encode_u32(output, *pointer);
            output.push(0x20);
            encode_u32(output, *length);
            Ok(())
        }
    }
}

fn section(output: &mut Vec<u8>, id: u8, content: &[u8]) {
    output.push(id);
    encode_u32(output, content.len() as u32);
    output.extend(content);
}

fn encode_name(output: &mut Vec<u8>, name: &str) {
    encode_u32(output, name.len() as u32);
    output.extend(name.bytes());
}

fn encode_u32(output: &mut Vec<u8>, mut value: u32) {
    loop {
        let mut byte = (value & 0x7f) as u8;
        value >>= 7;
        if value != 0 {
            byte |= 0x80;
        }
        output.push(byte);
        if value == 0 {
            return;
        }
    }
}

fn encode_i32(output: &mut Vec<u8>, mut value: i32) {
    loop {
        let mut byte = (value as u32 & 0x7f) as u8;
        value >>= 7;
        let done = (value == 0 && byte & 0x40 == 0) || (value == -1 && byte & 0x40 != 0);
        if !done {
            byte |= 0x80;
        }
        output.push(byte);
        if done {
            return;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::compile_markdown;

    const EXAMPLE: &str = r#"
# Example

```answer.matra.program
module example

fn double(value: i32) -> i32 {
  return value * 2
}

export fn answer(input: i32) -> i32 {
  let doubled = double(input)
  let result: i32 = doubled + 2
  while result < 43 {
    result = result + 1
  }
  if result == 43 {
    return result
  } else {
    return 0
  }
}
```
"#;

    #[test]
    fn compiles_a_markdown_program_to_wasm() {
        let output = compile_markdown(EXAMPLE, None).unwrap();
        assert_eq!(&output[..4], b"\0asm");
    }

    #[test]
    fn selects_a_named_entry() {
        let markdown = format!(
            "{EXAMPLE}\n```other.matra.program\nmodule other\nexport fn other() -> i32 {{ return 1 }}\n```\n"
        );
        assert!(compile_markdown(&markdown, None).is_err());
        assert!(compile_markdown(&markdown, Some("answer.matra.program")).is_ok());
    }

    #[test]
    fn reports_missing_program_blocks() {
        assert!(compile_markdown("# No source", None).is_err());
    }

    #[test]
    fn reports_unknown_names() {
        let source = "```broken.matra.program\nmodule broken\nexport fn answer() -> i32 { return missing }\n```";
        assert!(
            compile_markdown(source, None)
                .unwrap_err()
                .to_string()
                .contains("Unknown variable")
        );
    }

    #[test]
    fn resolves_imported_modules_from_markdown_fences() {
        let source = r#"
```math.matra.program
module math
fn double(value: i32) -> i32 { return value * 2 }
```

```entry.matra.program
module entry
import math
export fn answer() -> i32 { return double(21) }
```
"#;
        assert!(compile_markdown(source, Some("entry.matra.program")).is_ok());
    }

    #[test]
    fn rejects_unknown_imports() {
        let source = "```entry.matra.program\nmodule entry\nimport missing\nexport fn answer() -> i32 { return 1 }\n```";
        assert!(
            compile_markdown(source, None)
                .unwrap_err()
                .to_string()
                .contains("Unknown module")
        );
    }

    #[test]
    fn rejects_reserved_words_as_identifiers() {
        let source =
            "```entry.matra.program\nmodule entry\nexport fn return() -> i32 { return 1 }\n```";
        assert!(
            compile_markdown(source, None)
                .unwrap_err()
                .to_string()
                .contains("Reserved word")
        );
    }

    #[test]
    fn rejects_duplicate_parameter_names_across_lowered_types() {
        let source = "```entry.matra.program\nmodule entry\nexport fn answer(value: i32, value: bytes) -> i32 { return value }\n```";
        assert!(
            compile_markdown(source, None)
                .unwrap_err()
                .to_string()
                .contains("Duplicate parameter")
        );
    }
}
