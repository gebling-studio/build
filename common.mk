
ios:
	rust ./build/ios/build-project.rs

ios-lib:
	rust ./build/ios/build-lib.rs

android:
	rust ./build/build.rs android

test:
	cargo test --all
	echo debug test: OK
	cargo test --all --release
	echo release test: OK

fly:
	rust ./build/ios/flight.rs

profile:
	rust ./build/scripts/profile.rs

pr:
	gh pr create --fill

fmt:
	cargo +nightly fmt --all

fmt-check:
	cargo +nightly fmt --all -- --check

updates:
	cargo install cargo-upgrades --locked
	cargo upgrades
