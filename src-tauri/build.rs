fn main() {
    // Check that sidecar binaries exist (gives clear error early)
    let target_triple = std::env::var("TARGET").unwrap_or_else(|_| "x86_64-pc-windows-msvc".into());
    let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let binaries_dir = manifest_dir.join("binaries");
    let sidecars = [
        format!("bili_worker-{}.exe", target_triple),
        format!("asr_worker-{}.exe", target_triple),
        format!("ffmpeg-{}.exe", target_triple),
    ];
    let mut missing = Vec::new();
    for s in &sidecars {
        if !binaries_dir.join(s).exists() {
            missing.push(s.clone());
        }
    }
    if !missing.is_empty() {
        eprintln!("\n  ========================================");
        eprintln!("  Missing sidecar binaries in {}", binaries_dir.display());
        for m in &missing {
            eprintln!("    - {}", m);
        }
        eprintln!("  Run: python scripts/setup_dev.py");
        eprintln!("  ========================================\n");
    }
    tauri_build::build();
}
