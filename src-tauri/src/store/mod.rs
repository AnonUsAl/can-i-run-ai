//! Local benchmark history, persisted in SQLite under the OS app-data
//! directory (docs/technical-route.md D7). Local-first: rows never
//! leave the machine; deletion is explicit.

use std::path::Path;

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::benchmark::BenchmarkResult;
use crate::hardware::HardwareInfo;

const SCHEMA_VERSION: i64 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: i64,
    /// Epoch milliseconds.
    pub created_at: u64,
    pub runtime: String,
    pub model: String,
    pub ttft_sec: f64,
    pub prompt_eval_tok_per_sec: f64,
    pub generation_tok_per_sec: f64,
    pub total_tokens: u64,
    pub total_duration_sec: f64,
    pub runs_completed: u32,
    /// One-line hardware description captured at run time.
    pub hardware_summary: String,
    /// Hash of the HardwareInfo captured at run time; rows sharing a
    /// fingerprint are directly comparable.
    pub hardware_fingerprint: String,
}

/// Stable short hash of a HardwareInfo snapshot.
pub fn fingerprint(hw: &HardwareInfo) -> String {
    use std::hash::{Hash, Hasher};
    let json = serde_json::to_string(hw).unwrap_or_default();
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    json.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Human-readable one-liner, e.g. "Intel i7-13650HX · RTX 4060 · 15.6 GB".
pub fn summary(hw: &HardwareInfo) -> String {
    format!(
        "{} · {} · {:.0} GB",
        hw.cpu.model.replace("(R)", "").replace("(TM)", "").trim(),
        hw.gpu.model,
        hw.memory.total_gb
    )
}

fn migrate(conn: &Connection) -> Result<(), String> {
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    if version >= SCHEMA_VERSION {
        return Ok(());
    }
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS benchmark_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at INTEGER NOT NULL,
            runtime TEXT NOT NULL,
            model TEXT NOT NULL,
            ttft_sec REAL NOT NULL,
            prompt_eval_tok_per_sec REAL NOT NULL,
            generation_tok_per_sec REAL NOT NULL,
            total_tokens INTEGER NOT NULL,
            total_duration_sec REAL NOT NULL,
            runs_completed INTEGER NOT NULL,
            ttft_min_sec REAL NOT NULL,
            ttft_max_sec REAL NOT NULL,
            generation_min_tok_per_sec REAL NOT NULL,
            generation_max_tok_per_sec REAL NOT NULL,
            hardware_fingerprint TEXT NOT NULL,
            hardware_summary TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_runs_created ON benchmark_runs(created_at DESC);
        PRAGMA user_version = 1;",
    )
    .map_err(|e| format!("migration failed: {e}"))?;
    Ok(())
}

/// Open (and if needed create/migrate) the history database.
pub fn open(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("cannot open history db: {e}"))?;
    conn.pragma_update(None, "journal_mode", "WAL").ok();
    migrate(&conn)?;
    Ok(conn)
}

pub fn insert(
    conn: &Connection,
    result: &BenchmarkResult,
    hw: &HardwareInfo,
) -> Result<(), String> {
    let created_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    conn.execute(
        "INSERT INTO benchmark_runs (
            created_at, runtime, model, ttft_sec, prompt_eval_tok_per_sec,
            generation_tok_per_sec, total_tokens, total_duration_sec, runs_completed,
            ttft_min_sec, ttft_max_sec, generation_min_tok_per_sec, generation_max_tok_per_sec,
            hardware_fingerprint, hardware_summary
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        params![
            created_at,
            result.runtime,
            result.model,
            result.ttft_sec,
            result.prompt_eval_tok_per_sec,
            result.generation_tok_per_sec,
            result.total_tokens,
            result.total_duration_sec,
            result.runs_completed,
            result.ttft_min_sec,
            result.ttft_max_sec,
            result.generation_min_tok_per_sec,
            result.generation_max_tok_per_sec,
            fingerprint(hw),
            summary(hw),
        ],
    )
    .map(|_| ())
    .map_err(|e| format!("history insert failed: {e}"))
}

