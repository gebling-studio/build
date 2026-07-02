#!/usr/bin/env bun

import { env } from "../../env";
import { run } from "../run";

delete process.env.CFLAGS;
delete process.env.CXXFLAGS;

run("rustup target add aarch64-apple-ios x86_64-apple-ios");
run("cargo install cargo-lipo");

run(`cargo lipo -p ${env.APP_NAME} --release`);
