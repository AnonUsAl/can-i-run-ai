# Can I Run AI?

[English](README.md) | [简体中文](README_zh.md)

> **Find out what AI models your computer can actually run.**

Can I Run AI? is an open-source desktop application that analyzes your computer's hardware, evaluates local AI model compatibility, and optionally benchmarks real-world inference performance.

Instead of guessing whether a model will run on your computer, Can I Run AI? aims to answer:

> **"What AI models can my computer run, and how fast?"**

---

## ✨ Features

### 🖥️ Hardware Detection

Automatically detect your system hardware:

* CPU
* CPU architecture
* System memory
* GPU
* VRAM
* Operating system
* Available AI backends

Planned backend detection:

* Apple Metal
* NVIDIA CUDA
* AMD ROCm
* Vulkan
* CPU inference

---

### 🤖 AI Model Compatibility

Analyze whether a model is suitable for your hardware.

The compatibility engine considers:

* Model parameter count
* Quantization
* Model size
* RAM requirements
* VRAM requirements
* Context length
* KV cache requirements
* Runtime overhead
* Hardware backend compatibility

Instead of simply returning `Yes / No`, the application will classify models as:

| Status             | Meaning                                                       |
| ------------------ | ------------------------------------------------------------- |
| 🟢 Recommended     | Should provide a reasonable experience                        |
| 🟡 Runnable        | Can run, but may have performance or memory limitations       |
| 🔴 Not Recommended | Technically possible, but likely to provide a poor experience |
| ⚫ Incompatible     | Hardware or backend requirements are not satisfied            |

---

### ⚡ Local Benchmark

When supported local AI runtimes are installed, Can I Run AI? can run real benchmarks instead of relying solely on theoretical estimates.

Planned metrics include:

* Time to First Token (TTFT)
* Prompt processing speed
* Generation speed
* Tokens per second
* Total generation time
* Memory usage

Example:

```text
Qwen3 8B · Q4_K_M

Prompt Processing
82 tok/s

Generation
18.4 tok/s

TTFT
0.72 s
```

---

### 🦙 Local Runtime Support

Initial support:

* Ollama

Planned:

* LM Studio
* llama.cpp
* Additional local inference runtimes

The goal is to work with existing local AI runtimes rather than replacing them.

---

## 🧠 How It Works

The core architecture is:

```text
┌──────────────────────┐
│     Your Computer    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Hardware Detection   │
│ CPU / RAM / GPU      │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Model Database       │
│ Size / Quantization  │
│ RAM / VRAM / Backend │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Compatibility Engine │
└──────────┬───────────┘
           │
           ▼
     ┌─────┴─────┐
     │           │
     ▼           ▼
Prediction    Benchmark
     │           │
     └─────┬─────┘
           ▼
┌──────────────────────┐
│ Recommendation       │
│ + Performance Data   │
└──────────────────────┘
```

---

## 🔬 Compatibility Model

Running an LLM requires more memory than the model file itself.

A simplified memory model is:

```text
Total Memory
≈
Model Weights
+
KV Cache
+
Runtime Overhead
+
Temporary Buffers
```

For example:

```text
Model:
Qwen 8B Q4

Available RAM:
16 GB

Estimated usage:

Model weights       ~5 GB
KV cache             ~X GB
Runtime overhead     ~X GB
Temporary buffers    ~X GB
--------------------------------
Estimated total      ~X GB
```

The exact requirements depend on:

* Quantization format
* Context length
* Batch size
* Runtime implementation
* GPU/CPU offloading
* Backend
* Model architecture

Therefore, Can I Run AI? distinguishes between:

> **Estimated compatibility**

and

> **Measured compatibility**

Actual benchmarks should take priority whenever reliable local benchmark data is available.

---

## 🏗️ Architecture

