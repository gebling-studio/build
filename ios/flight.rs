#!/usr/bin/env rust

use anyhow::Result;
use shared::config;
use shared::run::{capture, run};

// Gebling Games Studio Infisical project, holds the Apple upload secret
const INFISICAL_PROJECT: &str = "e2dd64d9-130c-4072-bd3d-0a98331364cb";

fn main() -> Result<()> {
    let config = config::read()?;

    run("rust ./build/ios/build-project.rs")?;

    unsafe {
        std::env::remove_var("CFLAGS");
        std::env::remove_var("CXXFLAGS");
    }

    let export_options = "export.plist";
    let archive_path = format!("build/{}.xcarchive", config.project_name);
    let ipa_path = format!("build/{}.ipa", config.project_name);

    std::env::set_current_dir("mobile/iOS")?;

    println!("PROJECT_NAME: {}", config.project_name);
    println!("ARCHIVE_PATH: {archive_path}");
    println!("IPA_PATH: {ipa_path}");

    println!("codesign identity:");
    run("security find-identity -p codesigning -v")?;

    // Weak link the frameworks that carry modern data constants. On iOS 12 and
    // 13 dyld binds a strong data symbol eagerly, so a constant the device lacks
    // like kCGColorSpaceExtendedDisplayP3 or kSecUseDataProtectionKeychain kills
    // the app before main. Weak linking makes the missing constant NULL instead.
    // test-mobile regenerates the project with no OTHER_LDFLAGS, so set it here
    // on the archive command so every TestFlight build keeps running on old iOS.
    run(&format!(
        "xcodebuild -project \"{}\".xcodeproj -scheme \"{}\" \
-sdk iphoneos -configuration Release archive -archivePath \"{archive_path}\" \
OTHER_LDFLAGS=\"-Wl,-weak_framework,CoreGraphics -Wl,-weak_framework,Security\"",
        config.project_name, config.project_name
    ))?;
    println!("build: OK");

    // The IPA step shells out to rsync, and Xcode only works with Apple's own.
    // A newer rsync earlier on PATH, from nix or homebrew, makes the export die
    // with a bare "Copy failed" and the real cause only appears in the
    // xcdistributionlogs bundle. Putting the system paths first avoids that.
    run(&format!(
        "PATH=/usr/bin:/bin:/usr/sbin:/sbin:$PATH \
xcodebuild -exportArchive -archivePath \"{archive_path}\" \
-exportOptionsPlist \"{export_options}\" -exportPath \"build\""
    ))?;
    println!("export: OK");

    let password = capture(&format!(
        "infisical secrets get APPLE_APP_SPECIFIC_PASSWORD --projectId {INFISICAL_PROJECT} \
--env prod --plain --silent"
    ))?;
    unsafe {
        std::env::set_var("APPLE_APP_SPECIFIC_PASSWORD", &password);
    }

    // The password stays a shell variable so it never gets printed in the
    // echoed command.
    run(&format!(
        "xcrun altool --upload-app -f \"{ipa_path}\" -u 146100@gmail.com \
-p \"$APPLE_APP_SPECIFIC_PASSWORD\" --type ios"
    ))?;
    println!("upload: OK");
    Ok(())
}
