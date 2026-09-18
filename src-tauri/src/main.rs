// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod hardware;
mod compatibility;
mod benchmark;

#[tauri::command]
fn get_hardware_info() -> hardware::HardwareInfo {
    hardware::detect_hardware()
}

#[tauri::command]
async fn run_ollama_benchmark(model: String) -> Result<benchmark::ollama::BenchmarkResult, String> {
    benchmark::runner::run_benchmark(&model).await
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_hardware_info,
            run_ollama_benchmark
        ])
        .run(tauri::generate_context!())
        .expect("error while running Can I Run AI application");
}
