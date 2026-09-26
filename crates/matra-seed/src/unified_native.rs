//! 統一構文木から既存 native ABI への lowering。
use crate::unified::{Expr, Module, Stmt, Value};
use crate::{
    BinaryOperator as B, CompileError, Expression as E, Function, Parameter, Program,
    Statement as S, StructDefinition, StructField, ValueType,
};

fn unsupported(message: &str) -> CompileError {
    CompileError::new(format!("Native profile: {message}"))
}
fn value_type(name: &str) -> Result<ValueType, CompileError> {
    Ok(match name {
        "i32" => ValueType::I32,
        "bytes" => ValueType::Bytes,
        "[i32]" => ValueType::ArrayI32,
        name if !name.starts_with('[') => ValueType::Struct(name.into()),
        _ => return Err(unsupported("unsupported array type")),
    })
}
pub(crate) fn lower(module: &Module) -> Result<Program, CompileError> {
    let Some(Stmt::Module(name)) = module.statements.first() else {
        return Err(unsupported("expected module declaration"));
    };
    let mut program = Program {
        name: name.clone(),
        imports: vec![],
        structs: vec![],
        functions: vec![],
    };
    for statement in module.statements.iter().skip(1) {
        match statement {
            Stmt::Import(name) => program.imports.push(name.clone()),
            Stmt::Struct(name, fields) => program.structs.push(StructDefinition {
                name: name.clone(),
                fields: fields
                    .iter()
                    .map(|name| StructField { name: name.clone() })
                    .collect(),
            }),
            Stmt::Function {
                exported,
                name,
                parameters,
                result,
                body,
                ..
            } => {
                let parameters = parameters
                    .iter()
                    .map(|(name, ty)| {
                        Ok(Parameter {
                            name: name.clone(),
                            value_type: value_type(
                                ty.as_deref()
                                    .ok_or_else(|| unsupported("parameter type is required"))?,
                            )?,
                        })
                    })
                    .collect::<Result<_, CompileError>>()?;
                let return_type = value_type(
                    result
                        .as_deref()
                        .ok_or_else(|| unsupported("return type is required"))?,
                )?;
                let statements = statements(body)?;
                if !crate::always_returns(&statements) {
                    return Err(unsupported(&format!(
                        "Function '{name}' must end with return"
                    )));
                }
                program.functions.push(Function {
                    exported: *exported,
                    name: name.clone(),
                    parameters,
                    return_type,
                    statements,
                });
            }
            _ => return Err(unsupported("expected import, struct, or typed function")),
        }
    }
    if program.functions.is_empty() {
        return Err(unsupported("at least one function is required"));
    }
    Ok(program)
}
fn statements(body: &[Stmt]) -> Result<Vec<S>, CompileError> {
    body.iter()
        .map(|statement| {
            Ok(match statement {
                Stmt::Let(name, ty, value) => S::Let(
                    name.clone(),
                    ty.as_deref().map(value_type).transpose()?,
                    expression(value)?,
                ),
                Stmt::Assign(name, value) => S::Assign(name.clone(), expression(value)?),
                Stmt::Return(value) => S::Return(expression(value)?),
                Stmt::Expression(Expr::If(test, yes, no)) => {
                    S::If(expression(test)?, statements(yes)?, statements(no)?)
                }
                Stmt::Expression(Expr::While(test, body)) => {
                    S::While(expression(test)?, statements(body)?)
                }
                Stmt::Expression(Expr::DoUntil(body, test)) => {
                    S::DoUntil(statements(body)?, expression(test)?)
                }
                Stmt::Break => S::Break,
                Stmt::Expression(Expr::Call(callee, args)) if args.len() == 3 => {
                    let Expr::Reference(name) = callee.as_ref() else {
                        return Err(unsupported("expected memory intrinsic"));
                    };
                    let a = expression(&args[0])?;
                    let b = expression(&args[1])?;
                    let c = expression(&args[2])?;
                    match name.as_str() {
                        "byte_set" => S::ByteSet(a, b, c),
                        "array_set" => S::ArraySet(a, b, c),
                        _ => return Err(unsupported("unsupported expression statement")),
                    }
                }
                _ => return Err(unsupported("unsupported statement")),
            })
        })
        .collect()
}
fn expression(value: &Expr) -> Result<E, CompileError> {
    Ok(match value {
        Expr::Literal(Value::Number(n))
            if n.fract() == 0.0 && *n >= i32::MIN as f64 && *n <= i32::MAX as f64 =>
        {
            E::Integer(*n as i32)
        }
        Expr::Reference(name) => E::Variable(name.clone()),
        Expr::Member(value, name) => E::FieldAccess(Box::new(expression(value)?), name.clone()),
        Expr::Call(callee, args) => {
            let Expr::Reference(name) = callee.as_ref() else {
                return Err(unsupported("only named calls are supported"));
            };
            E::Call(
                name.clone(),
                args.iter().map(expression).collect::<Result<_, _>>()?,
            )
        }
        Expr::Unary(op, value) if op == "-" => {
            if **value == Expr::Literal(Value::Number(2147483648.0)) {
                E::Integer(i32::MIN)
            } else {
                E::Negate(Box::new(expression(value)?))
            }
        }
        Expr::Binary(op, left, right) => {
            let op = match op.as_str() {
                "+" => B::Add,
                "-" => B::Subtract,
                "*" => B::Multiply,
                "/" => B::Divide,
                "==" => B::Equal,
                "!=" => B::NotEqual,
                "<" => B::LessThan,
                "<=" => B::LessThanOrEqual,
                ">" => B::GreaterThan,
                ">=" => B::GreaterThanOrEqual,
                _ => return Err(unsupported("unsupported operator")),
            };
            E::Binary(
                op,
                Box::new(expression(left)?),
                Box::new(expression(right)?),
            )
        }
        _ => {
            return Err(unsupported(
                "expected an i32, bytes, array, or struct expression",
            ));
        }
    })
}
