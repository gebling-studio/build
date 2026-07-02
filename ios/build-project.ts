#!/usr/bin/env bun

import { env } from "../../env";
import { run } from "../run";

run("bun ./build/ios/build-lib.ts");

delete process.env.CFLAGS;
delete process.env.CXXFLAGS;

run("cargo install test-mobile --locked");

const args = process.argv.slice(2).join(" ");
run(("test-mobile " + args).trim());

process.chdir("mobile/iOS");

run("xcodebuild -showsdks");

// An explicit destination fails with a clear "iOS is not installed" message
// when the platform is missing. The -sdk flag instead falls back to a Mac
// Catalyst destination and dies at link time with an arch mismatch.
run(`xcodebuild -scheme ${env.PROJECT_NAME} -destination "generic/platform=iOS Simulator" build`);
