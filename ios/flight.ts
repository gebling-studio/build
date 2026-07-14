#!/usr/bin/env bun

import { env } from "../../env";
import { capture, run } from "../run";

run("bun ./build/ios/build-project.ts");

delete process.env.CFLAGS;
delete process.env.CXXFLAGS;

const exportOptionsPlist = "export.plist";
const archivePath = `build/${env.PROJECT_NAME}.xcarchive`;
const ipaPath = `build/${env.PROJECT_NAME}.ipa`;

// Gebling Games Studio Infisical project, holds the Apple upload secret
const infisicalProject = "e2dd64d9-130c-4072-bd3d-0a98331364cb";

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

process.env.APPLE_APP_SPECIFIC_PASSWORD = capture(
    `infisical secrets get APPLE_APP_SPECIFIC_PASSWORD --projectId ${infisicalProject} --env prod --plain --silent`,
);

// the password stays a shell variable so it never gets printed in the echoed command
run(`xcrun altool --upload-app -f "${ipaPath}" -u 146100@gmail.com -p "$APPLE_APP_SPECIFIC_PASSWORD" --type ios`);
console.log("upload: OK");
