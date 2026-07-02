#!/usr/bin/env bun

import { env } from "../../env";
import { run } from "../run";

console.log("APP_NAME: " + env.APP_NAME);
console.log("CARGO_PROFILE_FOR_PROFILING: " + env.CARGO_PROFILE_FOR_PROFILING);

run("cargo install --locked samply");

run(`cargo build -p "${env.APP_NAME}" --profile="${env.CARGO_PROFILE_FOR_PROFILING}"`);

const targetDir = env.CARGO_PROFILE_FOR_PROFILING === "dev" ? "debug" : env.CARGO_PROFILE_FOR_PROFILING;

run(`samply record ./target/${targetDir}/${env.APP_NAME}`);
