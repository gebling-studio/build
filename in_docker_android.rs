#!/usr/bin/env rust

use std::process::Command;

use anyhow::{Result, bail};
use shared::config;

fn main() -> Result<()> {
    let config = config::read()?;

    // Named after the app, so two test-engine apps on one machine do not share
    // an image or fight over each other's caches.
    let image = format!("{}-android", config.app_name);

    // Named volumes keep the Rust toolchain, cargo registry and gradle caches
    // across runs, so only the first build downloads them. The volumes seed
    // themselves from the image content on first use, which is how the rustup
    // binary from the image survives the mount.
    let volumes = [
        format!("{image}-rustup:/usr/local/rustup"),
        format!("{image}-cargo:/usr/local/cargo"),
        format!("{image}-gradle:/root/.gradle"),
    ];

    docker(&[
        "build",
        "--platform",
        "linux/amd64",
        "-t",
        &image,
        "./build/android",
    ])?;

    let host_dir = std::env::current_dir()?.display().to_string();
    let mount = format!("type=bind,source={host_dir},target=/host");

    let mut args = vec![
        "run",
        "--rm",
        "-t",
        "--platform",
        "linux/amd64",
        "--mount",
        &mount,
    ];
    for volume in &volumes {
        args.push("-v");
        args.push(volume);
    }
    args.extend([
        "-w",
        "/host",
        "-e",
        "TEST_ENGINE_ANDROID_DOCKER_BUILD=true",
        // Release rustc under Rosetta eats gigabytes per job. Uncapped jobs OOM
        // the whole container on a default Docker Desktop VM, which dies
        // silently mid build with no error from cargo or gradle.
        "-e",
        "CARGO_BUILD_JOBS=4",
        &image,
        "/bin/bash",
        "-c",
        "rust ./build/build.rs android",
    ]);

    docker(&args)
}

fn docker(args: &[&str]) -> Result<()> {
    println!("docker {}", args.join(" "));
    let status = Command::new("docker").args(args).status()?;
    if !status.success() {
        bail!("docker {} failed", args.join(" "));
    }
    Ok(())
}
