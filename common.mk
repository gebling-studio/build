
ios:
	bun ./build/ios/build-project.ts

ios-lib:
	bun ./build/ios/build-lib.ts

android:
	bun ./build/build.ts android

test:
	cargo test --all
	echo debug test: OK
	cargo test --all --release
	echo release test: OK

fly:
	bun ./build/ios/flight.ts

profile:
	bun ./build/scripts/profile.ts

pr:
	gh pr create --fill

fmt:
	cargo +nightly fmt --all

fmt-check:
	cargo +nightly fmt --all -- --check

updates:
	cargo install cargo-upgrades --locked
	cargo upgrades
