use std::{collections::HashMap, sync::Arc};

use axum::{
    Json,
    body::Body,
    extract::State,
    http::{Request, StatusCode, header::AUTHORIZATION},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use sha3::{Digest, Keccak256};
use time::{Duration, OffsetDateTime, format_description::well_known::Rfc3339};
use tokio::sync::RwLock;
use uuid::Uuid;

const CHALLENGE_LIFETIME: Duration = Duration::minutes(5);
const SESSION_LIFETIME: Duration = Duration::hours(12);

#[derive(Clone, Debug)]
pub struct AuthPrincipal {
    pub owner_id: String,
}

#[derive(Clone)]
pub struct AuthService {
    challenges: Arc<RwLock<HashMap<String, PendingChallenge>>>,
    sessions: Arc<RwLock<HashMap<String, Session>>>,
    domain: Arc<str>,
    uri: Arc<str>,
    chain_id: u64,
}

#[derive(Clone, Debug)]
struct PendingChallenge {
    message: String,
    expires_at: OffsetDateTime,
}

#[derive(Clone, Debug)]
struct Session {
    owner_id: String,
    expires_at: OffsetDateTime,
}

#[derive(Debug, Deserialize)]
pub struct ChallengeInput {
    pub address: String,
}

#[derive(Debug, Serialize)]
pub struct ChallengeOutput {
    pub address: String,
    pub message: String,
    pub expires_at: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyInput {
    pub address: String,
    pub signature: String,
}

#[derive(Debug, Serialize)]
pub struct SessionOutput {
    pub access_token: String,
    pub token_type: &'static str,
    pub expires_at: String,
    pub owner_id: String,
}

#[derive(Debug)]
pub struct AuthError {
    status: StatusCode,
    message: &'static str,
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.message)
    }
}

impl std::error::Error for AuthError {}

impl AuthError {
    fn bad_request(message: &'static str) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            message,
        }
    }

    fn unauthorized(message: &'static str) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            message,
        }
    }
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(serde_json::json!({"error": self.message})),
        )
            .into_response()
    }
}

impl AuthService {
    pub fn new(domain: String, uri: String, chain_id: u64) -> Result<Self, AuthError> {
        if domain.trim().is_empty() || domain.contains(['\n', '\r']) {
            return Err(AuthError::bad_request("authentication domain is invalid"));
        }
        let parsed_uri = reqwest::Url::parse(&uri)
            .map_err(|_| AuthError::bad_request("authentication URI is invalid"))?;
        if !matches!(parsed_uri.scheme(), "http" | "https") || parsed_uri.host_str().is_none() {
            return Err(AuthError::bad_request(
                "authentication URI must use HTTP(S)",
            ));
        }
        Ok(Self {
            challenges: Arc::new(RwLock::new(HashMap::new())),
            sessions: Arc::new(RwLock::new(HashMap::new())),
            domain: domain.into(),
            uri: uri.into(),
            chain_id,
        })
    }

    pub async fn create_challenge(&self, raw_address: &str) -> Result<ChallengeOutput, AuthError> {
        let address = normalize_address(raw_address)?;
        let now = OffsetDateTime::now_utc();
        let expires_at = now + CHALLENGE_LIFETIME;
        let nonce = Uuid::new_v4().simple().to_string();
        let issued = now
            .format(&Rfc3339)
            .map_err(|_| AuthError::bad_request("could not format challenge time"))?;
        let expires = expires_at
            .format(&Rfc3339)
            .map_err(|_| AuthError::bad_request("could not format challenge expiry"))?;
        let message = format!(
            "{} wants you to sign in with your Ethereum account:\n{}\n\nSign in to DONADS. This request does not authorize a transaction.\n\nURI: {}\nVersion: 1\nChain ID: {}\nNonce: {}\nIssued At: {}\nExpiration Time: {}",
            self.domain, address, self.uri, self.chain_id, nonce, issued, expires
        );
        self.challenges.write().await.insert(
            address.clone(),
            PendingChallenge {
                message: message.clone(),
                expires_at,
            },
        );
        Ok(ChallengeOutput {
            address,
            message,
            expires_at: expires,
        })
    }

    pub async fn verify(&self, input: VerifyInput) -> Result<SessionOutput, AuthError> {
        let address = normalize_address(&input.address)?;
        let challenge = self
            .challenges
            .write()
            .await
            .remove(&address)
            .ok_or_else(|| AuthError::unauthorized("challenge is missing or already used"))?;
        if challenge.expires_at <= OffsetDateTime::now_utc() {
            return Err(AuthError::unauthorized("challenge has expired"));
        }
        let recovered = recover_address(&challenge.message, &input.signature)?;
        if recovered != address {
            return Err(AuthError::unauthorized(
                "wallet signature does not match the requested address",
            ));
        }

        let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
        let expires_at = OffsetDateTime::now_utc() + SESSION_LIFETIME;
        self.sessions.write().await.insert(
            token.clone(),
            Session {
                owner_id: address.clone(),
                expires_at,
            },
        );
        Ok(SessionOutput {
            access_token: token,
            token_type: "Bearer",
            expires_at: expires_at
                .format(&Rfc3339)
                .map_err(|_| AuthError::bad_request("could not format session expiry"))?,
            owner_id: address,
        })
    }

