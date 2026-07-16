#!/usr/bin/env bun

// Runs the UI suite on every lane and prints one summary at the end.
//
// Desktop debug and desktop release share the default cargo target, so they run
// one after another. The iOS simulator lane uses its own target dir and runs
// alongside them. Each lane streams its own output, the iOS lane deliberately
// quiet, and the counts are gathered into a single table at the end.

import { spawn } from "node:child_process";

type Lane = { name: string; passed: number; failed: number; ok: boolean };

// Streams a command's output live and captures it, so a lane stays watchable
// and its result line can still be parsed afterwards.
function tee(cmd: string, args: string[]): Promise<{ output: string; code: number }> {
    return new Promise((resolve) => {
        const child = spawn(cmd, args, { env: process.env });
        let output = "";
        child.stdout.on("data", (chunk) => {
            output += chunk;
            process.stdout.write(chunk);
        });
        child.stderr.on("data", (chunk) => {
            output += chunk;
            process.stderr.write(chunk);
        });
        child.on("close", (code) => resolve({ output, code: code ?? 1 }));
    });
}

// The desktop runner prints "N UI tests passed" on success and
// "M of N UI test(s) failed" otherwise.
function desktopLane(name: string, output: string, code: number): Lane {
    const passed = output.match(/(\d+) UI tests passed/);
    if (passed) {
        return { name, passed: Number(passed[1]), failed: 0, ok: true };
    }
    const failed = output.match(/(\d+) of (\d+) UI test\(s\) failed/);
    if (failed) {
        const total = Number(failed[2]);
        const bad = Number(failed[1]);
        return { name, passed: total - bad, failed: bad, ok: false };
    }
    return { name, passed: 0, failed: 0, ok: code === 0 };
}

// The iOS lane prints "N tests, M failed" in its ok and failed lines.
function iosLane(output: string, code: number): Lane {
    const marker = output.match(/(\d+) tests, (\d+) failed/);
    if (marker) {
        const total = Number(marker[1]);
        const bad = Number(marker[2]);
        return { name: "iOS simulator", passed: total - bad, failed: bad, ok: code === 0 && bad === 0 };
    }
    return { name: "iOS simulator", passed: 0, failed: 0, ok: code === 0 };
}

// Start the iOS lane first so it builds and runs while the desktop lanes go.
const iosPromise = process.platform === "darwin" ? tee("bun", ["./build/ios/sim-test.ts"]) : null;

const debug = await tee("cargo", ["run", "-p", "ui-test"]);
const release = await tee("cargo", ["run", "-p", "ui-test", "--release"]);

const lanes: Lane[] = [
    desktopLane("desktop debug", debug.output, debug.code),
    desktopLane("desktop release", release.output, release.code),
];

if (iosPromise) {
    const ios = await iosPromise;
    lanes.push(iosLane(ios.output, ios.code));
} else {
    lanes.push({ name: "iOS simulator", passed: 0, failed: 0, ok: true });
}

const nameWidth = Math.max(...lanes.map((l) => l.name.length));
const bar = "=".repeat(nameWidth + 26);

console.log(`\n${bar}`);
console.log("  UI tests");
console.log(bar);
for (const lane of lanes) {
    const skipped = process.platform !== "darwin" && lane.name === "iOS simulator";
    const status = skipped ? "skipped (not macOS)" : `${lane.passed} passed   ${lane.failed} failed`;
    console.log(`  ${lane.name.padEnd(nameWidth)}   ${status}`);
}
console.log(bar);

if (lanes.some((lane) => !lane.ok)) {
    process.exit(1);
}
