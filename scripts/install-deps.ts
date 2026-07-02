#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { run } from "../run";

if (process.platform === "darwin") {
    console.log("This script is running on macOS.");
    process.exit(0);
}

const release = readFileSync("/etc/os-release", "utf8");
console.log(release);

const lower = release.toLowerCase();

if (lower.includes("debian") || lower.includes("ubuntu")) {
    console.log("Debian");
    process.env.DEBIAN_FRONTEND = "noninteractive";
    run("sudo apt update");
    run(
        "sudo apt install cmake mesa-common-dev libgl1-mesa-dev libglu1-mesa-dev " +
            "xorg-dev libasound2-dev pkg-config libssl-dev -yq",
    );
} else if (lower.includes("arch linux") || lower.includes("manjaro")) {
    console.log("Arch");
    run("pacman -Sy unzip sudo --noconfirm");
} else if (lower.includes("amazon linux")) {
    run("yum install -y sudo unzip");
} else if (lower.includes("fedora")) {
    run("dnf install -y sudo unzip");
} else if (lower.includes("opensuse")) {
    run("zypper install -y unzip sudo");
} else {
    console.log("Unknown Linux. Command will not run.");
}
