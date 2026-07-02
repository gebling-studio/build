#!/usr/bin/env bun

import { spawnSync } from "node:child_process";

// fresh containers have no bun, so the command bootstraps it before the build
export function runInDocker(image: string, buildCommand: string) {
    const hostDir = process.env.HOST_DIR ?? process.cwd();

    const bootstrap = `
set -eo pipefail
cd /host
if command -v apt > /dev/null; then
    export DEBIAN_FRONTEND=noninteractive
    apt update
    apt install -y curl unzip sudo
elif command -v pacman > /dev/null; then
    pacman -Sy unzip sudo --noconfirm
elif command -v dnf > /dev/null; then
    dnf install -y unzip sudo
elif command -v yum > /dev/null; then
    yum install -y unzip sudo
elif command -v zypper > /dev/null; then
    zypper install -y unzip sudo
fi
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
${buildCommand}
`;

    console.log("Running in docker: " + image);

    const result = spawnSync(
        "docker",
        [
            "run",
            "--rm",
            "--mount",
            `type=bind,source=${hostDir},target=/host`,
            "--cap-add=SYS_PTRACE",
            "--security-opt",
            "seccomp=unconfined",
            "-t",
            image,
            "/bin/bash",
            "-c",
            bootstrap,
        ],
        { stdio: "inherit" },
    );

    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

if (import.meta.main) {
    const image = process.argv[2];
    if (!image) {
        console.log("Usage: in_docker.ts <image>");
        process.exit(1);
    }
    runInDocker(image, "bun ./build/build.ts");
}
