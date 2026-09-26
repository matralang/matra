//! 文書値は host handle とし、制御フローと関数本体を Wasm に生成する。
use crate::unified::{Expr, Module, Stmt, Value};
use crate::{CompileError, encode_i32, encode_name, encode_u32, section};

pub(crate) const HELPERS: &[(&str, u32)] = &[
    ("literal", 2),
    ("scope", 1),
    ("bind", 3),
    ("assign", 3),
    ("get", 2),
    ("array", 0),
    ("push", 2),
    ("object", 0),
    ("property", 3),
    ("member", 2),
    ("unary", 2),
    ("binary", 3),
    ("truthy", 1),
    ("function", 2),
    ("call", 2),
    ("node", 3),
    ("length", 1),
    ("item", 2),
    ("spread", 2),
];
fn fail(message: &str) -> CompileError {
    CompileError::new(format!("Host value profile: {message}"))
}

pub(crate) fn compile(module: &Module) -> Result<Vec<u8>, CompileError> {
    let mut functions = Vec::new();
    gather_statements(&module.statements, &mut functions);
    functions.sort_by_key(|statement| {
        if let Stmt::Function { id, .. } = statement {
            *id
        } else {
            unreachable!()
        }
    });
    let mut data = Vec::new();
    let mut bodies = Vec::new();
    // 全関数を (captured_scope, arguments) -> value に揃える。
    for statement in &functions {
        let Stmt::Function {
            parameters,
            result,
            exported,
            body,
            ..
        } = statement
        else {
            unreachable!()
        };
        if *exported || result.is_some() || parameters.iter().any(|(_, ty)| ty.is_some()) {
            return Err(fail(
                "typed/exported functions require a module declaration",
            ));
        }
        let mut writer = Writer::new(&mut data, 2, true);
        writer.get(0);
        writer.call("scope");
        writer.set(writer.env);
        for (index, (name, _)) in parameters.iter().enumerate() {
            writer.get(writer.env);
            writer.string(name);
            writer.get(1);
            writer.constant(index as i32);
            writer.call("item");
            writer.call("bind");
            writer.drop();
        }
        writer.statements(body, None)?;
        bodies.push(writer.finish());
    }
    let mut writer = Writer::new(&mut data, 0, false);
    writer.constant(0);
    writer.call("scope");
    writer.set(writer.env);
    writer.statements(&module.statements, None)?;
    bodies.push(writer.finish());

    let mut output = b"\0asm\x01\0\0\0".to_vec();
    // 引数数 0..3 ごとに型を用意する。すべて i32 -> i32。
    let mut types = vec![4];
    for count in 0..=3 {
        types.push(0x60);
        types.push(count);
        types.extend(std::iter::repeat_n(0x7f, count as usize));
        types.extend([1, 0x7f]);
    }
    section(&mut output, 1, &types);
    let mut imports = Vec::new();
    encode_u32(&mut imports, HELPERS.len() as u32);
    for (name, count) in HELPERS {
        encode_name(&mut imports, "matra");
        encode_name(&mut imports, name);
        imports.push(0);
        encode_u32(&mut imports, *count);
    }
    section(&mut output, 2, &imports);
    let mut declarations = Vec::new();
    encode_u32(&mut declarations, bodies.len() as u32);
    declarations.extend(std::iter::repeat_n(2, functions.len()));
    declarations.push(0);
    section(&mut output, 3, &declarations);
    let mut table = vec![1, 0x70, 0];
    encode_u32(&mut table, functions.len() as u32);
    section(&mut output, 4, &table);
    let mut memory = vec![1, 0];
    encode_u32(&mut memory, ((data.len() + 65535) / 65536).max(1) as u32);
    section(&mut output, 5, &memory);
    let mut exports = vec![3];
    encode_name(&mut exports, "memory");
    exports.extend([2, 0]);
    encode_name(&mut exports, "__functions");
    exports.extend([1, 0]);
    encode_name(&mut exports, "run");
    exports.push(0);
    encode_u32(&mut exports, (HELPERS.len() + functions.len()) as u32);
    section(&mut output, 7, &exports);
    let mut elements = vec![1, 0, 0x41, 0, 0x0b];
    encode_u32(&mut elements, functions.len() as u32);
    for index in 0..functions.len() {
        encode_u32(&mut elements, (HELPERS.len() + index) as u32);
    }
    section(&mut output, 9, &elements);
    let mut code = Vec::new();
    encode_u32(&mut code, bodies.len() as u32);
    for body in bodies {
        encode_u32(&mut code, body.len() as u32);
        code.extend(body);
    }
    section(&mut output, 10, &code);
    let mut segment = vec![1, 0, 0x41, 0, 0x0b];
    encode_u32(&mut segment, data.len() as u32);
    segment.extend(data);
    section(&mut output, 11, &segment);
    Ok(output)
}

