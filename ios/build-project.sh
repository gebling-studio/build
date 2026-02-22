#!/bin/bash

set -euox pipefail

./build/ios/build-lib.sh

unset CFLAGS
unset CXXFLAGS

source env.sh

cargo install test-mobile --locked
test-mobile ${@+"$@"}

cd mobile/iOS

xcodebuild -showsdks

xcodebuild -sdk iphonesimulator -scheme $PROJECT_NAME build
