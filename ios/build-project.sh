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

# An explicit destination fails with a clear "iOS is not installed" message
# when the platform is missing. The -sdk flag instead falls back to a Mac
# Catalyst destination and dies at link time with an arch mismatch.
xcodebuild -scheme $PROJECT_NAME -destination "generic/platform=iOS Simulator" build
