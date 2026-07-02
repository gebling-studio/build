#!/usr/bin/env bun

import { existsSync, readFileSync } from "node:fs";
import { run } from "./run";

export function installJava() {
    const release = existsSync("/etc/os-release")
        ? readFileSync("/etc/os-release", "utf8").toLowerCase()
        : "";

    if (release.includes("fedora")) {
        run("sudo dnf update -y");
        run("sudo dnf install -y java-17-openjdk java-17-openjdk-devel curl unzip");
    } else {
        run("apt update");
        run("apt install -y openjdk-17-jdk curl sudo unzip");
    }

    process.env.JAVA_HOME = "/usr/lib/jvm/java-17-openjdk";
    process.env.PATH = process.env.JAVA_HOME + "/bin:" + process.env.PATH;

    run("java -version");

    console.log("If gradle fails, update the gradle wrapper version in gradle-wrapper.properties");
}

if (import.meta.main) {
    installJava();
}
