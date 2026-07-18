#!/usr/bin/env rust

// Runs the whole UI suite on an iOS simulator and exits non zero on any failure.
//
// The oldest iPhone this toolchain can boot is the iPhone 8 on iOS 16.4. Older
// devices cap at iOS 15, which no simulator runtime supports on this macOS, and
// the simulator renders on the host GPU so an even older chip would prove nothing
// the render pipeline does not already show here.
//
// The app is x86_64 only for the simulator. The project excludes arm64 there, so
// it runs under Rosetta, and building the scheme instead falls back to Mac
// Catalyst arm64 and fails to link. So this builds the target against the
// iphonesimulator SDK directly with ARCHS=x86_64.
//
// Tests are triggered by TE_RUN_TESTS, not the inspector. The app runs the suite
// on a worker task, prints a result marker and exits, so there is no mDNS to
// disambiguate against the desktop lane running at the same time.
//
// Output is quiet on purpose. This runs in parallel with the desktop lane under
// make ui, so only [ios] milestones and failures are printed, to keep the two
// streams from mangling each other. A failed command dumps its captured output.

use anyhow::{Result, bail};
use regex::Regex;
use shared::config;
use shared::run::{probe, run_quiet};

const DEVICE_NAME: &str = "te-iPhone8-16.4";
const DEVICE_TYPE: &str = "com.apple.CoreSimulator.SimDeviceType.iPhone-8";
const RUNTIME: &str = "com.apple.CoreSimulator.SimRuntime.iOS-16-4";
const RUNTIME_HINT: &str = "iOS 16.4";

// A separate cargo target dir so this build never blocks on the desktop lane's
// target lock, which is what lets the two lanes truly run in parallel. It sits
// under target so the existing ignore of target contents already covers it.
const IOS_TARGET_DIR: &str = "target/ios";
const SIM_TRIPLE: &str = "x86_64-apple-ios";

fn step(message: &str) {
    println!("\n[ios] {message}");
}

fn main() -> Result<()> {
    if !cfg!(target_os = "macos") {
        println!("[ios] not macOS, skipping the iOS simulator lane.");
        return Ok(());
    }

    let config = config::read()?;

    let lib = format!("{IOS_TARGET_DIR}/{SIM_TRIPLE}/release/{}", config.lib_name);
    let linked_lib = format!("target/universal/release/{}", config.lib_name);
    let symroot = format!(
        "{}/{IOS_TARGET_DIR}/sim-build",
        std::env::current_dir()?.display()
    );
    let app = format!("{symroot}/Release-iphonesimulator/{}.app", config.project_name);
    let xcodeproj = format!("mobile/iOS/{}.xcodeproj", config.project_name);

    step("adding the iOS simulator rust target");
    run_quiet(&format!("rustup target add {SIM_TRIPLE}"))?;

    // --lib only. The bin target fails to link on iOS, it needs a symbol the
    // UIKit shell provides, and only the staticlib is wanted here. Release, so
    // the suite runs at real speed. The Xcode project links the lib from
    // target/universal/release.
    step("building the engine for iOS, this takes a while");
    run_quiet(&format!(
        "env CARGO_TARGET_DIR={IOS_TARGET_DIR} IPHONEOS_DEPLOYMENT_TARGET=12.0 \
cargo build -p {} --lib --target {SIM_TRIPLE} --release",
        config.app_name
    ))?;
    run_quiet(&format!(
        "mkdir -p target/universal/release && cp {lib} {linked_lib}"
    ))?;

    // The generated project is gitignored, so regenerate it only when it is
    // missing, not on every run. Regenerating wipes the device only weak
    // framework flags.
    if !std::path::Path::new(&xcodeproj).exists() {
        run_quiet("cargo install test-mobile --locked")?;
        run_quiet("test-mobile")?;
    }

    step("building the simulator app");
    run_quiet(&format!(
        "xcodebuild -project {xcodeproj} -target {} -configuration Release \
-sdk iphonesimulator ARCHS=x86_64 VALID_ARCHS=x86_64 ONLY_ACTIVE_ARCH=NO \
SYMROOT={symroot} build",
        config.project_name
    ))?;

    let device = ensure_device()?;

    step(&format!("booting {DEVICE_NAME}"));
    run_quiet(&format!("xcrun simctl boot {device} || true"))?;
    run_quiet("open -a Simulator")?;
    run_quiet(&format!("xcrun simctl bootstatus {device}"))?;
    run_quiet(&format!("xcrun simctl install {device} \"{app}\""))?;

    // TE_RUN_TESTS makes the app run the suite and exit. --console streams its
    // stdout here, so the result marker arrives before the launch returns.
    step("running the UI suite on the simulator");
    let output = probe(&format!(
        "SIMCTL_CHILD_TE_RUN_TESTS=1 xcrun simctl launch --console \
--terminate-running-process {device} {} 2>&1",
        config.bundle_id
    ));

    run_quiet(&format!("xcrun simctl shutdown {device} || true"))?;
    probe("osascript -e 'tell application \"Simulator\" to quit'");

    let marker = Regex::new(r"TE_TEST_RESULT (\d+) tests, (\d+) failed")?;
    let Some(caps) = marker.captures(&output) else {
        eprintln!("{output}");
        bail!("[ios] sim run produced no result marker. See the launch output above.");
    };

    let total: i64 = caps[1].parse()?;
    let failed: i64 = caps[2].parse()?;

    if failed != 0 {
        eprintln!("{output}");
        step(&format!("FAILED: {total} tests, {failed} failed"));
        std::process::exit(1);
    }

    step(&format!("ok: {total} tests, 0 failed"));
    Ok(())
}

fn ensure_device() -> Result<String> {
    let existing = probe(&format!("xcrun simctl list devices | grep \"{DEVICE_NAME} (\""));
    let id = Regex::new(r"\(([0-9A-F-]{36})\)")?;
    if let Some(caps) = id.captures(&existing) {
        return Ok(caps[1].to_string());
    }

    if !probe("xcrun simctl list runtimes").contains(RUNTIME_HINT) {
        bail!(
            "{RUNTIME_HINT} simulator runtime is not installed, so the iPhone 8 device cannot be \
created. Install it before running the iOS test lane."
        );
    }

    let created = run_quiet(&format!(
        "xcrun simctl create \"{DEVICE_NAME}\" {DEVICE_TYPE} {RUNTIME}"
    ))?;
    let created = created.trim().to_string();
    if created.is_empty() {
        bail!("Failed to create the simulator device");
    }
    Ok(created)
}
