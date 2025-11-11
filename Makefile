build:
	stellar contract build

optimize:
	make build
	stellar contract optimize --wasm target/wasm32v1-none/release/blendizzard.wasm
	stellar contract optimize --wasm target/wasm32v1-none/release/number_guess.wasm

bindings:
	stellar contract bindings typescript \
		--wasm target/wasm32v1-none/release/blendizzard.wasm \
		--output-dir ./bunt/bindings/blendizzard \
		--overwrite
	stellar contract bindings typescript \
		--output-dir ./bunt/bindings/fee-vault \
		--contract-id CBBY53VYJSMAWCBZZ7BHJZ5XSZNJUS4ZE6Q4RN7TKZGHPYHMEE467W7Y \
		--overwrite
	stellar contract bindings typescript \
		--wasm target/wasm32v1-none/release/number_guess.wasm \
		--output-dir ./bunt/bindings/number-guess \
		--overwrite