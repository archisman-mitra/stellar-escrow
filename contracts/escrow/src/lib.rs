#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, token, Address, Env, symbol_short,
};

#[derive(Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[contracttype]
pub enum Status {
    Locked = 0,
    Claimed = 1,
    Refunded = 2,
}

#[derive(Clone)]
#[contracttype]
pub struct Escrow {
    pub id: u32,
    pub sender: Address,
    pub recipient: Address,
    pub token: Address,
    pub amount: i128,
    pub deadline: u64, // ledger timestamp (unix seconds); 0 = no deadline / not refundable
    pub status: Status,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Escrow(u32),
    Count,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum Error {
    NotFound = 1,
    NotAuthorized = 2,
    AlreadySettled = 3,
    DeadlineNotReached = 4,
    NoDeadlineSet = 5,
    InvalidAmount = 6,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Sender locks funds for recipient. This is the inter-contract call:
    /// we invoke the Stellar Asset Contract's transfer fn to pull the
    /// sender's tokens into this contract's custody, atomically with creation.
    /// deadline = 0 means no refund is ever possible (pure one-way payment).
    pub fn create_escrow(
        env: Env,
        sender: Address,
        recipient: Address,
        token: Address,
        amount: i128,
        deadline: u64,
    ) -> Result<u32, Error> {
        sender.require_auth();

        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }

        let count: u32 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let id = count + 1;

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&sender, &env.current_contract_address(), &amount);

        let escrow = Escrow {
            id,
            sender: sender.clone(),
            recipient: recipient.clone(),
            token,
            amount,
            deadline,
            status: Status::Locked,
        };

        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);
        env.storage().instance().set(&DataKey::Count, &id);

        env.events().publish((symbol_short!("created"), id), (sender, recipient, amount));
        Ok(id)
    }

    /// Recipient claims the locked funds at any time before/without needing a deadline.
    pub fn claim(env: Env, recipient: Address, id: u32) -> Result<(), Error> {
        recipient.require_auth();
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(Error::NotFound)?;

        if escrow.recipient != recipient {
            return Err(Error::NotAuthorized);
        }
        if escrow.status != Status::Locked {
            return Err(Error::AlreadySettled);
        }

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &recipient, &escrow.amount);

        escrow.status = Status::Claimed;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);

        env.events().publish((symbol_short!("claimed"), id), recipient);
        Ok(())
    }

    /// Sender reclaims funds, only after the deadline has passed.
    pub fn refund(env: Env, sender: Address, id: u32) -> Result<(), Error> {
        sender.require_auth();
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&DataKey::Escrow(id))
            .ok_or(Error::NotFound)?;

        if escrow.sender != sender {
            return Err(Error::NotAuthorized);
        }
        if escrow.status != Status::Locked {
            return Err(Error::AlreadySettled);
        }
        if escrow.deadline == 0 {
            return Err(Error::NoDeadlineSet);
        }
        if env.ledger().timestamp() < escrow.deadline {
            return Err(Error::DeadlineNotReached);
        }

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &sender, &escrow.amount);

        escrow.status = Status::Refunded;
        env.storage().persistent().set(&DataKey::Escrow(id), &escrow);

        env.events().publish((symbol_short!("refunded"), id), sender);
        Ok(())
    }

    pub fn get_escrow(env: Env, id: u32) -> Option<Escrow> {
        env.storage().persistent().get(&DataKey::Escrow(id))
    }

    pub fn get_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }
}

mod test;
