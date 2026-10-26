//! 標準文法の構文木。native profile と文書 profile は同じ parser を使う。
use crate::CompileError;
use std::cell::{Cell, RefCell};

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Value>),
    Object(Vec<(String, Value)>),
    Node {
        tag: String,
        props: Vec<(String, Value)>,
        children: Vec<Value>,
    },
}

impl Value {
    pub fn to_json(&self) -> String {
        match self {
            Self::Null => "null".into(),
            Self::Bool(v) => v.to_string(),
            Self::Number(v) => v.to_string(),
            Self::String(v) => quote(v),
            Self::Array(v) => format!(
                "[{}]",
                v.iter().map(Self::to_json).collect::<Vec<_>>().join(",")
            ),
            Self::Object(v) => format!(
                "{{{}}}",
                v.iter()
                    .map(|(k, v)| format!("{}:{}", quote(k), v.to_json()))
                    .collect::<Vec<_>>()
                    .join(",")
            ),
            Self::Node {
                tag,
                props,
                children,
            } => Self::Object(vec![
                ("tag".into(), Self::String(tag.clone())),
                ("props".into(), Self::Object(props.clone())),
                ("children".into(), Self::Array(children.clone())),
            ])
            .to_json(),
        }
    }
}

fn quote(value: &str) -> String {
    let mut result = String::from("\"");
    for c in value.chars() {
        match c {
            '"' => result.push_str("\\\""),
            '\\' => result.push_str("\\\\"),
            c if c < ' ' => result.push_str(&format!("\\u{:04x}", c as u32)),
            c => result.push(c),
        }
    }
    result.push('"');
    result
}

#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    If(Box<Expr>, Vec<Stmt>, Vec<Stmt>),
    For(String, Box<Expr>, Vec<Stmt>),
    While(Box<Expr>, Vec<Stmt>),
    DoUntil(Vec<Stmt>, Box<Expr>),
    Literal(Value),
    Reference(String),
    Array(Vec<Expr>),
    Object(Vec<(String, Expr)>),
    Member(Box<Expr>, String),
    Call(Box<Expr>, Vec<Expr>),
    Unary(String, Box<Expr>),
    Binary(String, Box<Expr>, Box<Expr>),
    Node {
        tag: String,
        classes: Vec<String>,
        attributes: Vec<(String, Expr)>,
        body: Vec<Stmt>,
    },
}

#[derive(Debug, Clone, PartialEq)]
pub enum Stmt {
    Expression(Expr),
    Spread(Expr),
    Let(String, Option<String>, Expr),
    Assign(String, Expr),
    Return(Expr),
    Break,
    Function {
        id: usize,
        exported: bool,
        name: String,
        parameters: Vec<(String, Option<String>)>,
        result: Option<String>,
        body: Vec<Stmt>,
    },
    Module(String),
    Import(String),
    Struct(String, Vec<String>),
}

#[derive(Debug, Clone, PartialEq)]
pub struct Module {
    pub statements: Vec<Stmt>,
}

#[derive(Debug, Clone, PartialEq)]
enum Kind {
    Word,
    Number,
    String,
    Symbol,
    Newline,
    End,
    Invalid,
}
#[derive(Clone, Copy, PartialEq)]
enum MarkupName {
    Tag,
    Class,
    Attribute,
}
#[derive(Debug, Clone)]
struct Token {
    kind: Kind,
    text: String,
    offset: usize,
}

fn error(source: &str, offset: usize, message: impl AsRef<str>) -> CompileError {
    let before = &source[..offset];
    let line = before.bytes().filter(|&b| b == b'\n').count() + 1;
    let column = before.rsplit('\n').next().unwrap_or("").chars().count() + 1;
    CompileError::new(format!(
        "{} at offset {offset} (line {line}, column {column})",
        message.as_ref()
    ))
}

