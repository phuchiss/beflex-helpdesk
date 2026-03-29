use std::path::PathBuf;
use chrono::Utc;
use uuid::Uuid;

pub struct FileInfo {
    pub filename: String,
    pub storage_path: String,
    pub mime_type: String,
    pub file_size: i64,
}

pub fn generate_storage_path(original_filename: &str) -> (String, String) {
    let now = Utc::now();
    let uuid = Uuid::new_v4();
    let ext = std::path::Path::new(original_filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("bin");
    let filename = format!("{}.{}", uuid, ext);
    let rel_path = format!("{}/{}/{}", now.format("%Y"), now.format("%m"), filename);
    (rel_path, filename)
}

pub async fn save_file(upload_dir: &str, data: &[u8], original_filename: &str, mime_type: &str) -> anyhow::Result<FileInfo> {
    let (rel_path, filename) = generate_storage_path(original_filename);
    let full_path = PathBuf::from(upload_dir).join(&rel_path);
    
    if let Some(parent) = full_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(&full_path, data).await?;
    
    Ok(FileInfo {
        filename,
        storage_path: rel_path,
        mime_type: mime_type.to_string(),
        file_size: data.len() as i64,
    })
}

pub async fn delete_file(upload_dir: &str, storage_path: &str) -> anyhow::Result<()> {
    let full_path = PathBuf::from(upload_dir).join(storage_path);
    if full_path.exists() {
        tokio::fs::remove_file(full_path).await?;
    }
    Ok(())
}

pub fn get_full_path(upload_dir: &str, storage_path: &str) -> PathBuf {
    PathBuf::from(upload_dir).join(storage_path)
}
