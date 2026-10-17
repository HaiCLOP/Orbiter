pub mod downloader;
pub mod separator;

use serde::{Deserialize, Serialize};

pub const DEMUCS_MODEL_FILENAME: &str = "htdemucs_fp16weights.onnx";
pub const DEMUCS_MODEL_URL: &str =
    "https://huggingface.co/StemSplitio/htdemucs-onnx/resolve/main/htdemucs_fp16weights.onnx";
pub const DEMUCS_EXPECTED_SHA256: &str =
    "d05c269d0178d2a72ad484b10b11dd370193fc923201c3b27a99f848745db70a";
pub const DEMUCS_EXPECTED_SIZE_BYTES: u64 = 165_612_636; // ~166 MB

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemModelStatus {
    pub is_downloaded: bool,
    pub model_path: String,
    pub file_size_bytes: u64,
    pub execution_provider: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDownloadProgress {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percentage: f32,
    pub status: String, // "downloading" | "verifying" | "finished" | "error"
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemSeparationProgress {
    pub current_chunk: usize,
    pub total_chunks: usize,
    pub percentage: f32,
    pub elapsed_sec: f32,
    pub eta_sec: f32,
    pub status: String, // "resampling" | "separating" | "reconstructing" | "saving" | "finished" | "cancelled" | "error"
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeparatedStemInfo {
    pub id: String, // "vocals" | "drums" | "bass" | "other"
    pub name: String,
    pub file_path: String,
    pub duration: f64,
    pub sample_rate: u32,
    pub peaks: Vec<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemSeparationResult {
    pub stems: Vec<SeparatedStemInfo>,
    pub elapsed_sec: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StemSeparationSettings {
    pub output_directory: Option<String>,
}