fn gather_statements<'a>(statements: &'a [Stmt], functions: &mut Vec<&'a Stmt>) {
    for statement in statements {
        match statement {
            Stmt::Function { body, .. } => {
                functions.push(statement);
                gather_statements(body, functions);
            }
            Stmt::Expression(value)
            | Stmt::Spread(value)
            | Stmt::Let(_, _, value)
            | Stmt::Assign(_, value)
            | Stmt::Return(value) => gather_expr(value, functions),
            _ => (),
        }
    }
}
fn gather_expr<'a>(expr: &'a Expr, functions: &mut Vec<&'a Stmt>) {
    match expr {
        Expr::If(test, yes, no) => {
            gather_expr(test, functions);
            gather_statements(yes, functions);
            gather_statements(no, functions);
        }
        Expr::For(_, test, body) | Expr::While(test, body) => {
            gather_expr(test, functions);
            gather_statements(body, functions);
        }
        Expr::DoUntil(body, test) => {
            gather_statements(body, functions);
            gather_expr(test, functions);
        }
        Expr::Node {
            attributes, body, ..
        } => {
            for (_, value) in attributes {
                gather_expr(value, functions);
            }
            gather_statements(body, functions);
        }
        Expr::Array(items) => {
            for item in items {
                gather_expr(item, functions);
            }
        }
        Expr::Object(items) => {
            for (_, item) in items {
                gather_expr(item, functions);
            }
        }
        Expr::Member(value, _) | Expr::Unary(_, value) => gather_expr(value, functions),
        Expr::Call(value, args) => {
            gather_expr(value, functions);
            for arg in args {
                gather_expr(arg, functions);
            }
        }
        Expr::Binary(_, left, right) => {
            gather_expr(left, functions);
            gather_expr(right, functions);
        }
        _ => (),
    }
}

