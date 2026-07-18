#!/usr/bin/env rust

use anyhow::Result;
use shared::run::{run, run_allow_fail};

fn main() -> Result<()> {
    if cfg!(target_os = "macos") {
        return Ok(());
    }

    run("sudo df -h")?;

    // RustScript is installed in the runner tool cache and must survive this step.
    let paths = vec![
        "/usr/share/dotnet".to_string(),
        "/opt/ghc".to_string(),
        "/usr/local/share/boost".to_string(),
        "/usr/local/lib/android".to_string(),
        "/__t/CodeQL".to_string(),
    ];

    for path in &paths {
        run_allow_fail(&format!("sudo rm -rf \"{path}\""));
    }

    run("sudo df -h")?;
    Ok(())
}
