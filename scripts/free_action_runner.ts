#!/usr/bin/env bun

import { run } from "../run";

if (process.platform === "darwin") {
    process.exit(0);
}

run("sudo df -h");

const paths = [
    "/usr/share/dotnet",
    "/opt/ghc",
    "/usr/local/share/boost",
    process.env.AGENT_TOOLSDIRECTORY,
    "/usr/local/lib/android",
    "/opt/hostedtoolcache",
    "/__t/CodeQL",
];

for (const path of paths) {
    if (path) {
        run(`sudo rm -rf "${path}"`, false);
    }
}

run("sudo df -h");