struct Writer<'a> {
    code: Vec<u8>,
    data: &'a mut Vec<u8>,
    locals: u32,
    parameters: u32,
    env: u32,
    last: u32,
    in_function: bool,
    frames: Vec<bool>,
}
impl<'a> Writer<'a> {
    fn new(data: &'a mut Vec<u8>, parameters: u32, in_function: bool) -> Self {
        Self {
            code: vec![],
            data,
            locals: parameters + 2,
            parameters,
            env: parameters,
            last: parameters + 1,
            in_function,
            frames: vec![],
        }
    }
    fn local(&mut self) -> u32 {
        let index = self.locals;
        self.locals += 1;
        index
    }
    fn get(&mut self, index: u32) {
        self.code.push(0x20);
        encode_u32(&mut self.code, index);
    }
    fn set(&mut self, index: u32) {
        self.code.push(0x21);
        encode_u32(&mut self.code, index);
    }
    fn tee(&mut self, index: u32) {
        self.code.push(0x22);
        encode_u32(&mut self.code, index);
    }
    fn constant(&mut self, value: i32) {
        self.code.push(0x41);
        encode_i32(&mut self.code, value);
    }
    fn call(&mut self, name: &str) {
        self.code.push(0x10);
        encode_u32(
            &mut self.code,
            HELPERS.iter().position(|(n, _)| *n == name).unwrap() as u32,
        );
    }
    fn drop(&mut self) {
        self.code.push(0x1a);
    }
    fn start(&mut self, opcode: u8, result: u8, break_target: bool) {
        self.code.extend([opcode, result]);
        self.frames.push(break_target);
    }
    fn end(&mut self) {
        self.code.push(0x0b);
        self.frames.pop();
    }
    fn branch(&mut self, opcode: u8, depth: u32) {
        self.code.push(opcode);
        encode_u32(&mut self.code, depth);
    }
    fn literal(&mut self, value: &Value) {
        let json = value.to_json();
        let offset = self.data.len();
        self.data.extend(json.as_bytes());
        self.constant(offset as i32);
        self.constant(json.len() as i32);
        self.call("literal");
    }
    fn string(&mut self, value: &str) {
        self.literal(&Value::String(value.into()));
    }
    fn finish(mut self) -> Vec<u8> {
        self.get(self.last);
        self.code.push(0x0b);
        let mut body = vec![1];
        encode_u32(&mut body, self.locals - self.parameters);
        body.push(0x7f);
        body.extend(self.code);
        body
    }
    fn scoped(&mut self, body: &[Stmt], children: Option<u32>) -> Result<(), CompileError> {
        let outer = self.env;
        let scope = self.local();
        self.get(outer);
        self.call("scope");
        self.set(scope);
        self.env = scope;
        self.statements(body, children)?;
        self.env = outer;
        Ok(())
    }
    fn statements(
        &mut self,
        statements: &[Stmt],
        children: Option<u32>,
    ) -> Result<(), CompileError> {
        self.literal(&Value::Null);
        self.set(self.last);
        for statement in statements {
            self.literal(&Value::Null);
            self.set(self.last);
            match statement {
                Stmt::Expression(value) => {
                    self.expression(value)?;
                    self.set(self.last);
                    if let Some(children) = children {
                        self.get(children);
                        self.get(self.last);
                        self.call("push");
                        self.drop();
                    }
                }
                Stmt::Spread(value) => {
                    let children =
                        children.ok_or_else(|| fail("Spread is only allowed in a node body"))?;
                    self.get(children);
                    self.expression(value)?;
                    self.call("spread");
                    self.drop();
                    self.literal(&Value::Null);
                    self.set(self.last);
                }
                Stmt::Let(name, ty, value) => {
                    if ty.is_some() {
                        return Err(fail("type annotations require a module declaration"));
                    }
                    self.get(self.env);
                    self.string(name);
                    self.expression(value)?;
                    self.call("bind");
                    self.drop();
                    self.literal(&Value::Null);
                    self.set(self.last);
                }
                Stmt::Assign(name, value) => {
                    self.get(self.env);
                    self.string(name);
                    self.expression(value)?;
                    self.call("assign");
                    self.drop();
                    self.literal(&Value::Null);
                    self.set(self.last);
                }
                Stmt::Function { id, name, .. } => {
                    self.get(self.env);
                    self.string(name);
                    self.constant(*id as i32);
                    self.get(self.env);
                    self.call("function");
                    self.call("bind");
                    self.drop();
                    self.literal(&Value::Null);
                    self.set(self.last);
                }
                Stmt::Return(value) => {
                    if !self.in_function {
                        return Err(fail("return outside a function"));
                    }
                    self.expression(value)?;
                    self.code.push(0x0f);
                }
                Stmt::Break => {
                    let depth = self
                        .frames
                        .iter()
                        .rev()
                        .position(|v| *v)
                        .ok_or_else(|| fail("break outside a loop"))?;
                    self.branch(0x0c, depth as u32);
                }
                _ => {
                    return Err(fail(
                        "module/import/struct declarations require the native profile",
                    ));
                }
            }
        }
        Ok(())
    }
    fn array(&mut self, items: &[Expr]) -> Result<(), CompileError> {
        self.call("array");
        for item in items {
            self.expression(item)?;
            self.call("push");
        }
        Ok(())
    }
    fn object(&mut self, items: &[(String, Expr)]) -> Result<(), CompileError> {
        self.call("object");
        for (key, value) in items {
            self.string(key);
            self.expression(value)?;
            self.call("property");
        }
        Ok(())
    }
    fn expression(&mut self, expression: &Expr) -> Result<(), CompileError> {
        match expression {
            Expr::If(test, yes, no) => {
                self.expression(test)?;
                self.call("truthy");
                self.start(0x04, 0x40, false);
                self.scoped(yes, None)?;
                self.code.push(0x05);
                self.scoped(no, None)?;
                self.end();
                self.get(self.last);
            }
            Expr::While(test, body) => {
                self.start(0x02, 0x40, true);
                self.start(0x03, 0x40, false);
                self.expression(test)?;
                self.call("truthy");
                self.code.push(0x45);
                self.branch(0x0d, 1);
                self.scoped(body, None)?;
                self.branch(0x0c, 0);
                self.end();
                self.end();
                self.literal(&Value::Null);
            }
            Expr::DoUntil(body, test) => {
                self.start(0x02, 0x40, true);
                self.start(0x03, 0x40, false);
                self.scoped(body, None)?;
                self.expression(test)?;
                self.call("truthy");
                self.code.push(0x45);
                self.branch(0x0d, 0);
                self.end();
                self.end();
                self.literal(&Value::Null);
            }
            Expr::For(name, iterable, body) => {
                let results = self.local();
                self.call("array");
                self.set(results);
                let values = self.local();
                let index = self.local();
                let length = self.local();
                self.expression(iterable)?;
                self.tee(values);
                self.call("length");
                self.set(length);
                self.constant(0);
                self.set(index);
                self.start(0x02, 0x40, true);
                self.start(0x03, 0x40, false);
                self.get(index);
                self.get(length);
                self.code.push(0x4f);
                self.branch(0x0d, 1);
                let outer = self.env;
                let scope = self.local();
                self.get(outer);
                self.call("scope");
                self.tee(scope);
                self.string(name);
                self.get(values);
                self.get(index);
                self.call("item");
                self.call("bind");
                self.drop();
                self.env = scope;
                self.statements(body, None)?;
                self.get(results);
                self.get(self.last);
                self.call("push");
                self.drop();
                self.env = outer;
                self.get(index);
                self.constant(1);
                self.code.push(0x6a);
                self.set(index);
                self.branch(0x0c, 0);
                self.end();
                self.end();
                self.get(results);
            }
            Expr::Literal(value) => self.literal(value),
            Expr::Reference(name) => {
                self.get(self.env);
                self.string(name);
                self.call("get");
            }
            Expr::Array(items) => self.array(items)?,
            Expr::Object(items) => self.object(items)?,
            Expr::Member(value, name) => {
                self.expression(value)?;
                self.string(name);
                self.call("member");
            }
            Expr::Call(callee, arguments) => {
                self.expression(callee)?;
                self.array(arguments)?;
                self.call("call");
            }
            Expr::Unary(op, value) => {
                self.string(op);
                self.expression(value)?;
                self.call("unary");
            }
            Expr::Binary(op, left, right) if op == "&&" || op == "||" => {
                let value = self.local();
                self.expression(left)?;
                self.tee(value);
                self.call("truthy");
                self.start(0x04, 0x7f, false);
                if op == "&&" {
                    self.expression(right)?;
                } else {
                    self.get(value);
                }
                self.code.push(0x05);
                if op == "&&" {
                    self.get(value);
                } else {
                    self.expression(right)?;
                }
                self.end();
            }
            Expr::Binary(op, left, right) => {
                self.string(op);
                self.expression(left)?;
                self.expression(right)?;
                self.call("binary");
            }
            Expr::Node {
                tag,
                classes,
                attributes,
                body,
            } => {
                // node 内の式で function の最終値を上書きしないように保存する。
                let saved = self.local();
                self.get(self.last);
                self.set(saved);
                let props = self.local();
                self.object(attributes)?;
                if !classes.is_empty() {
                    self.string("class");
                    self.string(&classes.join(" "));
                    self.call("property");
                }
                self.set(props);
                let children = self.local();
                self.call("array");
                self.set(children);
                self.scoped(body, Some(children))?;
                self.get(saved);
                self.set(self.last);
                self.string(tag);
                self.get(props);
                self.get(children);
                self.call("node");
            }
        }
        Ok(())
    }
}
