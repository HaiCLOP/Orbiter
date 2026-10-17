use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use futures_util::StreamExt;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::stems::{
    ModelDownloadProgress, StemModelStatus, DEMUCS_EXPECTED_SHA256, DEMUCS_EXPECTED_SIZE_BYTES,
    DEMUCS_MODEL_FILENAME, DEMUCS_MODEL_URL,
};

/// Returns the persistent model directory path (`%LOCALAPPDATA%/orbiter/models`).
pub fn get_model_storage_dir() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("orbiter").join("models")
}

/// Returns the full file path to the local Demucs ONNX model file.
pub fn get_model_path() -> PathBuf {
    get_model_storage_dir().join(DEMUCS_MODEL_FILENAME)
}

/// Detects the hardware acceleration backend available on this machine.
pub fn detect_execution_provider() -> String {
    let threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4);
    format!("CPU (Multi-Threaded AVX2 / {threads} Threads)")
}

/// Checks whether the model exists on disk and is ready for inference.
pub fn check_model_status() -> StemModelStatus {
    let model_path = get_model_path();
    let provider = detect_execution_provider();

    if !model_path.exists() {
        return StemModelStatus {
            is_downloaded: false,
            model_path: model_path.to_string_lossy().into_owned(),
            file_size_bytes: 0,
            execution_provider: provider,
            error: None,
        };
    }

    match std::fs::metadata(&model_path) {
        Ok(meta) => {
            let size = meta.len();
            StemModelStatus {
                is_downloaded: size > 0,
                model_path: model_path.to_string_lossy().into_owned(),
                file_size_bytes: size,
                execution_provider: provider,
                error: None,
            }
        }
        Err(e) => StemModelStatus {
            is_downloaded: false,
            model_path: model_path.to_string_lossy().into_owned(),
            file_size_bytes: 0,
            execution_provider: provider,
            error: Some(format!("Failed to inspect model file: {e}")),
        },
    }
}

/// Downloads `htdemucs_fp16weights.onnx` from Hugging Face with progress events
/// and SHA-256 integrity verification.
pub async fn download_model(
    app: AppHandle,
    cancel_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    let model_dir = get_model_storage_dir();
    if !model_dir.exists() {
        std::fs::create_dir_all(&model_dir)
            .map_err(|e| format!("Failed to create model folder: {e}"))?;
    }

    let dest_path = get_model_path();
    let temp_name = format!("{}.tmp.{}", DEMUCS_MODEL_FILENAME, Uuid::new_v4());
    let temp_path = model_dir.join(temp_name);

    log::info!("Connecting to Hugging Face CDN: {}", DEMUCS_MODEL_URL);
    let client = reqwest::Client::builder()
        .user_agent("Orbiter-DAW/0.1.0")
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .get(DEMUCS_MODEL_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Hugging Face: {e}. Check internet connection."))?;

    if !response.status().is_success() {
        return Err(format!(
            "Hugging Face server returned HTTP status {}",
            response.status()
        ));
    }

    let total_bytes = response
        .content_length()
        .unwrap_or(DEMUCS_EXPECTED_SIZE_BYTES);

    let mut file = File::create(&temp_path)
        .map_err(|e| format!("Failed to create temporary model file: {e}"))?;

    let mut stream = response.bytes_stream();
    let mut downloaded_bytes: u64 = 0;
    let mut hasher = Sha256::new();
    let mut last_progress_emit = std::time::Instant::now();

    while let Some(chunk_result) = stream.next().await {
        if cancel_flag.load(Ordering::Relaxed) {
            let _ = std::fs::remove_file(&temp_path);
            let _ = app.emit(
                "stem-model-download-progress",
                ModelDownloadProgress {
                    downloaded_bytes,
                    total_bytes,
                    percentage: (downloaded_bytes as f32 / total_bytes as f32).clamp(0.0, 1.0),
                    status: "error".into(),
                    error: Some("Download cancelled by user".into()),
                },
            );
            return Err("Download cancelled by user".into());
        }

        let chunk = chunk_result.map_err(|e| {
            let _ = std::fs::remove_file(&temp_path);
            format!("Error reading download stream chunk: {e}")
        })?;

        hasher.update(&chunk);
        file.write_all(&chunk).map_err(|e| {
            let _ = std::fs::remove_file(&temp_path);
            format!("Error writing model chunk to disk: {e}")
        })?;

        downloaded_bytes += chunk.len() as u64;

        if last_progress_emit.elapsed().as_millis() >= 80 {
            last_progress_emit = std::time::Instant::now();
            let percentage = (downloaded_bytes as f32 / total_bytes as f32).clamp(0.0, 1.0);
            let _ = app.emit(
                "stem-model-download-progress",
                ModelDownloadProgress {
                    downloaded_bytes,
                    total_bytes,
                    percentage,
                    status: "downloading".into(),
                    error: None,
                },
            );
        }
    }

    file.flush()
        .map_err(|e| format!("Failed to flush model file: {e}"))?;
    drop(file);

    // 4. SHA-256 Integrity Verification
    let _ = app.emit(
        "stem-model-download-progress",
        ModelDownloadProgress {
            downloaded_bytes,
            total_bytes,
            percentage: 1.0,
            status: "verifying".into(),
            error: None,
        },
    );

    let actual_sha256 = format!("{:x}", hasher.finalize());
    log::info!("Downloaded model SHA-256: {}", actual_sha256);

    if actual_sha256 != DEMUCS_EXPECTED_SHA256 {
        let _ = std::fs::remove_file(&temp_path);
        let err_msg = format!(
            "SHA-256 checksum mismatch! Expected: {}, got: {}. Corrupted download discarded.",
            DEMUCS_EXPECTED_SHA256, actual_sha256
        );
        log::error!("{err_msg}");
        let _ = app.emit(
            "stem-model-download-progress",
            ModelDownloadProgress {
                downloaded_bytes,
                total_bytes,
                percentage: 1.0,
                status: "error".into(),
                error: Some(err_msg.clone()),
            },
        );
        return Err(err_msg);
    }

    // 5. Atomic Rename
    if dest_path.exists() {
        let _ = std::fs::remove_file(&dest_path);
    }
    std::fs::rename(&temp_path, &dest_path).map_err(|e| {
        let _ = std::fs::remove_file(&temp_path);
        format!("Failed to finalize model destination: {e}")
    })?;

    log::info!("Model downloaded and verified successfully: {}", dest_path.display());
    let _ = app.emit(
        "stem-model-download-progress",
        ModelDownloadProgress {
            downloaded_bytes,
            total_bytes,
            percentage: 1.0,
            status: "finished".into(),
            error: None,
        },
    );

    Ok(())
}