fn next_token(source: &str, position: &mut usize) -> Result<Token, CompileError> {
    let mut offset = *position;
    let bytes = source.as_bytes();
    while offset < bytes.len() {
        let start = offset;
        let b = bytes[offset];
        if matches!(b, b' ' | b'\t' | b'\r') {
            offset += 1;
            continue;
        }
        if source[offset..].starts_with("//") {
            while offset < bytes.len() && bytes[offset] != b'\n' {
                offset += 1;
            }
            continue;
        }
        let kind;
        let text;
        if b == b'\n' {
            kind = Kind::Newline;
            text = "\n".into();
            offset += 1;
        } else if b == b'"' {
            kind = Kind::String;
            offset += 1;
            let content = offset;
            while offset < bytes.len() && bytes[offset] != b'"' {
                if matches!(bytes[offset], b'\\' | b'\n' | b'\r') {
                    return Err(error(
                        source,
                        offset,
                        "String escapes and multiline strings are not supported",
                    ));
                }
                offset += source[offset..].chars().next().unwrap().len_utf8();
            }
            if offset == bytes.len() {
                return Err(error(source, start, "Unterminated string"));
            }
            text = source[content..offset].into();
            offset += 1;
        } else if b.is_ascii_digit()
            || (b == b'.' && bytes.get(offset + 1).is_some_and(u8::is_ascii_digit))
        {
            kind = Kind::Number;
            while offset < bytes.len() && bytes[offset].is_ascii_digit() {
                offset += 1;
            }
            if bytes.get(offset) == Some(&b'.') {
                offset += 1;
                while offset < bytes.len() && bytes[offset].is_ascii_digit() {
                    offset += 1;
                }
            }
            text = source[start..offset].into();
        } else if b.is_ascii_alphabetic() || b == b'_' {
            kind = Kind::Word;
            offset += 1;
            while bytes
                .get(offset)
                .is_some_and(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-'))
            {
                offset += 1;
            }
            text = source[start..offset].into();
        } else {
            kind = Kind::Symbol;
            if let Some(op) = ["...", "==", "!=", "<=", ">=", "&&", "||", "->"]
                .iter()
                .find(|op| source[offset..].starts_with(**op))
            {
                text = (*op).into();
                offset += op.len();
            } else if b"{}[](),.:=;!+-*/<>".contains(&b) {
                text = (b as char).to_string();
                offset += 1;
            } else {
                return Err(error(source, start, "Unexpected character"));
            }
        }
        *position = offset;
        return Ok(Token {
            kind,
            text,
            offset: start,
        });
    }
    *position = offset;
    Ok(Token {
        kind: Kind::End,
        text: String::new(),
        offset,
    })
}

pub fn parse(source: &str) -> Result<Module, CompileError> {
    let mut parser = Parser {
        source,
        tokens: RefCell::new(Vec::new()),
        position: Cell::new(0),
        index: 0,
        functions: 0,
        enclosed: false,
        bare_header: false,
        node_body: false,
    };
    let statements = parser.statements("")?;
    Ok(Module { statements })
}

struct Parser<'a> {
    source: &'a str,
    tokens: RefCell<Vec<Token>>,
    position: Cell<usize>,
    index: usize,
    functions: usize,
    enclosed: bool,
    bare_header: bool,
    node_body: bool,
}
impl Parser<'_> {
    fn token_at(&self, index: usize) -> Token {
        let mut tokens = self.tokens.borrow_mut();
        while tokens.len() <= index {
            let mut position = self.position.get();
            let token = next_token(self.source, &mut position).unwrap_or_else(|err| Token {
                kind: Kind::Invalid,
                text: err.to_string(),
                offset: position,
            });
            self.position.set(position);
            tokens.push(token);
        }
        tokens[index].clone()
    }
    fn token(&self) -> Token {
        self.token_at(self.index)
    }
    fn at(&self, text: &str) -> bool {
        self.token().kind != Kind::String && self.token().text == text
    }
    fn take(&mut self, text: &str) -> bool {
        if self.at(text) {
            self.index += 1;
            true
        } else {
            false
        }
    }
    fn fail(&self, message: impl AsRef<str>) -> CompileError {
        if self.token().kind == Kind::Invalid {
            return CompileError::new(self.token().text);
        }
        error(self.source, self.token().offset, message)
    }
    fn expect(&mut self, text: &str) -> Result<(), CompileError> {
        if self.take(text) {
            Ok(())
        } else {
            Err(self.fail(format!("Expected '{text}'")))
        }
    }
    fn word(&mut self) -> Result<String, CompileError> {
        if self.token().kind != Kind::Word
            || matches!(
                self.token().text.as_str(),
                "let"
                    | "fn"
                    | "if"
                    | "else"
                    | "else_if"
                    | "for"
                    | "in"
                    | "return"
                    | "while"
                    | "do"
                    | "until"
                    | "break"
                    | "module"
                    | "import"
                    | "export"
                    | "struct"
                    | "set"
                    | "true"
                    | "false"
                    | "null"
            )
        {
            return Err(self.fail("Expected an identifier"));
        }
        self.property_word()
    }
    fn property_word(&mut self) -> Result<String, CompileError> {
        if self.token().kind != Kind::Word {
            return Err(self.fail("Expected a property name"));
        }
        let name = self.token().text.clone();
        self.index += 1;
        Ok(name)
    }
    fn inline(&mut self) {
        while self.token().kind == Kind::Newline {
            self.index += 1;
        }
    }
    fn separators(&mut self) -> bool {
        let start = self.index;
        while self.token().kind == Kind::Newline || self.at(";") {
            self.index += 1;
        }
        self.index != start
    }
    fn statements(&mut self, end: &str) -> Result<Vec<Stmt>, CompileError> {
        let mut result = Vec::new();
        self.separators();
        while !self.at(end) {
            if self.token().kind == Kind::End {
                return Err(self.fail(format!("Expected '{end}'")));
            }
            result.push(self.statement()?);
            if !self.at(end) && !self.separators() {
                return Err(self.fail("Expected a newline or ';' between statements"));
            }
        }
        Ok(result)
    }
    fn block(&mut self) -> Result<Vec<Stmt>, CompileError> {
        self.body(false)
    }
    fn body(&mut self, node: bool) -> Result<Vec<Stmt>, CompileError> {
        self.expect("{")?;
        let saved = (self.enclosed, self.bare_header, self.node_body);
        self.enclosed = false;
        self.bare_header = false;
        self.node_body = node;
        let result = self.statements("}")?;
        self.expect("}")?;
        (self.enclosed, self.bare_header, self.node_body) = saved;
        Ok(result)
    }
    fn trivia(&mut self) {
        if self.enclosed {
            self.inline();
        }
    }
    fn nested<T>(
        &mut self,
        parse: impl FnOnce(&mut Self) -> Result<T, CompileError>,
    ) -> Result<T, CompileError> {
        let saved = (self.enclosed, self.bare_header);
        self.enclosed = true;
        self.bare_header = false;
        self.inline();
        let value = parse(self)?;
        self.inline();
        (self.enclosed, self.bare_header) = saved;
        Ok(value)
    }
    fn type_name(&mut self) -> Result<String, CompileError> {
        if self.take("[") {
            let name = self.word()?;
            self.expect("]")?;
            Ok(format!("[{name}]"))
        } else {
            self.word()
        }
    }
    fn annotation(&mut self) -> Result<Option<String>, CompileError> {
        if self.take(":") {
            Ok(Some(self.type_name()?))
        } else {
            Ok(None)
        }
    }
    fn condition(&mut self) -> Result<Expr, CompileError> {
        if self.take("(") {
            let value = self.nested(|p| p.expression(1))?;
            self.expect(")")?;
            Ok(value)
        } else {
            let saved = (self.enclosed, self.bare_header);
            self.enclosed = false;
            self.bare_header = true;
            let value = self.expression(1)?;
            (self.enclosed, self.bare_header) = saved;
            Ok(value)
        }
    }
    fn statement(&mut self) -> Result<Stmt, CompileError> {
        if self.take("let") {
            let parenthesized = self.take("(");
            let binding = |p: &mut Self| {
                let name = p.word()?;
                p.trivia();
                let annotation = p.annotation()?;
                p.trivia();
                p.expect("=")?;
                Ok(Stmt::Let(name, annotation, p.expression(1)?))
            };
            let result = if parenthesized {
                self.nested(binding)?
            } else {
                binding(self)?
            };
            if parenthesized {
                self.expect(")")?;
            }
            return Ok(result);
        }
        if self.take("return") {
            return Ok(Stmt::Return(self.expression(1)?));
        }
        if self.take("break") {
            return Ok(Stmt::Break);
        }
        if self.take("...") {
            if !self.node_body {
                return Err(self.fail("Spread is only allowed in a node body"));
            }
            return Ok(Stmt::Spread(self.expression(1)?));
        }
        let exported = self.take("export");
        if exported || self.at("fn") {
            self.expect("fn")?;
            let name = self.word()?;
            self.expect("(")?;
            let parameters = self.list(")", |p| {
                let name = p.word()?;
                Ok((name, p.annotation()?))
            })?;
            let mut seen = std::collections::HashSet::new();
            for (name, _) in &parameters {
                if !seen.insert(name) {
                    return Err(self.fail("Duplicate parameter"));
                }
            }
            let result = if self.take("->") {
                Some(self.type_name()?)
            } else {
                None
            };
            let id = self.functions;
            self.functions += 1;
            return Ok(Stmt::Function {
                id,
                exported,
                name,
                parameters,
                result,
                body: self.block()?,
            });
        }
        if self.take("module") {
            return Ok(Stmt::Module(self.word()?));
        }
        if self.take("import") {
            return Ok(Stmt::Import(self.word()?));
        }
        if self.take("struct") {
            let name = self.word()?;
            self.expect("{")?;
            self.separators();
            let mut fields = Vec::new();
            while !self.at("}") {
                fields.push(self.word()?);
                self.expect(":")?;
                self.expect("i32")?;
                if !self.at("}") && !self.separators() {
                    return Err(self.fail("Expected a field separator"));
                }
            }
            self.expect("}")?;
            return Ok(Stmt::Struct(name, fields));
        }
        if self.token().kind == Kind::Word && self.token_at(self.index + 1).text == "=" {
            let name = self.word()?;
            self.expect("=")?;
            return Ok(Stmt::Assign(name, self.expression(1)?));
        }
        Ok(Stmt::Expression(self.expression(1)?))
    }
    fn list<T>(
        &mut self,
        end: &str,
        item: impl FnMut(&mut Self) -> Result<T, CompileError>,
    ) -> Result<Vec<T>, CompileError> {
        self.separated_list(end, false, item)
    }
    fn separated_list<T>(
        &mut self,
        end: &str,
        attributes: bool,
        mut item: impl FnMut(&mut Self) -> Result<T, CompileError>,
    ) -> Result<Vec<T>, CompileError> {
        let saved = (self.enclosed, self.bare_header);
        self.enclosed = true;
        self.bare_header = false;
        let mut result = Vec::new();
        self.inline();
        if self.take(end) {
            (self.enclosed, self.bare_header) = saved;
            return Ok(result);
        }
        loop {
            self.inline();
            result.push(item(self)?);
            self.inline();
            if self.take(end) {
                (self.enclosed, self.bare_header) = saved;
                return Ok(result);
            }
            if attributes && self.starts_attribute() {
                continue;
            }
            self.expect(",")?;
        }
    }
    fn starts_attribute(&self) -> bool {
        let token = self.token();
        if token.kind != Kind::Word
            || !self
                .source
                .as_bytes()
                .get(token.offset.wrapping_sub(1))
                .is_some_and(|b| matches!(b, b' ' | b'\t' | b'\r' | b'\n'))
        {
            return false;
        }
        let mut cursor = self.index + 1;
        while self.token_at(cursor).kind == Kind::Newline {
            cursor += 1;
        }
        let following = self.token_at(cursor);
        following.kind == Kind::Symbol && following.text == "="
    }
    fn expression(&mut self, min: u8) -> Result<Expr, CompileError> {
        self.trivia();
        let mut left = self.unary()?;
        loop {
            self.trivia();
            let priority = match self.token().text.as_str() {
                "||" => 1,
                "&&" => 2,
                "==" | "!=" => 3,
                "<" | "<=" | ">" | ">=" => 4,
                "+" | "-" => 5,
                "*" | "/" => 6,
                _ => 0,
            };
            if self.token().kind != Kind::Symbol || priority < min {
                break;
            }
            let op = self.token().text.clone();
            self.index += 1;
            left = Expr::Binary(op, Box::new(left), Box::new(self.expression(priority + 1)?));
        }
        Ok(left)
    }
    fn unary(&mut self) -> Result<Expr, CompileError> {
        self.trivia();
        if self.at("!") || self.at("-") {
            let op = self.token().text.clone();
            self.index += 1;
            return Ok(Expr::Unary(op, Box::new(self.unary()?)));
        }
        let mut result = self.primary()?;
        loop {
            self.trivia();
            if self.take(".") {
                result = Expr::Member(Box::new(result), self.property_word()?);
            } else if self.take("(") {
                let args = self.list(")", |p| p.expression(1))?;
                result = Expr::Call(Box::new(result), args);
            } else {
                break;
            }
        }
        Ok(result)
    }
    fn if_expression(&mut self) -> Result<Expr, CompileError> {
        let condition = self.condition()?;
        let yes = self.block()?;
        let checkpoint = self.index;
        self.inline();
        let no = if self.take("else_if") {
            vec![Stmt::Expression(self.if_expression()?)]
        } else if self.take("else") {
            self.block()?
        } else {
            self.index = checkpoint;
            vec![]
        };
        Ok(Expr::If(Box::new(condition), yes, no))
    }
    fn primary(&mut self) -> Result<Expr, CompileError> {
        self.trivia();
        if self.at("<") {
            let mut offset = self.token().offset;
            let node = self.markup(&mut offset)?;
            self.tokens.get_mut().truncate(self.index);
            self.position.set(offset);
            return Ok(node);
        }
        if self.take("if") {
            return self.if_expression();
        }
        if self.take("while") {
            let condition = self.condition()?;
            return Ok(Expr::While(Box::new(condition), self.block()?));
        }
        if self.take("do") {
            let body = self.block()?;
            self.inline();
            self.expect("until")?;
            if !self.at("(") {
                return Err(self.fail("Expected '('"));
            }
            return Ok(Expr::DoUntil(body, Box::new(self.condition()?)));
        }
        if self.take("for") {
            let enclosed = self.take("(");
            let saved = (self.enclosed, self.bare_header);
            self.enclosed = enclosed;
            self.bare_header = !enclosed;
            self.trivia();
            let name = self.word()?;
            self.trivia();
            self.expect("in")?;
            let values = self.expression(1)?;
            if enclosed {
                self.expect(")")?;
            }
            (self.enclosed, self.bare_header) = saved;
            return Ok(Expr::For(name, Box::new(values), self.block()?));
        }
        if self.token().kind == Kind::String {
            let value = self.token().text.clone();
            self.index += 1;
            return Ok(Expr::Literal(Value::String(value)));
        }
        if self.token().kind == Kind::Number {
            let value: f64 = self
                .token()
                .text
                .parse()
                .map_err(|_| self.fail("Invalid number"))?;
            if !value.is_finite() {
                return Err(self.fail("Number is out of range"));
            }
            self.index += 1;
            return Ok(Expr::Literal(Value::Number(value)));
        }
        for (text, value) in [
            ("true", Value::Bool(true)),
            ("false", Value::Bool(false)),
            ("null", Value::Null),
        ] {
            if self.take(text) {
                return Ok(Expr::Literal(value));
            }
        }
        if self.take("(") {
            let value = self.nested(|p| p.expression(1))?;
            self.expect(")")?;
            return Ok(value);
        }
        if self.take("[") {
            return Ok(Expr::Array(self.list("]", |p| p.expression(1))?));
        }
        if self.take("{") {
            return Ok(Expr::Object(self.list("}", |p| {
                let key = if p.token().kind == Kind::String {
                    let k = p.token().text.clone();
                    p.index += 1;
                    k
                } else {
                    p.property_word()?
                };
                p.expect(":")?;
                Ok((key, p.expression(1)?))
            })?));
        }
        let name = self.word()?;
        let checkpoint = self.index;
        let mut classes = Vec::new();
        while self.take(".") {
            let class = self.property_word()?;
            if !classes.contains(&class) {
                classes.push(class);
            }
        }
        let mut attribute_start = self.index + 1;
        if !self.bare_header && self.at("(") {
            while self.token_at(attribute_start).kind == Kind::Newline {
                attribute_start += 1;
            }
        }
        // 属性の代入は call には現れないため、本文まで先読みせず node と判定できる。
        let mut attribute_equals = attribute_start + 1;
        if !self.bare_header && self.at("(") {
            while self.token_at(attribute_equals).kind == Kind::Newline {
                attribute_equals += 1;
            }
        }
        let node_body = self.at("{")
            || (self.at("(")
                && !self.bare_header
                && ((self.token_at(attribute_start).kind == Kind::Word
                    && self.token_at(attribute_equals).text == "=")
                    || (self.token_at(attribute_start).text == ")"
                        && self.token_at(attribute_start + 1).text == "{")));
        if !self.bare_header && node_body {
            let attributes = if self.take("(") {
                self.separated_list(")", true, |p| {
                    let key = p.property_word()?;
                    p.trivia();
                    p.expect("=")?;
                    Ok((key, p.expression(1)?))
                })?
            } else {
                vec![]
            };
            return Ok(Expr::Node {
                tag: name,
                classes,
                attributes,
                body: self.body(true)?,
            });
        }
        self.index = checkpoint;
        Ok(Expr::Reference(name))
    }

    fn markup_space(&self, offset: &mut usize) -> bool {
        let start = *offset;
        while self
            .source
            .as_bytes()
            .get(*offset)
            .is_some_and(|b| matches!(b, b' ' | b'\t' | b'\r' | b'\n'))
        {
            *offset += 1;
        }
        *offset != start
    }

    fn markup_expect(&self, offset: &mut usize, text: &str) -> Result<(), CompileError> {
        if !self.source[*offset..].starts_with(text) {
            return Err(error(self.source, *offset, format!("Expected '{text}'")));
        }
        *offset += text.len();
        Ok(())
    }

    fn markup_name(&self, offset: &mut usize, kind: MarkupName) -> Result<String, CompileError> {
        let start = *offset;
        let bytes = self.source.as_bytes();
        if !bytes.get(*offset).is_some_and(|b| {
            b.is_ascii_alphabetic() || *b == b'_' || *b == b':' && kind != MarkupName::Class
        }) {
            return Err(error(self.source, *offset, "Expected a markup name"));
        }
        *offset += 1;
        while bytes.get(*offset).is_some_and(|b| {
            b.is_ascii_alphanumeric()
                || matches!(b, b'_' | b'-')
                || *b == b':' && kind != MarkupName::Class
                || *b == b'.' && kind == MarkupName::Attribute
        }) {
            *offset += 1;
        }
        Ok(self.source[start..*offset].into())
    }

    fn markup_character(&self, offset: &mut usize) -> Result<char, CompileError> {
        let start = *offset;
        let rest = &self.source[start..];
        let character = if rest.starts_with('&') {
            let invalid = || error(self.source, start, "Invalid markup character reference");
            let end = rest.find(';').ok_or_else(invalid)?;
            let reference = &rest[1..end];
            let character = match reference {
                "amp" => '&',
                "lt" => '<',
                "gt" => '>',
                "quot" => '"',
                "apos" => '\'',
                _ => {
                    let (digits, radix) = if let Some(digits) = reference.strip_prefix("#x") {
                        (digits, 16)
                    } else if let Some(digits) = reference.strip_prefix('#') {
                        (digits, 10)
                    } else {
                        return Err(invalid());
                    };
                    if digits.is_empty()
                        || !digits.bytes().all(|b| match radix {
                            16 => b.is_ascii_hexdigit(),
                            _ => b.is_ascii_digit(),
                        })
                    {
                        return Err(invalid());
                    }
                    u32::from_str_radix(digits, radix)
                        .ok()
                        .and_then(char::from_u32)
                        .ok_or_else(invalid)?
                }
            };
            *offset += end + 1;
            character
        } else {
            let character = rest.chars().next().unwrap();
            *offset += character.len_utf8();
            character
        };
        if !matches!(character as u32, 0x9 | 0xA | 0xD | 0x20..=0xD7FF | 0xE000..=0xFFFD | 0x10000..=0x10FFFF)
        {
            return Err(error(self.source, start, "Invalid XML character"));
        }
        Ok(character)
    }

    fn markup(&self, offset: &mut usize) -> Result<Expr, CompileError> {
        self.markup_expect(offset, "<")?;
        let tag = self.markup_name(offset, MarkupName::Tag)?;
        let mut classes = Vec::new();
        while self.source[*offset..].starts_with('.') {
            *offset += 1;
            let name = self.markup_name(offset, MarkupName::Class)?;
            if !classes.contains(&name) {
                classes.push(name);
            }
        }
        let mut attributes = Vec::new();
        let mut names = std::collections::HashSet::new();
        let empty = loop {
            let separated = self.markup_space(offset);
            if self.source[*offset..].starts_with("/>") {
                *offset += 2;
                break true;
            }
            if self.source[*offset..].starts_with('>') {
                *offset += 1;
                break false;
            }
            if !separated {
                return Err(error(
                    self.source,
                    *offset,
                    "Expected markup attribute whitespace, '>' or '/>'",
                ));
            }
            let start = *offset;
            let name = self.markup_name(offset, MarkupName::Attribute)?;
            if !names.insert(name.clone()) {
                return Err(error(self.source, start, "Duplicate markup attribute"));
            }
            self.markup_space(offset);
            self.markup_expect(offset, "=")?;
            self.markup_space(offset);
            let quote = match self.source.as_bytes().get(*offset) {
                Some(b @ (b'\'' | b'"')) => *b,
                _ => return Err(error(self.source, *offset, "Expected a quoted attribute")),
            };
            *offset += 1;
            let mut value = String::new();
            loop {
                match self.source.as_bytes().get(*offset) {
                    Some(b) if *b == quote => {
                        *offset += 1;
                        break;
                    }
                    Some(b'<') => {
                        return Err(error(self.source, *offset, "Literal '<' in attribute"));
                    }
                    None => return Err(error(self.source, *offset, "Unterminated attribute")),
                    _ => value.push(self.markup_character(offset)?),
                }
            }
            attributes.push((name, Expr::Literal(Value::String(value))));
        };
        let mut body = Vec::new();
        if !empty {
            loop {
                let rest = &self.source[*offset..];
                if rest.starts_with("</") {
                    *offset += 2;
                    let start = *offset;
                    if self.markup_name(offset, MarkupName::Tag)? != tag {
                        return Err(error(self.source, start, "Mismatched closing markup name"));
                    }
                    self.markup_space(offset);
                    self.markup_expect(offset, ">")?;
                    break;
                }
                if rest.starts_with('<') {
                    body.push(Stmt::Expression(self.markup(offset)?));
                } else {
                    if rest.is_empty() {
                        return Err(error(self.source, *offset, "Expected a closing markup tag"));
                    }
                    let mut text = String::new();
                    while *offset < self.source.len() && !self.source[*offset..].starts_with('<') {
                        if self.source[*offset..].starts_with("]]>") {
                            return Err(error(
                                self.source,
                                *offset,
                                "Literal ']]>' in markup text",
                            ));
                        }
                        text.push(self.markup_character(offset)?);
                    }
                    body.push(Stmt::Expression(Expr::Literal(Value::String(text))));
                }
            }
        }
        Ok(Expr::Node {
            tag,
            classes,
            attributes,
            body,
        })
    }
}

