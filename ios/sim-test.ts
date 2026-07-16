#!/usr/bin/env bun

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

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (process.platform !== "darwin") {
    console.log("[ios] not macOS, skipping the iOS simulator lane.");
    process.exit(0);
}

const DEVICE_NAME = "te-iPhone8-16.4";
const DEVICE_TYPE = "com.apple.CoreSimulator.SimDeviceType.iPhone-8";
const RUNTIME = "com.apple.CoreSimulator.SimRuntime.iOS-16-4";
const RUNTIME_HINT = "iOS 16.4";

const BUNDLE_ID = readFileSync("test-engine.toml", "utf8").match(/bundle_id\s*=\s*"([^"]+)"/)?.[1];
if (!BUNDLE_ID) {
    throw new Error("bundle_id not found in test-engine.toml");
}

// A separate cargo target dir so this build never blocks on the desktop lane's
// target lock, which is what lets the two lanes truly run in parallel. It sits
// under target so the existing ignore of target contents already covers it.
const IOS_TARGET_DIR = "target/ios";
const SIM_TRIPLE = "x86_64-apple-ios";
const LIB = `${IOS_TARGET_DIR}/${SIM_TRIPLE}/release/libtest_game.a`;
const LINKED_LIB = "target/universal/release/libtest_game.a";
const SYMROOT = `${process.cwd()}/${IOS_TARGET_DIR}/sim-build`;
const APP = `${SYMROOT}/Release-iphonesimulator/TestGame.app`;

function step(msg: string) {
    console.log(`\n[ios] ${msg}`);
}

// Captures output and never prints it unless the command fails, so the desktop
// lane's live output stays readable next to this one.
function run(cmd: string): string {
    const result = spawnSync(cmd, { shell: true, encoding: "utf8", env: process.env });
    if (result.status !== 0) {
        process.stderr.write(result.stdout ?? "");
        process.stderr.write(result.stderr ?? "");
        throw new Error(`[ios] command failed: ${cmd}`);
    }
    return (result.stdout ?? "") + (result.stderr ?? "");
}

// Captures output and never throws, for checks whose non zero is expected and
// for the test launch, whose exit status simctl does not forward reliably.
function capture(cmd: string): string {
    const result = spawnSync(cmd, { shell: true, encoding: "utf8", env: process.env });
    return (result.stdout ?? "") + (result.stderr ?? "");
}

function ensureDevice(): string {
    const existing = capture(`xcrun simctl list devices | grep "${DEVICE_NAME} ("`);
    const match = existing.match(/\(([0-9A-F-]{36})\)/);
    if (match) {
        return match[1];
    }

    if (!capture("xcrun simctl list runtimes").includes(RUNTIME_HINT)) {
        throw new Error(
            `${RUNTIME_HINT} simulator runtime is not installed, so the iPhone 8 device cannot be ` +
                `created. Install it before running the iOS test lane.`,
        );
    }

    const id = run(`xcrun simctl create "${DEVICE_NAME}" ${DEVICE_TYPE} ${RUNTIME}`).trim();
    if (!id) {
        throw new Error("Failed to create the simulator device");
    }
    return id;
}

step("adding the iOS simulator rust target");
run(`rustup target add ${SIM_TRIPLE}`);

// --lib only. The bin target fails to link on iOS, it needs a symbol the UIKit
// shell provides, and only the staticlib is wanted here. Release, so the suite
// runs at real speed. The Xcode project links the lib from target/universal/release.
step("building the engine for iOS, this takes a while");
run(
    `env CARGO_TARGET_DIR=${IOS_TARGET_DIR} IPHONEOS_DEPLOYMENT_TARGET=12.0 ` +
        `cargo build -p test-game --lib --target ${SIM_TRIPLE} --release`,
);
run(`mkdir -p target/universal/release && cp ${LIB} ${LINKED_LIB}`);

// The generated project is gitignored, so regenerate it only when it is missing,
// not on every run. Regenerating wipes the device only weak framework flags.
if (!existsSync("mobile/iOS/TestGame.xcodeproj")) {
    run("cargo install test-mobile --locked");
    run("test-mobile");
}

step("building the simulator app");
run(
    `xcodebuild -project mobile/iOS/TestGame.xcodeproj -target TestGame -configuration Release ` +
        `-sdk iphonesimulator ARCHS=x86_64 VALID_ARCHS=x86_64 ONLY_ACTIVE_ARCH=NO ` +
        `SYMROOT=${SYMROOT} build`,
);

const device = ensureDevice();

step(`booting ${DEVICE_NAME}`);
run(`xcrun simctl boot ${device} || true`);
run("open -a Simulator");
run(`xcrun simctl bootstatus ${device}`);
run(`xcrun simctl install ${device} "${APP}"`);

// TE_RUN_TESTS makes the app run the suite and exit. --console streams its stdout
// here, so the result marker arrives before the launch returns.
step("running the UI suite on the simulator");
const output = capture(
    `SIMCTL_CHILD_TE_RUN_TESTS=1 xcrun simctl launch --console --terminate-running-process ${device} ${BUNDLE_ID} 2>&1`,
);

run(`xcrun simctl shutdown ${device} || true`);
spawnSync("osascript", ["-e", 'tell application "Simulator" to quit']);

const marker = output.match(/TE_TEST_RESULT (\d+) tests, (\d+) failed/);
if (!marker) {
    console.error(output);
    throw new Error("[ios] sim run produced no result marker. See the launch output above.");
}

const total = Number(marker[1]);
const failed = Number(marker[2]);

if (failed !== 0) {
    console.error(output);
    step(`FAILED: ${total} tests, ${failed} failed`);
    process.exit(1);
}

step(`ok: ${total} tests, 0 failed`);
