// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use can_i_run_ai::{benchmark, engine, hardware, models, store};

use benchmark::runtime::RuntimeKind;
use hardware::HardwareInfo;
use tauri::Manager;

/// History database lives in the OS app-data directory, so it
/// survives app updates and reinstalls that keep user data.
fn db_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("benchmarks.db"))
}

#[tauri::command]
fn get_hardware_info() -> HardwareInfo {
    hardware::detect_hardware()
}

#[tauri::command]
fn list_models() -> Result<models::ModelDatabase, String> {
    models::load()
}

/// Compatibility reports for every model at every supported
/// quantization, computed against this machine's hardware. One IPC
/// call keeps quantization switching purely a frontend concern.
#[tauri::command]
fn evaluate_models(context_length: usize) -> Result<Vec<engine::ModelEvaluation>, String> {
    let db = models::load()?;
    let hw = hardware::detect_hardware();
    Ok(engine::evaluate_all(&db.models, &hw, context_length))
}

/// Probe every supported local runtime (Ollama, LM Studio, llama.cpp).
/// Offline runtimes are reported rather than skipped so the UI can
/// show how to start each one.
#[tauri::command]
async fn list_runtimes() -> Vec<benchmark::runtime::RuntimeStatus> {
    benchmark::runtime::detect_runtimes().await
}

#[tauri::command]
async fn run_runtime_benchmark(
    app: tauri::AppHandle,
    runtime: String,
    model: String,
) -> Result<benchmark::BenchmarkResult, String> {
    let kind =
        RuntimeKind::from_id(&runtime).ok_or_else(|| format!("Unknown runtime: {runtime}"))?;
    let result = benchmark::runner::run_benchmark(kind, &model).await?;

    // Local-first persistence: history never leaves the machine, and
    // a storage failure must not fail an otherwise successful run.
    if let Ok(path) = db_path(&app) {
        if let Ok(conn) = store::open(&path) {
            let hw = hardware::detect_hardware();
            let _ = store::insert(&conn, &result, &hw);
        }
    }
    Ok(result)
}

#[tauri::command]
fn get_history(
    app: tauri::AppHandle,
    limit: Option<u32>,
) -> Result<Vec<store::HistoryEntry>, String> {
    let conn = store::open(&db_path(&app)?)?;
    store::list(&conn, limit.unwrap_or(100))
}

#[tauri::command]
fn delete_history_entry(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let conn = store::open(&db_path(&app)?)?;
    store::delete(&conn, id)
}

#[tauri::command]
fn clear_history(app: tauri::AppHandle) -> Result<(), String> {
    let conn = store::open(&db_path(&app)?)?;
    store::clear(&conn)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_hardware_info,
            list_models,
            evaluate_models,
            list_runtimes,
            run_runtime_benchmark,
            get_history,
            delete_history_entry,
            clear_history
        ])
        .run(tauri::generate_context!())
        .expect("error while running Can I Run AI application");
}