pub fn evaluate_static(module: &Module) -> Result<Option<Value>, CompileError> {
    fn expr(
        value: &Expr,
        scope: &mut std::collections::HashMap<String, Value>,
    ) -> Result<Value, CompileError> {
        Ok(match value {
            Expr::Literal(v) => v.clone(),
            Expr::Reference(name) => scope
                .get(name)
                .cloned()
                .ok_or_else(|| CompileError::new(format!("EvaluationRequired: {name}")))?,
            Expr::Array(items) => Value::Array(
                items
                    .iter()
                    .map(|v| expr(v, scope))
                    .collect::<Result<_, _>>()?,
            ),
            Expr::Object(items) => Value::Object(
                items
                    .iter()
                    .map(|(k, v)| Ok((k.clone(), expr(v, scope)?)))
                    .collect::<Result<_, CompileError>>()?,
            ),
            Expr::Node {
                tag,
                classes,
                attributes,
                body,
            } => {
                let mut props = Vec::new();
                for (k, v) in attributes {
                    put(&mut props, k.clone(), expr(v, scope)?);
                }
                if !classes.is_empty() {
                    put(&mut props, "class".into(), Value::String(classes.join(" ")));
                }
                let mut child_scope = scope.clone();
                let mut children = Vec::new();
                let mut declarations = std::collections::HashSet::new();
                for statement in body {
                    if let Stmt::Let(name, _, _) = statement {
                        if !declarations.insert(name) {
                            return Err(CompileError::new("Duplicate binding"));
                        }
                    }
                    if let Stmt::Spread(value) = statement {
                        let Value::Array(items) = expr(value, &mut child_scope)? else {
                            return Err(CompileError::new("Spread requires an array"));
                        };
                        children.extend(items);
                    } else if let Some(value) = stmt(statement, &mut child_scope)? {
                        children.push(value);
                    }
                }
                Value::Node {
                    tag: tag.clone(),
                    props,
                    children,
                }
            }
            _ => {
                return Err(CompileError::new(
                    "EvaluationRequired: expression requires execution",
                ));
            }
        })
    }
    fn stmt(
        statement: &Stmt,
        scope: &mut std::collections::HashMap<String, Value>,
    ) -> Result<Option<Value>, CompileError> {
        match statement {
            Stmt::Let(name, None, value) => {
                let value = expr(value, scope)?;
                scope.insert(name.clone(), value);
                Ok(None)
            }
            Stmt::Expression(value) => Ok(Some(expr(value, scope)?)),
            _ => Err(CompileError::new(
                "EvaluationRequired: statement requires execution",
            )),
        }
    }
    let mut scope = std::collections::HashMap::new();
    let mut output = Some(Value::Null);
    let mut declarations = std::collections::HashSet::new();
    for statement in &module.statements {
        if let Stmt::Let(name, _, _) = statement {
            if !declarations.insert(name) {
                return Err(CompileError::new("Duplicate binding"));
            }
        }
        output = Some(stmt(statement, &mut scope)?.unwrap_or(Value::Null));
    }
    Ok(output)
}
fn put(props: &mut Vec<(String, Value)>, key: String, value: Value) {
    if let Some(entry) = props.iter_mut().find(|(k, _)| *k == key) {
        entry.1 = value;
    } else {
        props.push((key, value));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_attribute_whitespace_preserves_ast_values_and_diagnostics() {
        let source = "p(title=\"Matra\" options={tags: [\"HTML\", \"JSON\"]}\n child=<hr />) {}";
        let comma = "p(title=\"Matra\", options={tags: [\"HTML\", \"JSON\"]}, child=<hr />) {}";
        assert_eq!(parse(source).unwrap(), parse(comma).unwrap());
        assert_eq!(static_value(source), static_value(comma));
        for (source, offset) in [
            ("p(a=\"x\"b=\"y\") {}", 7),
            ("p(a=1 b=) {}", 8),
            ("p(a=1 b=", 8),
        ] {
            let diagnostic = parse(source).unwrap_err().to_string();
            assert!(
                diagnostic.contains(&format!("offset {offset} ")),
                "{diagnostic}"
            );
        }
    }

    fn static_value(source: &str) -> Value {
        evaluate_static(&parse(source).unwrap()).unwrap().unwrap()
    }

    #[test]
    fn markup_preserves_raw_text_and_decodes_attributes_and_children() {
        let text = " \r\n\t\"'{} // 日本語\\ @ ` $ ";
        let source = format!(
            "<ns:if.a-b _x = '1' xmlns:ns=\"urn:x\" class='a' q=\"&quot;&apos;&amp;&lt;&gt;&#65;&#x1F600;\">{text}<:child/>tail&amp;&#13;&#10;</ns:if>"
        );
        assert_eq!(
            static_value(&source),
            Value::Node {
                tag: "ns:if".into(),
                props: vec![
                    ("_x".into(), Value::String("1".into())),
                    ("xmlns:ns".into(), Value::String("urn:x".into())),
                    ("class".into(), Value::String("a-b".into())),
                    ("q".into(), Value::String("\"'&<>A😀".into())),
                ],
                children: vec![
                    Value::String(text.into()),
                    Value::Node {
                        tag: ":child".into(),
                        props: vec![],
                        children: vec![],
                    },
                    Value::String("tail&\r\n".into()),
                ],
            }
        );
        assert_eq!(parse("<a/>").unwrap(), parse("<a></a>").unwrap());
        assert_eq!(
            static_value("<p v=' \r\n\t\\{}//]]>\"'>x</p>"),
            Value::Node {
                tag: "p".into(),
                props: vec![("v".into(), Value::String(" \r\n\t\\{}//]]>\"".into()))],
                children: vec![Value::String("x".into())],
            }
        );
        let valid = "\t\n\r \u{D7FF}\u{E000}\u{FFFD}\u{10000}\u{10FFFF}";
        assert!(parse(&format!("<p>{valid}</p>")).is_ok());
    }

    #[test]
    fn markup_classes_reuse_existing_ast_and_static_semantics() {
        assert_eq!(
            parse("<a.button.primary.button class='other'>Link</a>").unwrap(),
            parse("a.button.primary.button(class=\"other\") { \"Link\" }").unwrap()
        );
        assert_eq!(
            static_value("<a.button.primary.button class='other'>Link</a>"),
            Value::Node {
                tag: "a".into(),
                props: vec![("class".into(), Value::String("button primary".into()))],
                children: vec![Value::String("Link".into())],
            }
        );
        assert_eq!(
            parse("<hr.divider />").unwrap(),
            parse("hr.divider {}").unwrap()
        );
        for (source, offset) in [
            ("<a. />", 3),
            ("<a..button />", 3),
            ("<a.1button />", 3),
            ("<a.button></a.button>", 13),
            ("<a .button />", 3),
            ("<a.button></b>", 12),
        ] {
            let diagnostic = parse(source).unwrap_err().to_string();
            assert!(
                diagnostic.contains(&format!("offset {offset} ")),
                "{source}: {diagnostic}"
            );
        }
    }

    #[test]
    fn markup_reports_precise_invalid_character_and_delimiter_offsets() {
        let cases = [
            ("<p a='x'a='y'/>", 8),
            ("<p a='x' a='y'/>", 9),
            ("<p a=word/>", 5),
            ("<p a/>", 4),
            ("<p a='<'>", 6),
            ("<p a='x", 7),
            ("<p", 2),
            ("<p>", 3),
            ("<p / >", 3),
            ("<p></P>", 5),
            ("<p></p x>", 7),
            ("<p>]]></p>", 3),
            ("<p>日&unknown;</p>", 6),
            ("<p>&amp</p>", 3),
            ("<p a='&bad;'/>", 6),
            ("<p>&#0;</p>", 3),
            ("<p>&#xD800;</p>", 3),
            ("<p>&#xFFFE;</p>", 3),
            ("<p>&#x110000;</p>", 3),
            ("<p>&#99999999999999999;</p>", 3),
            ("<p>&#+9;</p>", 3),
            ("<p>&#x;</p>", 3),
            ("<p>&#X41;</p>", 3),
            ("p(child=<x>&bad;</x>) {}", 11),
            ("<p>\u{1}</p>", 3),
            ("<p a='\u{B}'/>", 6),
            ("<p>\u{FFFF}</p>", 3),
            ("<!--comment-->", 1),
            ("<p><![CDATA[x]]></p>", 4),
            ("<p><?pi?></p>", 4),
            ("<!DOCTYPE p>", 1),
            ("<?xml version='1.0'?>", 1),
            ("<1/>", 1),
            ("<日本語/>", 1),
            ("<p(foo)/>", 2),
            ("<p a='x'/ >", 8),
        ];
        for (source, offset) in cases {
            let message = parse(source).unwrap_err().to_string();
            assert!(
                message.contains(&format!("at offset {offset} (")),
                "{source:?}: {message}"
            );
        }
        for source in ["<br>", "<a/><b/>", "<p>text < x</p>", "tag /"] {
            assert!(parse(source).is_err(), "accepted {source}");
        }
    }

    #[test]
    fn markup_tokenization_resumes_and_preserves_existing_expression_syntax() {
        for source in [
            "a<b",
            "a < b",
            "a<=b",
            "a>b",
            "a/b",
            "f(a<b)",
            "f(<p>\" ) //\n {}</p>, a<b)",
            "p(child=<x>\" )</x>) { <y/> }",
            "p(\nchild=<x>\" )</x>\n) { <y/> }",
            "p(\n) { <y/> }",
            "[<a/>, <b/>]",
            "let node = <p/>\nnode",
            "<p/>\n// comment\nq { \"old\" }",
            "if a<b { <p/> }",
        ] {
            assert!(parse(source).is_ok(), "rejected {source:?}");
        }
        let module = parse("a<b").unwrap();
        assert!(matches!(
            &module.statements[0],
            Stmt::Expression(Expr::Binary(op, _, _)) if op == "<"
        ));
        assert_eq!(static_value("let node = <p/>; node"), static_value("<p/>"));
        assert!(crate::compile("module x\nexport fn f() -> i32 { return <p/> }").is_err());
    }

    #[test]
    fn distinguishes_calls_members_nodes_and_unary_precedence() {
        let module =
            parse("heading(\"Title\")\nheading.title { \"Title\" }\n!page.visible\n5 - 2").unwrap();
        assert!(matches!(
            &module.statements[0],
            Stmt::Expression(Expr::Call(_, _))
        ));
        assert!(matches!(
            &module.statements[1],
            Stmt::Expression(Expr::Node { .. })
        ));
        assert!(
            matches!(&module.statements[2], Stmt::Expression(Expr::Unary(_, value)) if matches!(**value, Expr::Member(_, _)))
        );
        assert!(
            matches!(&module.statements[3], Stmt::Expression(Expr::Binary(op, _, _)) if op == "-")
        );
    }

    #[test]
    fn rejects_legacy_syntax_missing_delimiters_and_missing_separators() {
        for source in [
            "p#main {}",
            "p`text`",
            "p~text~",
            "$root {}",
            "= 1",
            "p[lang=\"ja\"] {}",
            "p(href=\"/\")",
            "p { \"one\" \"two\" }",
            "while x +\n1 {}",
            "if x +\n1 {}",
            "let (x = 1",
            "set (x = 2)",
            "[1,]",
            "{key: 1,}",
            "fn f(x,) {}",
            "fn f(x, x) {}",
            "let x = (1",
            "p {",
            "\"unterminated",
            "\"a\\nb\"",
            "\"a\nb\"",
            "let 123 = 1",
            "fn f() { return }",
            "for (x of xs) {}",
        ] {
            assert!(parse(source).is_err(), "accepted {source}");
        }
    }

    #[test]
    fn else_if_reuses_nested_if_and_reports_missing_delimiters() {
        assert_eq!(
            parse("if a { 1 } else_if b { 2 } else { 3 }").unwrap(),
            parse("if a { 1 } else { if b { 2 } else { 3 } }").unwrap()
        );
        let prefix = "if false {} else_if (true";
        for source in [format!("{prefix} {{}}"), format!("{prefix})")] {
            let error = parse(&source).unwrap_err().to_string();
            assert!(
                error.contains(&format!("offset {}", prefix.len() + 1)),
                "{error}"
            );
        }
    }

    #[test]
    fn reports_utf8_offsets_and_eof_delimiters() {
        let source = "p { \"日本語\" @ }";
        let message = parse(source).unwrap_err().to_string();
        assert!(message.contains("offset 16"), "{message}");
        assert!(message.contains("column 11"), "{message}");
        let message = parse("p {\n").unwrap_err().to_string();
        assert!(message.contains("offset 4 (line 2, column 1)"), "{message}");
    }

    #[test]
    fn preserves_comments_and_list_newlines_without_line_continuation() {
        assert!(parse("let title = \"hi\" // comment\np { title; \"//\" }").is_ok());
        assert!(parse("[\n1,\n2\n]\n{\nkey: 1\n}\nf(\n1,\n2\n)").is_ok());
        assert!(parse("1 +\n2").is_err());
        assert!(parse("1 2").is_err());
        assert!(parse("p {}\nq {}").is_ok());
        assert!(parse("if (false) {}\n// comment\nelse {}\np {}").is_ok());
    }

    #[test]
    fn static_retrieval_never_executes_procedural_expressions() {
        let module =
            parse("let title = \"Matra\"\narticle.card.card { h1 { title }; [1, 2]; null }")
                .unwrap();
        assert_eq!(
            evaluate_static(&module).unwrap().unwrap().to_json(),
            "{\"tag\":\"article\",\"props\":{\"class\":\"card\"},\"children\":[{\"tag\":\"h1\",\"props\":{},\"children\":[\"Matra\"]},[1,2],null]}"
        );
        for source in [
            "unknown",
            "1 + 2",
            "-1",
            "x.y",
            "f()",
            "if (true) { 1 }",
            "fn f() { return 1 }",
            "let x = 1\nx = 2",
        ] {
            assert!(
                evaluate_static(&parse(source).unwrap())
                    .unwrap_err()
                    .to_string()
                    .contains("EvaluationRequired"),
                "{source}"
            );
        }
        assert!(evaluate_static(&parse("p { let inner = 1 }\ninner").unwrap()).is_err());
    }

    #[test]
    fn static_scopes_spread_and_empty_results() {
        let source = "let x = 1\np { let x = 2; ...[x, null] }";
        assert_eq!(
            evaluate_static(&parse(source).unwrap())
                .unwrap()
                .unwrap()
                .to_json(),
            "{\"tag\":\"p\",\"props\":{},\"children\":[2,null]}"
        );
        for source in ["", "1; let x = 2"] {
            assert_eq!(
                evaluate_static(&parse(source).unwrap()).unwrap(),
                Some(Value::Null)
            );
        }
        assert!(evaluate_static(&parse("let x = 1; let x = 2").unwrap()).is_err());
    }

    #[test]
    fn lowering_rejects_profile_mismatches_and_invalid_control_flow() {
        for source in [
            "return 1",
            "break",
            "fn f(x: i32) { return x }",
            "let x: i32 = 1",
            "module x\nfn f() { return 1 }",
            "module x\nexport fn f() -> i32 { return \"text\" }",
        ] {
            assert!(crate::compile(source).is_err(), "compiled {source}");
        }
    }
}