    async fn authenticate(&self, token: &str) -> Result<AuthPrincipal, AuthError> {
        let now = OffsetDateTime::now_utc();
        let session = self
            .sessions
            .read()
            .await
            .get(token)
            .cloned()
            .ok_or_else(|| AuthError::unauthorized("session is invalid"))?;
        if session.expires_at <= now {
            self.sessions.write().await.remove(token);
            return Err(AuthError::unauthorized("session has expired"));
        }
        Ok(AuthPrincipal {
            owner_id: session.owner_id,
        })
    }
}

pub async fn require_auth(
    State(auth): State<AuthService>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, AuthError> {
    let value = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AuthError::unauthorized("Authorization bearer token is required"))?;
    let token = value
        .strip_prefix("Bearer ")
        .filter(|token| token.len() == 64 && token.chars().all(|c| c.is_ascii_hexdigit()))
        .ok_or_else(|| AuthError::unauthorized("Authorization bearer token is invalid"))?;
    let principal = auth.authenticate(token).await?;
    request.extensions_mut().insert(principal);
    Ok(next.run(request).await)
}

fn normalize_address(value: &str) -> Result<String, AuthError> {
    let value = value.trim();
    let bytes = value
        .strip_prefix("0x")
        .filter(|hex| hex.len() == 40 && hex.chars().all(|c| c.is_ascii_hexdigit()))
        .ok_or_else(|| AuthError::bad_request("wallet address is invalid"))?;
    Ok(format!("0x{}", bytes.to_ascii_lowercase()))
}

fn recover_address(message: &str, raw_signature: &str) -> Result<String, AuthError> {
    use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

    let bytes = hex::decode(raw_signature.trim().strip_prefix("0x").unwrap_or(""))
        .map_err(|_| AuthError::unauthorized("wallet signature is invalid"))?;
    if bytes.len() != 65 {
        return Err(AuthError::unauthorized("wallet signature is invalid"));
    }
    let signature = Signature::from_slice(&bytes[..64])
        .map_err(|_| AuthError::unauthorized("wallet signature is invalid"))?;
    if signature.normalize_s().is_some() {
        return Err(AuthError::unauthorized("wallet signature is non-canonical"));
    }
    let recovery_byte = match bytes[64] {
        0 | 1 => bytes[64],
        27 | 28 => bytes[64] - 27,
        _ => return Err(AuthError::unauthorized("wallet recovery id is invalid")),
    };
    let recovery_id = RecoveryId::try_from(recovery_byte)
        .map_err(|_| AuthError::unauthorized("wallet recovery id is invalid"))?;
    let prefix = format!("\x19Ethereum Signed Message:\n{}", message.len());
    let hash = Keccak256::new()
        .chain_update(prefix.as_bytes())
        .chain_update(message.as_bytes())
        .finalize();
    let key = VerifyingKey::recover_from_prehash(hash.as_ref(), &signature, recovery_id)
        .map_err(|_| AuthError::unauthorized("wallet signature could not be recovered"))?;
    let encoded = key.to_encoded_point(false);
    let digest = Keccak256::digest(&encoded.as_bytes()[1..]);
    Ok(format!("0x{}", hex::encode(&digest[12..])))
}

#[cfg(test)]
mod tests {
    use k256::ecdsa::SigningKey;
    use sha3::{Digest, Keccak256};

    use super::{AuthService, VerifyInput};

    #[tokio::test]
    async fn challenge_is_chain_bound_short_lived_and_replaced_per_address() {
        let auth = AuthService::new(
            "localhost:3000".into(),
            "http://localhost:3000".into(),
            10_143,
        )
        .expect("auth config");
        let first = auth
            .create_challenge("0x1111111111111111111111111111111111111111")
            .await
            .expect("challenge");
        let second = auth
            .create_challenge("0x1111111111111111111111111111111111111111")
            .await
            .expect("replacement");
        assert!(first.message.contains("Chain ID: 10143"));
        assert!(first.message.contains("does not authorize a transaction"));
        assert_ne!(first.message, second.message);
    }

    #[tokio::test]
    async fn valid_personal_signature_creates_a_single_wallet_session() {
        let signing_key = SigningKey::from_bytes((&[7_u8; 32]).into()).expect("test key");
        let encoded = signing_key.verifying_key().to_encoded_point(false);
        let public_hash = Keccak256::digest(&encoded.as_bytes()[1..]);
        let address = format!("0x{}", hex::encode(&public_hash[12..]));
        let auth = AuthService::new(
            "localhost:3000".into(),
            "http://localhost:3000".into(),
            10_143,
        )
        .expect("auth config");
        let challenge = auth.create_challenge(&address).await.expect("challenge");
        let prefix = format!("\x19Ethereum Signed Message:\n{}", challenge.message.len());
        let hash = Keccak256::new()
            .chain_update(prefix.as_bytes())
            .chain_update(challenge.message.as_bytes())
            .finalize();
        let (signature, recovery_id) = signing_key
            .sign_prehash_recoverable(hash.as_ref())
            .expect("sign challenge");
        let mut bytes = signature.to_bytes().to_vec();
        bytes.push(recovery_id.to_byte() + 27);
        let session = auth
            .verify(VerifyInput {
                address: address.clone(),
                signature: format!("0x{}", hex::encode(bytes)),
            })
            .await
            .expect("valid session");
        assert_eq!(session.owner_id, address);
        assert_eq!(session.access_token.len(), 64);
        assert!(
            auth.verify(VerifyInput {
                address: session.owner_id,
                signature: "0x00".into(),
            })
            .await
            .is_err(),
            "a challenge must be single use"
        );
    }
}
