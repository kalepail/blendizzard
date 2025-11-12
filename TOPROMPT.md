* nuke `get_claimable_amount`. We should be able to get that by simulating `claim_epoch_reward`
* nuke `has_claimed_rewards`. We should be able to get that by simulating `claim_epoch_reward`
* nuke `is_faction_locked`. There's better ways to look this up (like by simulating `get_epoch_player`)
* nuke `get_reward_pool`. Just use `get_epoch`
* Consider having opponent wager added to self wager as the total FP contributed to faction
* We mix the term User and Player it seems. We should likely be consistent with Player right? Or is there a good reason to keep both nomenclatures?