#!/usr/bin/env rust

use anyhow::Result;
use shared::config;
use shared::run::run;

fn main() -> Result<()> {
    let config = config::read()?;

    // Which cargo profile to build for profiling. "dev" gives the fastest build
    // and the worst numbers, "release-debug" keeps optimizations and the symbols
    // samply needs.
    let profile = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "release-debug".to_string());

    println!("APP_NAME: {}", config.app_name);
    println!("profile: {profile}");

    run("cargo install --locked samply")?;
    run(&format!(
        "cargo build -p \"{}\" --profile=\"{profile}\"",
        config.app_name
    ))?;

    let target_dir = if profile == "dev" { "debug" } else { &profile };

    run(&format!(
        "samply record ./target/{target_dir}/{}",
        config.app_name
    ))?;
    Ok(())
}
