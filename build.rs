#!/usr/bin/env rust

use anyhow::Result;
use shared::config;
use shared::run::{probe, run};

fn main() -> Result<()> {
    let config = config::read()?;

    let args = std::env::args().skip(1).collect::<Vec<_>>().join(" ");
    let args = args.to_lowercase();
    let ios = args.contains("ios");
    let android = args.contains("android");

    println!("APP_NAME: {}", config.app_name);
    println!("PROJECT_NAME: {}", config.project_name);

    // The android build always runs inside docker, locally and in CI, so the
    // host needs no Android tooling. The env var marks being inside already.
    if android && std::env::var("TEST_ENGINE_ANDROID_DOCKER_BUILD").is_err() {
        run("rust ./build/in_docker_android.rs")?;
        return Ok(());
    }

    let is_mac = cfg!(target_os = "macos");
    let is_linux = cfg!(target_os = "linux");
    let unix = is_mac || is_linux;

    let uname = if unix {
        probe("uname -a").to_lowercase()
    } else {
        String::new()
    };
    let release = if is_linux {
        std::fs::read_to_string("/etc/os-release")
            .unwrap_or_default()
            .to_lowercase()
    } else {
        String::new()
    };

    println!("uname: {uname}");
    println!("system: {}", std::env::consts::OS);
    println!("arch: {}", std::env::consts::ARCH);

    if android {
        return build_android();
    }

    if is_linux {
        println!("Lin setup");
        install_linux_deps(&release, &uname)?;
    }

    if unix {
        println!("Installing rustup:");
        run("curl https://sh.rustup.rs -sSf | sh -s -- -y")?;
        let home = std::env::var("HOME").unwrap_or_default();
        let path = std::env::var("PATH").unwrap_or_default();
        unsafe {
            std::env::set_var("PATH", format!("{home}/.cargo/bin:{path}"));
        }
    }

    if ios {
        run("rust ./build/ios/build-project.rs")?;
    } else {
        run("cargo build --all --profile=ci")?;
        run("cargo test --all --profile=ci")?;
    }
    Ok(())
}

fn build_android() -> Result<()> {
    run("rustup toolchain install")?;
    run(
        "rustup target add armv7-linux-androideabi aarch64-linux-android \
i686-linux-android x86_64-linux-android",
    )?;

    run("cargo install test-mobile --locked")?;
    run("test-mobile")?;

    std::env::set_current_dir("mobile/android")?;
    run("chmod +x ./gradlew")?;
    run("./gradlew build")?;
    Ok(())
}

/// Amazon Linux is checked before Fedora on purpose. Its os-release carries
/// ID_LIKE="fedora", so testing Fedora first sends it down the dnf branch and
/// the yum packages it actually needs are never installed.
fn install_linux_deps(release: &str, uname: &str) -> Result<()> {
    let is_arch = std::path::Path::new("/etc/arch-release").exists();

    if release.contains("amazon") {
        println!("Amazon");
        run("sudo yum install -y gcc gcc-c++ alsa-lib-devel")?;
    } else if release.contains("fedora") {
        println!("Fedora");
        run(
            "sudo dnf install -y libXcursor-devel libXi-devel libXinerama-devel \
libXrandr-devel perl make cmake automake gcc gcc-c++ kernel-devel alsa-lib-devel-*",
        )?;
    } else if uname.contains("freebsd") {
        println!("Freebsd");
        run("sudo pkg update")?;
        run("sudo pkg install cmake xorg pkgconf alsa-utils")?;
    } else if is_arch {
        println!("Arch");
        run("sudo pacman -S gcc pkg-config cmake openssl make alsa-lib alsa-utils --noconfirm")?;
    } else if release.contains("ubuntu") || release.contains("debian") {
        println!("Debian");
        let mut deps = "cmake mesa-common-dev libgl1-mesa-dev libglu1-mesa-dev \
xorg-dev libasound2-dev pkg-config libssl-dev"
            .to_string();
        if std::env::consts::ARCH != "aarch64" {
            deps.push_str(" build-essential");
        }
        run("sudo apt update")?;
        run(&format!("sudo apt -y install {deps}"))?;
    } else if release.contains("opensuse") {
        println!("openSUSE");
        run("sudo zypper refresh")?;
        run("sudo zypper update")?;
        run("sudo zypper install -y --type pattern devel_basis")?;
        run("sudo zypper install -y --type pattern devel_C_C++")?;
        run("sudo zypper install -y alsa-lib llvm llvm-devel clang")?;
    } else {
        println!("Unknown distro");
        std::process::exit(1);
    }
    Ok(())
}
