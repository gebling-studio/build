#!/usr/bin/env bun

import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { run } from "./run";

const ndkVersion = "27.0.11718014";

function log(message: string) {
    console.log("[INFO] " + message);
}

export function installNdk() {
    rmSync(homedir() + "/Android/Sdk/cmdline-tools/tools/cmdline-tools", {
        recursive: true,
        force: true,
    });

    if (!process.env.ANDROID_HOME) {
        process.env.ANDROID_HOME = homedir() + "/Android/Sdk";
        log("ANDROID_HOME not set, defaulting to " + process.env.ANDROID_HOME);
    }

    const androidHome = process.env.ANDROID_HOME;

    mkdirSync(androidHome, { recursive: true });

    if (!Bun.which("sdkmanager")) {
        log("sdkmanager not found, downloading command-line tools...");

        const toolsUrl =
            "https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip";

        mkdirSync(androidHome + "/cmdline-tools", { recursive: true });
        run("curl -o cmdline-tools.zip " + toolsUrl);
        run(`unzip cmdline-tools.zip -d "${androidHome}/cmdline-tools"`);
        renameSync(androidHome + "/cmdline-tools/cmdline-tools", androidHome + "/cmdline-tools/tools");
        rmSync("cmdline-tools.zip");

        process.env.PATH = androidHome + "/cmdline-tools/tools/bin:" + process.env.PATH;
        log("sdkmanager installed and added to PATH");
    } else {
        log("sdkmanager found in PATH");
    }

    run("yes | sdkmanager --licenses");

    log("Installing NDK version " + ndkVersion + "...");
    run(`yes | sdkmanager "ndk;${ndkVersion}" --sdk_root="${androidHome}"`);

    process.env.ANDROID_NDK_HOME = androidHome + "/ndk/" + ndkVersion;
    process.env.PATH = process.env.PATH + ":" + process.env.ANDROID_NDK_HOME;

    if (!existsSync(process.env.ANDROID_NDK_HOME)) {
        throw new Error("NDK installation directory does not exist: " + process.env.ANDROID_NDK_HOME);
    }

    log("NDK is installed at " + process.env.ANDROID_NDK_HOME);
}

if (import.meta.main) {
    installNdk();
}
