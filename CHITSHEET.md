// usdc
CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75

// blnd
CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY

// soroswap router
CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH

// fee-vault-v2 (kalepail mix)
CBBY53VYJSMAWCBZZ7BHJZ5XSZNJUS4ZE6Q4RN7TKZGHPYHMEE467W7Y

// blendizzard
06edbcb1b334d6ee603adde68854932c1cae04bf0b56d940bbc77236fb75cc3c
CAHPLVEDW2HWY2EOTCTECDK5ZRHAB5FLER3WGHQ5OPFMBMMFJSTBRJZU

// number guess
34793d2958cead393044ec5dcd1fb94231ffe40e6efb1b2fdc6655dd77b3e2cc
CDB6IODG5BNNVILLJXBXYZVR7NP4HDO2NL7WALWIXGIDMA6VY4V75CEX

// deploy blendizzard
stellar contract deploy --wasm target/wasm32v1-none/release/blendizzard.optimized.wasm --network mainnet --source rich -- --epoch_duration 60 --usdc_token CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75 --reserve_token_ids "[3]" --admin rich --blnd_token CD25MNVTZDL4Y3XBCPCJXGXATV5WUHHOWMYFF4YBEGU5FCPGMYTVG5JY --soroswap_router CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH --fee_vault CBBY53VYJSMAWCBZZ7BHJZ5XSZNJUS4ZE6Q4RN7TKZGHPYHMEE467W7Y

// install blendizzard
stellar contract upload --wasm target/wasm32v1-none/release/blendizzard.optimized.wasm --source rich --fee 1000000000

// upgrade blendizzard
stellar contract invoke --id CAHPLVEDW2HWY2EOTCTECDK5ZRHAB5FLER3WGHQ5OPFMBMMFJSTBRJZU --source rich --fee 10000000 -- upgrade --new_wasm_hash 06edbcb1b334d6ee603adde68854932c1cae04bf0b56d940bbc77236fb75cc3c

// deposit 5 USDC
stellar contract invoke --id CBBY53VYJSMAWCBZZ7BHJZ5XSZNJUS4ZE6Q4RN7TKZGHPYHMEE467W7Y --network mainnet --source default --fee 10000000 -- deposit --player default --amount 50000000

// add number guess game
