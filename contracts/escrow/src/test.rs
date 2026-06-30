#![cfg(test)]
use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::Env;

fn create_token<'a>(env: &Env, admin: &Address) -> (Address, token::StellarAssetClient<'a>, token::Client<'a>) {
    let sac = env.register_stellar_asset_contract_v2(admin.clone());
    let asset_client = token::StellarAssetClient::new(env, &sac.address());
    let token_client = token::Client::new(env, &sac.address());
    (sac.address(), asset_client, token_client)
}

fn setup(env: &Env) -> (Address, Address, Address, Address, token::StellarAssetClient<'static>, token::Client<'static>, EscrowContractClient<'static>) {
    let admin = Address::generate(env);
    let sender = Address::generate(env);
    let recipient = Address::generate(env);
    let (token_addr, asset_client, token_client) = create_token(env, &admin);
    asset_client.mint(&sender, &1000);

    let contract_id = env.register_contract(None, EscrowContract);
    let client = EscrowContractClient::new(env, &contract_id);

    (sender, recipient, token_addr, contract_id, asset_client, token_client, client)
}

#[test]
fn test_create_locks_funds() {
    let env = Env::default();
    env.mock_all_auths();
    let (sender, recipient, token_addr, contract_id, _asset, token_client, client) = setup(&env);

    let id = client.create_escrow(&sender, &recipient, &token_addr, &500, &0);
    assert_eq!(id, 1);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, Status::Locked);
    assert_eq!(token_client.balance(&sender), 500);
    assert_eq!(token_client.balance(&contract_id), 500);
}

#[test]
fn test_recipient_can_claim() {
    let env = Env::default();
    env.mock_all_auths();
    let (sender, recipient, token_addr, contract_id, _asset, token_client, client) = setup(&env);

    let id = client.create_escrow(&sender, &recipient, &token_addr, &500, &0);
    client.claim(&recipient, &id);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, Status::Claimed);
    assert_eq!(token_client.balance(&recipient), 500);
    assert_eq!(token_client.balance(&contract_id), 0);
}

#[test]
fn test_refund_after_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let (sender, recipient, token_addr, _contract_id, _asset, token_client, client) = setup(&env);

    let deadline = env.ledger().timestamp() + 100;
    let id = client.create_escrow(&sender, &recipient, &token_addr, &500, &deadline);

    env.ledger().with_mut(|l| l.timestamp = deadline + 1);
    client.refund(&sender, &id);

    let escrow = client.get_escrow(&id).unwrap();
    assert_eq!(escrow.status, Status::Refunded);
    assert_eq!(token_client.balance(&sender), 1000); // fully refunded
}

#[test]
fn test_refund_fails_before_deadline() {
    let env = Env::default();
    env.mock_all_auths();
    let (sender, recipient, token_addr, _contract_id, _asset, _token_client, client) = setup(&env);

    let deadline = env.ledger().timestamp() + 1000;
    let id = client.create_escrow(&sender, &recipient, &token_addr, &500, &deadline);

    let result = client.try_refund(&sender, &id);
    assert_eq!(result, Err(Ok(Error::DeadlineNotReached)));
}

#[test]
fn test_wrong_recipient_cannot_claim() {
    let env = Env::default();
    env.mock_all_auths();
    let (sender, recipient, token_addr, _contract_id, _asset, _token_client, client) = setup(&env);
    let imposter = Address::generate(&env);

    let id = client.create_escrow(&sender, &recipient, &token_addr, &500, &0);
    let result = client.try_claim(&imposter, &id);
    assert_eq!(result, Err(Ok(Error::NotAuthorized)));
}

#[test]
fn test_cannot_double_claim() {
    let env = Env::default();
    env.mock_all_auths();
    let (sender, recipient, token_addr, _contract_id, _asset, _token_client, client) = setup(&env);

    let id = client.create_escrow(&sender, &recipient, &token_addr, &500, &0);
    client.claim(&recipient, &id);

    let result = client.try_claim(&recipient, &id);
    assert_eq!(result, Err(Ok(Error::AlreadySettled)));
}
