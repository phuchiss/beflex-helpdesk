use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use crate::{AppError, AppState};

pub async fn require_auth(
    State(state): State<AppState>,
    mut req: Request,
    next: Next,
) -> Result<Response, AppError> {
    let token = req
        .headers()
        .get("Authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or_else(|| AppError::Unauthorized("Missing or invalid token".to_string()))?;

    let claims = crate::services::auth::verify_token(token, &state.config.jwt_secret)
        .map_err(|_| AppError::Unauthorized("Invalid token".to_string()))?;

    req.extensions_mut().insert(claims);
    Ok(next.run(req).await)
}
