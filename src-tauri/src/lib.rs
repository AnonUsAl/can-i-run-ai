//! Can I Run AI? — desktop core.
//!
//! Library crate so integration tests (and future mobile targets) can
//! reach the engine, hardware probes, model database and benchmark
//! runner. The binary in `main.rs` only wires the Tauri commands.

pub mod benchmark;
pub mod engine;
pub mod hardware;
pub mod models;
pub mod store;
