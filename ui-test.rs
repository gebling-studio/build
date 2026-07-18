#!/usr/bin/env rust

// Runs the UI suite on every lane and prints one summary at the end.
//
// Desktop debug and desktop release share the default cargo target, so they run
// one after another. The iOS simulator lane uses its own target dir and runs
// alongside them on its own task. Each lane streams its own output, the iOS lane
// deliberately quiet, and the counts are gathered into a single table at the end.

use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use anyhow::Result;
use regex::Regex;

struct Lane {
    name: String,
    passed: i64,
    failed: i64,
    ok: bool,
}

/// Streams a command's output live and captures it, so a lane stays watchable
/// and its result line can still be parsed afterwards.
fn tee(command: &str) -> Result<(String, bool)> {
    let mut child = Command::new("sh")
        .arg("-c")
        .arg(format!("{command} 2>&1"))
        .stdout(Stdio::piped())
        .spawn()?;
    let stdout = child.stdout.take().unwrap();
    let mut output = String::new();
    for line in BufReader::new(stdout).lines() {
        let line = line?;
        println!("{line}");
        output.push_str(&line);
        output.push('\n');
    }
    let status = child.wait()?;
    Ok((output, status.success()))
}

/// The desktop runner prints "N UI tests passed" on success and
/// "M of N UI test(s) failed" otherwise.
fn desktop_lane(name: &str, output: &str, ok: bool) -> Result<Lane> {
    let passed = Regex::new(r"(\d+) UI tests passed")?;
    if let Some(caps) = passed.captures(output) {
        return Ok(Lane {
            name: name.to_string(),
            passed: caps[1].parse()?,
            failed: 0,
            ok: true,
        });
    }
    let failed = Regex::new(r"(\d+) of (\d+) UI test\(s\) failed")?;
    if let Some(caps) = failed.captures(output) {
        let bad: i64 = caps[1].parse()?;
        let total: i64 = caps[2].parse()?;
        return Ok(Lane {
            name: name.to_string(),
            passed: total - bad,
            failed: bad,
            ok: false,
        });
    }
    Ok(Lane {
        name: name.to_string(),
        passed: 0,
        failed: 0,
        ok,
    })
}

/// The iOS lane prints "N tests, M failed" in its ok and failed lines.
fn ios_lane(output: &str, ok: bool) -> Result<Lane> {
    let marker = Regex::new(r"(\d+) tests, (\d+) failed")?;
    if let Some(caps) = marker.captures(output) {
        let total: i64 = caps[1].parse()?;
        let bad: i64 = caps[2].parse()?;
        return Ok(Lane {
            name: "iOS simulator".to_string(),
            passed: total - bad,
            failed: bad,
            ok: ok && bad == 0,
        });
    }
    Ok(Lane {
        name: "iOS simulator".to_string(),
        passed: 0,
        failed: 0,
        ok,
    })
}

#[tokio::main(flavor = "multi_thread")]
async fn main() -> Result<()> {
    let is_mac = cfg!(target_os = "macos");

    // Start the iOS lane first so it builds and runs while the desktop lanes go.
    let ios = if is_mac {
        Some(tokio::spawn(async {
            tee("rust ./build/ios/sim-test.rs")
        }))
    } else {
        None
    };

    let debug = tee("cargo run -p ui-test")?;
    let release = tee("cargo run -p ui-test --release")?;

    let mut lanes = vec![
        desktop_lane("desktop debug", &debug.0, debug.1)?,
        desktop_lane("desktop release", &release.0, release.1)?,
    ];

    match ios {
        Some(handle) => {
            let (output, ok) = handle.await??;
            lanes.push(ios_lane(&output, ok)?);
        }
        None => lanes.push(Lane {
            name: "iOS simulator".to_string(),
            passed: 0,
            failed: 0,
            ok: true,
        }),
    }

    let width = lanes.iter().map(|l| l.name.len()).max().unwrap_or(0);
    let bar = "=".repeat(width + 26);

    println!("\n{bar}");
    println!("  UI tests");
    println!("{bar}");
    for lane in &lanes {
        let status = if !is_mac && lane.name == "iOS simulator" {
            "skipped (not macOS)".to_string()
        } else {
            format!("{} passed   {} failed", lane.passed, lane.failed)
        };
        println!("  {:width$}   {status}", lane.name);
    }
    println!("{bar}");

    if lanes.iter().any(|lane| !lane.ok) {
        std::process::exit(1);
    }
    Ok(())
}
