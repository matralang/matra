use std::{env, fs, process};

fn main() {
    let mut arguments = env::args().skip(1);
    let Some(input) = arguments.next() else {
        usage();
    };
    let Some(output) = arguments.next() else {
        usage();
    };
    let entry = match arguments.next().as_deref() {
        Some("--entry") => arguments.next(),
        Some(option) => fail(format!("Unknown option: {option}")),
        None => None,
    };
    if arguments.next().is_some() {
        usage();
    }

    let markdown = fs::read_to_string(&input)
        .unwrap_or_else(|error| fail(format!("Could not read {input}: {error}")));
    let wasm = matra_seed::compile_markdown(&markdown, entry.as_deref())
        .unwrap_or_else(|error| fail(error.to_string()));
    fs::write(&output, wasm)
        .unwrap_or_else(|error| fail(format!("Could not write {output}: {error}")));
}

fn usage() -> ! {
    fail("Usage: matra-seed INPUT.md OUTPUT.wasm [--entry NAME]".to_owned())
}

fn fail(message: String) -> ! {
    eprintln!("matra-seed: {message}");
    process::exit(1)
}