pub fn list(conn: &Connection, limit: u32) -> Result<Vec<HistoryEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, created_at, runtime, model, ttft_sec, prompt_eval_tok_per_sec,
                    generation_tok_per_sec, total_tokens, total_duration_sec, runs_completed,
                    hardware_fingerprint, hardware_summary
             FROM benchmark_runs ORDER BY created_at DESC, id DESC LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![limit], |row| {
            Ok(HistoryEntry {
                id: row.get(0)?,
                created_at: row.get(1)?,
                runtime: row.get(2)?,
                model: row.get(3)?,
                ttft_sec: row.get(4)?,
                prompt_eval_tok_per_sec: row.get(5)?,
                generation_tok_per_sec: row.get(6)?,
                total_tokens: row.get(7)?,
                total_duration_sec: row.get(8)?,
                runs_completed: row.get(9)?,
                hardware_fingerprint: row.get(10)?,
                hardware_summary: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), String> {
    conn.execute("DELETE FROM benchmark_runs WHERE id = ?1", params![id])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

pub fn clear(conn: &Connection) -> Result<(), String> {
    conn.execute("DELETE FROM benchmark_runs", [])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::benchmark::BenchmarkResult;

    fn sample_result(model: &str, tok_per_sec: f64) -> BenchmarkResult {
        BenchmarkResult {
            model: model.to_string(),
            runtime: "ollama".into(),
            ttft_sec: 0.5,
            prompt_eval_tok_per_sec: 80.0,
            generation_tok_per_sec: tok_per_sec,
            total_tokens: 128,
            total_duration_sec: 7.0,
            sample_output: "ok".into(),
            timestamp: 0,
            runs_completed: 3,
            ttft_min_sec: 0.4,
            ttft_max_sec: 0.6,
            generation_min_tok_per_sec: tok_per_sec - 1.0,
            generation_max_tok_per_sec: tok_per_sec + 1.0,
        }
    }

    fn temp_db_path(tag: &str) -> std::path::PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!(
            "cira-test-{}-{}.db",
            tag,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        p
    }

    #[test]
    fn insert_list_delete_roundtrip() {
        let path = temp_db_path("roundtrip");
        let conn = open(&path).unwrap();
        let hw = HardwareInfo {
            platform: "test".into(),
            arch: "x86_64".into(),
            os_name: "test".into(),
            os_version: "0".into(),
            cpu: crate::hardware::CpuInfo {
                model: "Test CPU".into(),
                cores: 8,
                arch: "x86_64".into(),
                is_apple_silicon: false,
            },
            memory: crate::hardware::MemoryInfo {
                total_bytes: 17179869184,
                total_gb: 16.0,
                free_bytes: 8589934592,
                free_gb: 8.0,
                is_unified: false,
            },
            gpu: crate::hardware::GpuInfo {
                model: "Test GPU".into(),
                is_unified_memory: false,
                vram_gb: 8.0,
                metal_support: "CUDA".into(),
                vendor: "nvidia".into(),
                driver_version: None,
            },
            backends: vec!["CPU inference".into()],
        };

        insert(&conn, &sample_result("m1", 30.0), &hw).unwrap();
        insert(&conn, &sample_result("m2", 18.0), &hw).unwrap();

        let rows = list(&conn, 10).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].model, "m2", "newest first");
        assert!(rows[0].hardware_summary.contains("Test GPU"));
        assert!(!rows[0].hardware_fingerprint.is_empty());

        delete(&conn, rows[0].id).unwrap();
        assert_eq!(list(&conn, 10).unwrap().len(), 1);
        clear(&conn).unwrap();
        assert!(list(&conn, 10).unwrap().is_empty());

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn database_persists_across_connections() {
        let path = temp_db_path("persist");
        {
            let conn = open(&path).unwrap();
            let hw = HardwareInfo {
                platform: "test".into(),
                arch: "x86_64".into(),
                os_name: "test".into(),
                os_version: "0".into(),
                cpu: crate::hardware::CpuInfo {
                    model: "CPU".into(),
                    cores: 4,
                    arch: "x86_64".into(),
                    is_apple_silicon: false,
                },
                memory: crate::hardware::MemoryInfo {
                    total_bytes: 8 * 1024 * 1024 * 1024,
                    total_gb: 8.0,
                    free_bytes: 4 * 1024 * 1024 * 1024,
                    free_gb: 4.0,
                    is_unified: false,
                },
                gpu: crate::hardware::GpuInfo {
                    model: "GPU".into(),
                    is_unified_memory: false,
                    vram_gb: 8.0,
                    metal_support: "CUDA".into(),
                    vendor: "nvidia".into(),
                    driver_version: None,
                },
                backends: vec!["CPU inference".into()],
            };
            insert(&conn, &sample_result("persisted", 25.0), &hw).unwrap();
        }
        // Fresh connection (simulates app restart / reinstall-keep-data).
        let conn = open(&path).unwrap();
        let rows = list(&conn, 10).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].model, "persisted");
        assert_eq!(rows[0].generation_tok_per_sec, 25.0);
        let _ = std::fs::remove_file(&path);
    }
}
