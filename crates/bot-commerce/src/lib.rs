//! Crypto-native purchase preparation with explicit authorization and no simulated checkout.

use async_trait::async_trait;
use donads_core::{Bot, BotDescriptor, BotError, BotResult, Task};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::{SystemTime, UNIX_EPOCH};
use thiserror::Error;
use url::Url;

pub const AGENT_VERSION: &str = "commerce-crypto-intent-v1";
const MAX_OFFERS: usize = 10;

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CommerceInput {
    pub objective: String,
    pub budget_atomic: String,
    pub asset: String,
    pub offers: Vec<ProductOffer>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct ProductOffer {
    pub id: String,
    pub name: String,
    pub merchant: String,
    pub source_url: String,
    pub checkout_url: String,
    pub total_atomic: String,
    pub asset: String,
    pub in_stock: bool,
    pub rating: Option<f32>,
    pub evidence_note: String,
    pub crypto_payment_supported: bool,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CommerceState {
    AwaitingApproval,
    Authorized,
    Rejected,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CommerceAuditEvent {
    pub sequence: u32,
    pub event: String,
    pub detail: String,
    pub at_ms: u64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CommerceWorkflow {
    pub id: String,
    pub objective: String,
    pub state: CommerceState,
    pub selected_offer: ProductOffer,
    pub alternatives_considered: usize,
    pub budget_atomic: String,
    pub total_atomic: String,
    pub asset: String,
    pub approval_id: Option<String>,
    pub approved_at_ms: Option<u64>,
    pub audit_history: Vec<CommerceAuditEvent>,
}

#[derive(Debug, Error)]
pub enum CommerceTransitionError {
    #[error("commerce action conflicts with current state: {0}")]
    Conflict(String),
    #[error("invalid commerce action: {0}")]
    InvalidAction(String),
}

#[derive(Default)]
pub struct Commerce;

#[async_trait]
impl Bot for Commerce {
    fn descriptor(&self) -> BotDescriptor {
        BotDescriptor {
            id: "commerce",
            name: "Commerce",
            specialty: "Crypto-native merchant offer selection and approval",
            available: true,
        }
    }
    async fn execute(&self, task: &Task) -> Result<BotResult, BotError> {
        let input: CommerceInput = serde_json::from_value(task.input.clone()).map_err(|e| {
            BotError::InvalidInput(format!("Commerce requires structured crypto offers: {e}"))
        })?;
        let workflow = prepare_workflow(&input, &task.id.to_string())?;
        Ok(BotResult {
            summary: format!(
                "Commerce selected {} from {} for {} atomic units of {}. No payment or order has been executed.",
                workflow.selected_offer.name,
                workflow.selected_offer.merchant,
                workflow.total_atomic,
                workflow.asset
            ),
            data: json!({"workflow": workflow, "agent_version": AGENT_VERSION, "execution_available": false, "blocked_reason": "A verified crypto-accepting merchant adapter and Monad wallet signer are not configured."}),
        })
    }
}

pub fn prepare_workflow(
    input: &CommerceInput,
    task_id: &str,
) -> Result<CommerceWorkflow, BotError> {
    validate_input(input)?;
    let budget = parse_atomic(&input.budget_atomic, "budget_atomic")?;
    let selected = input
        .offers
        .iter()
        .filter(|o| {
            o.in_stock && o.crypto_payment_supported && o.asset.eq_ignore_ascii_case(&input.asset)
        })
        .filter_map(|o| {
            parse_atomic(&o.total_atomic, "total_atomic")
                .ok()
                .map(|total| (o, total))
        })
        .filter(|(_, total)| *total <= budget)
        .min_by_key(|(_, total)| *total)
        .map(|(o, _)| o.clone())
        .ok_or_else(|| {
            BotError::InvalidInput(
                "no in-stock, crypto-accepting offer fits the supplied asset and budget".into(),
            )
        })?;
    Ok(CommerceWorkflow {
        id: format!("commerce-{task_id}"),
        objective: input.objective.trim().to_owned(),
        state: CommerceState::AwaitingApproval,
        total_atomic: selected.total_atomic.clone(),
        asset: input.asset.trim().to_ascii_uppercase(),
        selected_offer: selected,
        alternatives_considered: input.offers.len(),
        budget_atomic: input.budget_atomic.clone(),
        approval_id: None,
        approved_at_ms: None,
        audit_history: vec![CommerceAuditEvent {
            sequence: 1,
            event: "offer_selected".into(),
            detail: "Eligible crypto offer selected; no transaction or merchant order was created."
                .into(),
            at_ms: unix_time_ms(),
        }],
    })
}

pub fn authorize(
    workflow: &mut CommerceWorkflow,
    approval_id: String,
    approved_total_atomic: &str,
) -> Result<(), CommerceTransitionError> {
    require_state(workflow, CommerceState::AwaitingApproval)?;
    if approved_total_atomic != workflow.total_atomic {
        return Err(CommerceTransitionError::InvalidAction(
            "approved total does not match the selected crypto amount".into(),
        ));
    }
    if approval_id.trim().is_empty() {
        return Err(CommerceTransitionError::InvalidAction(
            "approval id cannot be empty".into(),
        ));
    }
    workflow.approval_id = Some(approval_id);
    workflow.approved_at_ms = Some(unix_time_ms());
    workflow.state = CommerceState::Authorized;
    push_audit(
        workflow,
        "purchase_authorized",
        "User authorized the exact crypto offer. Execution remains blocked until a real wallet and merchant adapter are configured.",
    );
    Ok(())
}

pub fn reject(workflow: &mut CommerceWorkflow) -> Result<(), CommerceTransitionError> {
    require_state(workflow, CommerceState::AwaitingApproval)?;
    workflow.state = CommerceState::Rejected;
    push_audit(
        workflow,
        "purchase_rejected",
        "User rejected the proposal; no transaction was created.",
    );
    Ok(())
}

fn validate_input(input: &CommerceInput) -> Result<(), BotError> {
    if input.objective.trim().is_empty() || input.objective.len() > 2_000 {
        return Err(BotError::InvalidInput(
            "objective must contain between 1 and 2,000 characters".into(),
        ));
    }
    if input.asset.trim().is_empty() {
        return Err(BotError::InvalidInput("asset is required".into()));
    }
    parse_atomic(&input.budget_atomic, "budget_atomic")?;
    if input.offers.is_empty() || input.offers.len() > MAX_OFFERS {
        return Err(BotError::InvalidInput(format!(
            "offers must contain between 1 and {MAX_OFFERS} items"
        )));
    }
    for o in &input.offers {
        if o.id.trim().is_empty()
            || o.name.trim().is_empty()
            || o.merchant.trim().is_empty()
            || o.evidence_note.trim().is_empty()
            || o.asset.trim().is_empty()
        {
            return Err(BotError::InvalidInput(
                "every offer requires an id, name, merchant, asset, amount, and evidence note"
                    .into(),
            ));
        }
        parse_atomic(&o.total_atomic, "total_atomic")?;
        validate_url(&o.source_url, "source URL")?;
        validate_url(&o.checkout_url, "checkout URL")?;
        if o.rating.is_some_and(|r| !(0.0..=5.0).contains(&r)) {
            return Err(BotError::InvalidInput(
                "offer ratings must be between 0 and 5".into(),
            ));
        }
    }
    Ok(())
}

fn parse_atomic(value: &str, field: &str) -> Result<u128, BotError> {
    let value = value.trim();
    if value.is_empty() || value.len() > 38 || !value.chars().all(|c| c.is_ascii_digit()) {
        return Err(BotError::InvalidInput(format!(
            "{field} must be a positive integer in atomic token units"
        )));
    }
    let parsed = value
        .parse::<u128>()
        .map_err(|_| BotError::InvalidInput(format!("{field} is too large")))?;
    if parsed == 0 {
        return Err(BotError::InvalidInput(format!(
            "{field} must be greater than zero"
        )));
    }
    Ok(parsed)
}

fn validate_url(raw: &str, field: &str) -> Result<(), BotError> {
    let url = Url::parse(raw)
        .map_err(|_| BotError::InvalidInput(format!("{field} must be a valid URL")))?;
    if !matches!(url.scheme(), "http" | "https")
        || url.host_str().is_none()
        || !url.username().is_empty()
    {
        return Err(BotError::InvalidInput(format!(
            "{field} must use HTTP(S), include a host, and contain no credentials"
        )));
    }
    Ok(())
}

fn require_state(
    workflow: &CommerceWorkflow,
    expected: CommerceState,
) -> Result<(), CommerceTransitionError> {
    if workflow.state != expected {
        return Err(CommerceTransitionError::Conflict(format!(
            "expected {expected:?}, found {:?}",
            workflow.state
        )));
    }
    Ok(())
}
fn push_audit(workflow: &mut CommerceWorkflow, event: &str, detail: &str) {
    workflow.audit_history.push(CommerceAuditEvent {
        sequence: u32::try_from(workflow.audit_history.len() + 1).unwrap_or(u32::MAX),
        event: event.into(),
        detail: detail.into(),
        at_ms: unix_time_ms(),
    });
}
fn unix_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| u64::try_from(d.as_millis()).unwrap_or(u64::MAX))
}

#[cfg(test)]
mod tests {
    use super::{Commerce, CommerceState, authorize};
    use donads_core::{Bot, Task, TaskInput};
    use serde_json::json;
    fn task() -> Task {
        Task::queued(
            TaskInput {
                prompt: "Buy with MON".into(),
                bot: Some("commerce".into()),
                input: json!({"objective":"Buy a keyboard with MON","budget_atomic":"3000000000000000000","asset":"MON","offers":[{"id":"a","name":"Keyboard","merchant":"Crypto Store","source_url":"https://shop.example/a","checkout_url":"https://shop.example/a/checkout","total_atomic":"2500000000000000000","asset":"MON","in_stock":true,"rating":4.5,"evidence_note":"Merchant states native MON checkout.","crypto_payment_supported":true}]}),
            },
            "commerce".into(),
        )
    }
    #[tokio::test]
    async fn prepares_intent_without_claiming_execution() {
        let result = Commerce.execute(&task()).await.expect("intent");
        assert_eq!(result.data["execution_available"], false);
    }
    #[tokio::test]
    async fn approval_binds_exact_amount() {
        let result = Commerce.execute(&task()).await.expect("intent");
        let mut workflow =
            serde_json::from_value(result.data["workflow"].clone()).expect("workflow");
        assert!(authorize(&mut workflow, "approval-1".into(), "1").is_err());
        authorize(&mut workflow, "approval-1".into(), "2500000000000000000").expect("approval");
        assert_eq!(workflow.state, CommerceState::Authorized);
    }
}
