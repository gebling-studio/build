#!/usr/bin/env rust

use std::process::Command;

use anyhow::{Result, bail};

// Pinned so a container build is reproducible. Bump deliberately.
const RUSTSCRIPT_VERSION: &str = "v0.1.4";

fn main() -> Result<()> {
    let Some(image) = std::env::args().nth(1) else {
        println!("Usage: in_docker.rs <image>");
        std::process::exit(1);
    };

    let host_dir = match std::env::var("HOST_DIR") {
        Ok(dir) => dir,
        Err(_) => std::env::current_dir()?.display().to_string(),
    };

    println!("Running in docker: {image}");

    let mount = format!("type=bind,source={host_dir},target=/host");
    let status = Command::new("docker")
        .args([
            "run",
            "--rm",
            "--mount",
            &mount,
            "--cap-add=SYS_PTRACE",
            "--security-opt",
            "seccomp=unconfined",
            "-e",
            "SKIP_UI_TESTS",
            "-t",
            &image,
            "/bin/bash",
            "-c",
            &bootstrap("rust ./build/build.rs"),
        ])
        .status()?;

    if !status.success() {
        bail!("docker run {image} failed");
    }
    Ok(())
}

/// A fresh container has no interpreter, so the command installs one first. The
/// linux builds are static musl, so one binary runs on every distro in the
/// matrix with no toolchain and no package of its own.
fn bootstrap(build_command: &str) -> String {
    format!(
        r#"
set -eo pipefail
cd /host
if command -v apt > /dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt update
    apt install -y curl tar sudo git
elif command -v pacman > /dev/null; then
    pacman -Sy curl tar sudo git --noconfirm
elif command -v dnf > /dev/null; then
    dnf install -y curl tar sudo git
elif command -v yum > /dev/null; then
    yum install -y curl tar sudo git
elif command -v zypper > /dev/null; then
    zypper install -y curl tar sudo git
fi
git config --global --add safe.directory '*'
case "$(uname -m)" in
    x86_64) TRIPLE=x86_64-unknown-linux-musl ;;
    aarch64|arm64) TRIPLE=aarch64-unknown-linux-musl ;;
    *) echo "unsupported arch $(uname -m)"; exit 1 ;;
esac
VERSION={RUSTSCRIPT_VERSION}
URL="https://github.com/VladasZ/rustscript/releases/download/$VERSION/rust-$VERSION-$TRIPLE.tar.gz"
curl -fsSL "$URL" -o /tmp/rustscript.tar.gz
tar xzf /tmp/rustscript.tar.gz -C /usr/local/bin
{build_command}
"#
    )
}
