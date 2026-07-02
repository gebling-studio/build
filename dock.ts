#!/usr/bin/env bun

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./run";

const builderName = "docker_builder";
const insecureRegistry = "192.168.0.201:30500";

// patch docker config to allow the insecure registry
function writeBuildkitdConfig(): string {
    const config = `
[registry."${insecureRegistry}"]
  http = true
  insecure = true
`;
    const path = join(mkdtempSync(join(tmpdir(), "buildkitd-")), "buildkitd.toml");
    writeFileSync(path, config);
    return path;
}

function buildImage() {
    if (process.argv.length !== 5) {
        console.log("Usage: dock.ts <name> <dockerfile> <version>");
        process.exit(1);
    }

    const name = process.argv[2];
    const dockerfile = process.argv[3];
    const version = process.argv[4];

    console.log("Cross-building with docker buildx and config override...");

    run(`docker buildx rm ${builderName}`, false);

    const configPath = writeBuildkitdConfig();

    run(`docker buildx create --name ${builderName} --use --driver docker-container --config ${configPath}`);

    run("docker buildx inspect --bootstrap");

    const imageName = `${insecureRegistry}/${name}:${version}`;

    run(`docker buildx build --file ${dockerfile} --platform linux/amd64 --tag ${imageName} --push .`);
}

try {
    buildImage();
} catch (e) {
    console.log("Error during execution: " + e);
    process.exitCode = 1;
} finally {
    run(`docker buildx rm ${builderName}`, false);
}
