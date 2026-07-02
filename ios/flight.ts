#!/usr/bin/env bun

import { env } from "../../env";
import { run } from "../run";

run("bun ./build/ios/build-project.ts");

delete process.env.CFLAGS;
delete process.env.CXXFLAGS;

const exportOptionsPlist = "export.plist";
const archivePath = `build/${env.PROJECT_NAME}.xcarchive`;
const ipaPath = `build/${env.PROJECT_NAME}.ipa`;

process.chdir("mobile/iOS");

console.log("PROJECT_NAME: " + env.PROJECT_NAME);
console.log("ARCHIVE_PATH: " + archivePath);
console.log("IPA_PATH: " + ipaPath);

console.log("codesign identity:");
run("security find-identity -p codesigning -v");

run(
    `xcodebuild -project "${env.PROJECT_NAME}".xcodeproj -scheme "${env.PROJECT_NAME}" ` +
        `-sdk iphoneos -configuration Release archive -archivePath "${archivePath}"`,
);
console.log("build: OK");

run(
    `xcodebuild -exportArchive -archivePath "${archivePath}" ` +
        `-exportOptionsPlist "${exportOptionsPlist}" -exportPath "build"`,
);
console.log("export: OK");

// $FLIGHT_PASS expands inside the child shell so the password never gets printed
run(`xcrun altool --upload-app -f "${ipaPath}" -u 146100@gmail.com -p "$FLIGHT_PASS" --type ios`);
console.log("upload: OK");
