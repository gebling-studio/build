# Builds test-engine Android APKs without any host Android tooling.
# Everything here is a pinned build-time dependency: JDK, Android SDK
# pieces, NDK, python3 for rust-android-gradle, bun for the build
# scripts, rustup with no toolchain. The Rust toolchain, cargo registry
# and gradle caches live in named volumes mounted by in_docker_android.ts,
# so bumping rust-toolchain.toml never invalidates this image.
#
# Google ships the NDK and build-tools for linux x86_64 only, so this
# image is always amd64. On Apple Silicon it runs under Rosetta.
FROM --platform=linux/amd64 eclipse-temurin:17-jdk-jammy

ENV ANDROID_HOME=/opt/android-sdk
ENV ANDROID_SDK_ROOT=$ANDROID_HOME
ENV NDK_VERSION=27.0.11718014
ENV ANDROID_NDK_HOME=$ANDROID_HOME/ndk/$NDK_VERSION

ENV RUSTUP_HOME=/usr/local/rustup
ENV CARGO_HOME=/usr/local/cargo
ENV BUN_INSTALL=/usr/local/bun
ENV PATH=$CARGO_HOME/bin:$BUN_INSTALL/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    cmake \
    curl \
    git \
    libssl-dev \
    pkg-config \
    python3 \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# The repo is bind mounted and owned by a different uid than root in the
# container, git refuses to touch it otherwise.
RUN git config --system --add safe.directory '*'

ARG CMDLINE_TOOLS_VERSION=11076708
RUN mkdir -p $ANDROID_HOME/cmdline-tools \
    && curl -fsSL -o /tmp/cmdline-tools.zip \
    https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip \
    && unzip -q /tmp/cmdline-tools.zip -d $ANDROID_HOME/cmdline-tools \
    && mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest \
    && rm /tmp/cmdline-tools.zip

RUN yes | sdkmanager --licenses > /dev/null \
    && sdkmanager "platforms;android-34" "build-tools;34.0.0" "ndk;$NDK_VERSION"

RUN curl -fsSL https://bun.sh/install | bash

RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --default-toolchain none --profile minimal --no-modify-path

WORKDIR /host
