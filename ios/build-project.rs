#!/usr/bin/env rust

use anyhow::Result;
use shared::config;
use shared::run::run;

fn main() -> Result<()> {
    let config = config::read()?;

    run("rust ./build/ios/build-lib.rs")?;

    unsafe {
        std::env::remove_var("CFLAGS");
        std::env::remove_var("CXXFLAGS");
    }

    run("cargo install test-mobile --locked")?;

    let args: Vec<String> = std::env::args().skip(1).collect();
    run(format!("test-mobile {}", args.join(" ")).trim())?;

    std::env::set_current_dir("mobile/iOS")?;

    run("xcodebuild -showsdks")?;

    // An explicit destination fails with a clear "iOS is not installed" message
    // when the platform is missing. The -sdk flag instead falls back to a Mac
    // Catalyst destination and dies at link time with an arch mismatch.
    run(&format!(
        "xcodebuild -scheme {} -destination \"generic/platform=iOS Simulator\" build",
        config.project_name
    ))?;
    Ok(())
}
