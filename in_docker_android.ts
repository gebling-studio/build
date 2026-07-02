#!/usr/bin/env bun

import { runInDocker } from "./in_docker";

runInDocker(
    "mobiledevops/android-sdk-image",
    "export TEST_ENGINE_ANDROID_DOCKER_BUILD=true && bun ./build/build.ts android",
);
