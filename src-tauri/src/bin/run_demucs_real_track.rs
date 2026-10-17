use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Instant;

use orbiter_lib::decode::decode_audio_file;
use orbiter_lib::stems::downloader::{
    check_model_status, detect_execution_provider, download_model, get_model_path,
};
use orbiter_lib::stems::separator::run_stem_separation;
use orbiter_lib::stems::StemSeparationSettings;
use sha2::{Digest, Sha256};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    tauri::async_runtime::block_on(async_main())
}

async fn async_main() -> Result<(), Box<dyn std::error::Error>> {
    println!("============================================================");
    println!("     Orbiter Demucs v4 Real Song End-to-End Test Runner      ");
    println!("============================================================\n");

    let provider = detect_execution_provider();
    println!("[1/5] Hardware Execution Provider: {}", provider);

    // 1. Check or Download Model
    let status = check_model_status();
    let model_path = get_model_path();
    println!("[2/5] Model path: {}", model_path.display());

    if !status.is_downloaded {
        println!("      Model not found on disk. Initiating first-use download from Hugging Face...");
        let dl_start = Instant::now();
        let cancel_flag = Arc::new(AtomicBool::new(false));
        download_model(None, cancel_flag).await?;
        println!("      Download completed in {:.2}s!", dl_start.elapsed().as_secs_f32());
    } else {
        println!("      Model already exists on disk ({} bytes).", status.file_size_bytes);
    }

    // 2. Verify SHA-256 Integrity directly on disk
    print!("      Verifying SHA-256 on disk... ");
    let mut file = std::fs::File::open(&model_path)?;
    let mut hasher = Sha256::new();
    std::io::copy(&mut file, &mut hasher)?;
    let hash = format!("{:x}", hasher.finalize());
    println!("OK! ({})", hash);

    assert_eq!(
        hash,
        "d05c269d0178d2a72ad484b10b11dd370193fc923201c3b27a99f848745db70a",
        "SHA-256 hash must match expected model weights!"
    );

    // 3. Select Real Audio File
    let audio_path = r"C:\Users\AMIT SRIVASTAVA\Downloads\papa.mp3";
    if !Path::new(audio_path).exists() {
        return Err(format!("Audio file not found at: {}", audio_path).into());
    }

    println!("\n[3/5] Decoding real song: {}", audio_path);
    let dec_start = Instant::now();
    let (buffer, format_name) = decode_audio_file(audio_path)?;
    println!(
        "      Decoded in {:.2}s: format={}, duration={:.2}s ({:.1} min), sample_rate={} Hz, channels={}",
        dec_start.elapsed().as_secs_f32(),
        format_name,
        buffer.duration,
        buffer.duration / 60.0,
        buffer.sample_rate,
        buffer.channels
    );

    // 4. Run Stem Separation Inference
    let output_dir = r"C:\Users\AMIT SRIVASTAVA\Downloads\papa_stems";
    println!("\n[4/5] Running Demucs v4 chunked inference into: {}", output_dir);
    println!("      Starting background inference pipeline...");

    let cancel_flag = Arc::new(AtomicBool::new(false));
    let settings = StemSeparationSettings {
        output_directory: Some(output_dir.to_string()),
    };

    let sep_start = Instant::now();
    let result = run_stem_separation(
        None,
        Arc::new(buffer),
        audio_path.to_string(),
        settings,
        cancel_flag,
    )?;
    let total_elapsed = sep_start.elapsed().as_secs_f32();

    println!("\n[5/5] Stem Separation Pipeline Finished!");
    println!("      Total Wall-Clock Time: {:.2}s ({:.1} min)", total_elapsed, total_elapsed / 60.0);
    println!("      Stems separated: {}", result.stems.len());

    for stem in &result.stems {
        let meta = std::fs::metadata(&stem.file_path)?;
        println!(
            "      - [{:^6}] File: {} ({:.2} MB, duration: {:.2}s)",
            stem.name,
            Path::new(&stem.file_path).file_name().unwrap().to_string_lossy(),
            meta.len() as f64 / (1024.0 * 1024.0),
            stem.duration
        );
    }

    println!("\n============================================================");
    println!("                  ALL CHECKS PASSED                         ");
    println!("============================================================");

    Ok(())
}
