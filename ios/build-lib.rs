#!/usr/bin/env rust

use anyhow::Result;
use shared::config;
use shared::run::run;

fn main() -> Result<()> {
    let config = config::read()?;

    // A host CFLAGS leaks into the iOS cross build and breaks the C parts.
    unsafe {
        std::env::remove_var("CFLAGS");
        std::env::remove_var("CXXFLAGS");
    }

    run("rustup target add aarch64-apple-ios x86_64-apple-ios")?;
    run("cargo install cargo-lipo")?;
    run(&format!("cargo lipo -p {} --release", config.app_name))?;
    Ok(())
}
