#!/usr/bin/env bun

import { spawnSync } from "node:child_process";

const image = "test-engine-android";

// Named volumes keep the Rust toolchain, cargo registry and gradle caches
// across runs, so only the first build downloads them. The volumes seed
// themselves from the image content on first use, which is how the rustup
// binary from the image survives the mount.
const volumes = [
    "test-engine-android-rustup:/usr/local/rustup",
    "test-engine-android-cargo:/usr/local/cargo",
    "test-engine-android-gradle:/root/.gradle",
];

function docker(args: string[]) {
    console.log("docker " + args.join(" "));
    const result = spawnSync("docker", args, { stdio: "inherit" });
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

docker(["build", "--platform", "linux/amd64", "-t", image, "./build/android"]);

docker([
    "run",
    "--rm",
    "-t",
    "--platform",
    "linux/amd64",
    "--mount",
    `type=bind,source=${process.cwd()},target=/host`,
    ...volumes.flatMap((volume) => ["-v", volume]),
    "-w",
    "/host",
    "-e",
    "TEST_ENGINE_ANDROID_DOCKER_BUILD=true",
    // Release rustc under Rosetta eats gigabytes per job. Uncapped jobs
    // OOM the whole container on a default Docker Desktop VM, which dies
    // silently mid build with no error from cargo or gradle.
    "-e",
    "CARGO_BUILD_JOBS=4",
    image,
    "/bin/bash",
    "-c",
    "bun ./build/build.ts android",
]);
