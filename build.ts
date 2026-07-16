#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { arch, homedir, version } from "node:os";
import { env } from "../env";
import { run } from "./run";

const isMac = process.platform === "darwin";
const isLinux = process.platform === "linux";

const unix = isMac || isLinux;

const args = process.argv.slice(2).join(" ").toLowerCase();
const ios = args.includes("ios");
const android = args.includes("android");

console.log("ANDROID_LIB_NAME: " + env.ANDROID_LIB_NAME);
console.log("PROJECT_NAME: " + env.PROJECT_NAME);

// The android build always runs inside docker, locally and in CI, so the
// host needs no Android tooling. The env var marks being inside already.
if (android && !process.env.TEST_ENGINE_ANDROID_DOCKER_BUILD) {
    run("bun ./build/in_docker_android.ts");
    process.exit(0);
}

function getUname(): string {
    if (!unix) {
        return "";
    }
    return spawnSync("uname", ["-a"], { encoding: "utf8" }).stdout.toLowerCase();
}

function getRelease(): string {
    if (!isLinux) {
        return "";
    }
    return readFileSync("/etc/os-release", "utf8").toLowerCase();
}

const uname = getUname();
const release = getRelease();

console.log("uname: " + uname);
console.log("distro: " + version());
console.log("system: " + process.platform);
console.log("arch: " + arch());

const isFedora = release.includes("fedora");
const isFreebsd = uname.includes("freebsd");
const isArch = existsSync("/etc/arch-release");
const isUbuntu = release.includes("ubuntu");
const isDebian = release.includes("debian");
const isAmazon = release.includes("amazon");
const isOpensuse = release.includes("opensuse");

function buildAndroid() {
    run("rustup toolchain install");
    run(
        "rustup target add armv7-linux-androideabi aarch64-linux-android i686-linux-android x86_64-linux-android",
    );

    run("cargo install test-mobile --locked");
    run("test-mobile");

    process.chdir("mobile/android");
    run("chmod +x ./gradlew");
    run("./gradlew build");
}

if (android) {
    buildAndroid();
    process.exit(0);
}

if (isLinux) {
    console.log("Lin setup");

    if (isAmazon) {
        console.log("Amazon");
        run("sudo yum install -y gcc gcc-c++ alsa-lib-devel");
    } else if (isFedora) {
        console.log("Fedora");
        run(
            "sudo dnf install -y libXcursor-devel libXi-devel libXinerama-devel libXrandr-devel " +
                "perl make cmake automake gcc gcc-c++ kernel-devel alsa-lib-devel-*",
        );
    } else if (isFreebsd) {
        console.log("Freebsd");
        run("sudo pkg update");
        run("sudo pkg install cmake xorg pkgconf alsa-utils");
    } else if (isArch) {
        console.log("Arch");
        run("sudo pacman -S gcc pkg-config cmake openssl make alsa-lib alsa-utils --noconfirm");
    } else if (isUbuntu || isDebian) {
        console.log("Debian");

        let deps =
            "cmake mesa-common-dev libgl1-mesa-dev libglu1-mesa-dev xorg-dev libasound2-dev pkg-config libssl-dev";

        if (arch() !== "arm64") {
            deps += " build-essential";
        }

        run("sudo apt update");
        run("sudo apt -y install " + deps);
    } else if (isOpensuse) {
        console.log("openSUSE");
        run("sudo zypper refresh");
        run("sudo zypper update");
        run("sudo zypper install -y --type pattern devel_basis");
        run("sudo zypper install -y --type pattern devel_C_C++");
        run("sudo zypper install -y alsa-lib llvm llvm-devel clang");
    } else {
        console.log("Unknown distro");
        process.exit(1);
    }
}

if (unix) {
    console.log("Installing rustup:");
    run("curl https://sh.rustup.rs -sSf | sh -s -- -y");
    process.env.PATH = homedir() + "/.cargo/bin:" + process.env.PATH;
}

if (ios) {
    run("bun ./build/ios/build-project.ts");
} else {
    run("cargo build --all --profile=ci");
    run("cargo test --all --profile=ci");
}