```text
can-i-run-ai/
│
├── frontend/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   └── lib/
│
├── src-tauri/
│   ├── hardware/
│   │   ├── cpu.rs
│   │   ├── memory.rs
│   │   ├── gpu.rs
│   │   ├── macos.rs
│   │   └── windows.rs
│   │
│   ├── benchmark/
│   │   ├── ollama.rs
│   │   └── runner.rs
│   │
│   ├── compatibility/
│   │   ├── calculator.rs
│   │   └── models.rs
│   │
│   └── main.rs
│
├── database/
│   ├── models/
│   └── benchmarks/
│
├── package.json
├── tauri.conf.json
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* shadcn/ui
* Lucide

### Desktop

* Tauri 2

### Core

* Rust

### Database

* SQLite

### Local AI

* Ollama
* LM Studio *(planned)*
* llama.cpp *(planned)*

### Cloud Infrastructure

Not required for the initial version.

Future infrastructure may include:

* PostgreSQL
* Hono / API server
* Cloudflare Workers

---

## 🚀 Development Roadmap

### Phase 1 — MVP

* [ ] macOS support
* [ ] Apple Silicon detection
* [ ] RAM detection
* [ ] CPU detection
* [ ] GPU detection
* [ ] Basic model database
* [ ] Compatibility calculation
* [ ] Ollama detection
* [ ] Basic benchmark
* [ ] Modern desktop UI

### Phase 2 — Cross-platform

* [ ] Intel Mac support
* [ ] Windows support
* [ ] NVIDIA GPU detection
* [ ] CUDA detection
* [ ] AMD GPU support
* [ ] Vulkan support

### Phase 3 — Runtime Integration

* [ ] LM Studio
* [ ] llama.cpp
* [ ] Automatic model discovery
* [ ] Model installation
* [ ] Runtime management

### Phase 4 — Community Benchmark Database

* [ ] Anonymous benchmark submission
* [ ] Hardware profiles
* [ ] Model performance database
* [ ] Hardware/model comparison
* [ ] Public benchmark explorer

### Phase 5 — Sharing

Generate shareable benchmark cards:

```text
┌──────────────────────────┐
│       CAN I RUN AI?      │
│                          │
│     MacBook Pro M1       │
│        16 GB RAM         │
│                          │
│       AI SCORE 742       │
│                          │
│ Qwen3 8B     18.4 tok/s  │
│ Gemma 4B     25.1 tok/s  │
│                          │
│      Can I Run AI?       │
└──────────────────────────┘
```

---

## 🎯 Design Goals

Can I Run AI? is built around several principles.

### 1. Don't Guess When You Can Measure

Hardware-based estimation is useful, but real benchmark results are better.

### 2. Keep It Local

Hardware detection and local benchmarking should work without requiring a cloud account.

### 3. Explain the Result

Instead of:

```text
❌ Cannot run
```

provide useful information:

```text
⚠️ Runnable

Estimated memory:
11.2 GB

Available memory:
12.4 GB

Recommendation:
Reduce context length to 8K.
```

### 4. Don't Hide Technical Details

Advanced users should be able to inspect:

* Model size
* Quantization
* Context length
* Backend
* Estimated memory usage
* Benchmark methodology

while beginners can simply see:

> 🟢 Recommended

---

## 🔐 Privacy

Can I Run AI? is designed with a **local-first** architecture.

Hardware information should remain on the user's computer unless the user explicitly chooses to submit anonymous benchmark data.

The application should never require uploading:

* Personal files
* Chat history
* Model prompts
* Private documents
* API keys

for basic hardware compatibility checks.

---

## 📊 Example

A future version might show:

```text
YOUR COMPUTER

MacBook Pro
Apple M1
16 GB RAM
Metal

────────────────────────

RECOMMENDED MODELS

🟢 Qwen3 4B
   ~25 tok/s

🟢 Gemma 4B
   ~24 tok/s

🟢 Qwen3 8B
   ~18 tok/s

🟡 Qwen3 14B
   ~8 tok/s

🔴 30B+ Models
   Not recommended

────────────────────────

[ Run Benchmark ]
```

---

## 🤝 Contributing

Contributions are welcome.

Areas that could benefit from contributions:

* Hardware detection
* Model metadata
* Benchmark methodology
* Compatibility algorithms
* GPU support
* New inference runtimes
* UI/UX
* Documentation
* Hardware benchmark submissions

Before submitting a large change, please open an issue to discuss the proposal.

---

## 📜 License

This project is intended to be open source.

The final license will be selected before the first stable release.

---

## ⭐ Why This Project?

Local AI is moving from cloud servers to personal computers.

But one question remains surprisingly difficult for many users:

> **"What can my computer actually run?"**

Can I Run AI? aims to make that answer simple.

```text
Your Hardware
      ↓
What Can It Run?
      ↓
How Fast?
      ↓
What Should You Try?
```

**No guessing. Measure it.**
