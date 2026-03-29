use axum::{Router, middleware, routing::{get, post, put, delete}};
use crate::AppState;

pub mod auth;
pub mod attachments;
pub mod comments;
pub mod dashboard;
pub mod email_accounts;
pub mod projects;
pub mod reports;
pub mod teams;
pub mod tickets;
pub mod users;

async fn health_check() -> &'static str {
    "OK"
}

pub fn create_router(state: AppState) -> Router {
    let public_routes = Router::new()
        .route("/health", get(health_check))
        .route("/auth/login", post(auth::login))
        .route("/auth/register", post(auth::register))
        .route("/auth/refresh", post(auth::refresh));

    let protected_routes = Router::new()
        .route("/auth/me", get(auth::me))
        .route("/auth/logout", post(auth::logout))
        .route("/auth/change-password", put(auth::change_password))
        .route("/users", get(users::list_users).post(users::create_user))
        .route("/users/:id", get(users::get_user).put(users::update_user).delete(users::delete_user))
        .route("/tickets", get(tickets::list_tickets).post(tickets::create_ticket))
        .route("/tickets/:id", get(tickets::get_ticket).put(tickets::update_ticket).delete(tickets::delete_ticket))
        .route("/tickets/:id/assign", post(tickets::assign_ticket))
        .route("/tickets/:id/history", get(tickets::get_ticket_history))
        .route("/tickets/:id/participants", get(tickets::list_participants).post(tickets::add_participant))
        .route("/tickets/:id/participants/:user_id", delete(tickets::remove_participant))
        .route("/tickets/:ticket_id/comments", get(comments::list_comments).post(comments::create_comment))
        .route("/tickets/:ticket_id/comments/:id", put(comments::update_comment).delete(comments::delete_comment))
        .route("/attachments", post(attachments::upload_attachment))
        .route("/attachments/:id/download", get(attachments::download_attachment))
        .route("/attachments/:id", delete(attachments::delete_attachment))
        .route("/email-accounts", get(email_accounts::list_email_accounts).post(email_accounts::create_email_account))
        .route("/email-accounts/:id", get(email_accounts::get_email_account).put(email_accounts::update_email_account).delete(email_accounts::delete_email_account))
        .route("/email-accounts/:id/test", post(email_accounts::test_email_account))
        .route("/teams", get(teams::list_teams).post(teams::create_team))
        .route("/teams/:id", get(teams::get_team).put(teams::update_team).delete(teams::delete_team))
        .route("/teams/:id/members", post(teams::add_team_member))
        .route("/teams/:id/members/:user_id", delete(teams::remove_team_member))
        .route("/categories", get(teams::list_categories).post(teams::create_category))
        .route("/categories/:id", put(teams::update_category).delete(teams::delete_category))
        .route("/tags", get(teams::list_tags).post(teams::create_tag))
        .route("/tags/:id", delete(teams::delete_tag))
        .route("/projects", get(projects::list_projects).post(projects::create_project))
        .route("/projects/:id", put(projects::update_project).delete(projects::delete_project))
        .route("/dashboard/stats", get(dashboard::get_stats))
        .route("/reports", get(reports::get_report))
        .layer(middleware::from_fn_with_state(state.clone(), crate::middleware::auth::require_auth));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .with_state(state)
}
