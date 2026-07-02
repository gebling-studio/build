#!/usr/bin/env bun

import { run } from "./run";

run("cargo install cross --git https://github.com/cross-rs/cross");
run("cross build --all --release --target x86_64-unknown-linux-gnu");
