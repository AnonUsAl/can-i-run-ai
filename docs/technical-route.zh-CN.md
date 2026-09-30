# 技术路线（Technical Route）

> [English](technical-route.md) | 简体中文

| | |
|---|---|
| 版本 | v0.1（草案） |
| 日期 | 2026-09-30 |
| 基线 | commit `5ea0297` "New update with antigravity" |
| 状态 | 待维护者评审 |

> **状态更新（2026-09-30，M2 完成后）**：三处设计决策已按实际实现修订——D1（类型绑定改用手写镜像 + 黄金 fixture 防漂移，tauri-specta 推迟）、D5（WMI 查询经 PowerShell CIM 完成、DXGI 使用 windows crate、NVML 为 feature 门控依赖）、§4.2（模型 schema 采用扁平字段而非嵌套 arch）。M0/M1/M2 已实现并通过全部验证门禁，见文末「实施进度」。

---

## 0. 一页摘要

项目当前有一套完整的 UI 骨架和概念原型，但**前端与后端尚未接通，部分指标是写死的假数据**。在增加任何新功能之前，第一个里程碑应当是"让应用在任何一台真实电脑上跑起来、显示真实硬件、量出真实数据"。

三个最关键的断点：

1. **IPC 断裂**：前端用 `fetch('/api/...')` 调一个不存在的 REST 服务，而 Tauri 的机制是 `invoke()`；且 `@tauri-apps/api` 与 `@tauri-apps/cli` 都没有安装，桌面应用目前根本无法构建。
2. **双引擎漂移**：兼容性计算在 `src/lib/compatibility.ts`（TS，完整版）和 `src-tauri/src/compatibility/calculator.rs`（Rust，简化版）各有一套，公式已经不一致，将来必然漂移。
3. **假数据**：基准测试的 TTFT（0.65s）与 Prompt 速度（75 tok/s）是硬编码常量；Windows/非 macOS 机器显示 "Generic CPU/GPU"；前端兜底 `DEFAULT_HARDWARE` 会在检测失败时静默显示一台假的 M1 Pro。

路线总纲：**M0 跑起来 → M1 量得准 → M2 Windows 一等公民 → M3 运行时生态 → M4 本地历史 → M5 社区数据库**（对应 README 的 Phase 1–5）。

---

## 1. 现状盘点（commit `5ea0297`）

| 模块 | 文件 | 现状 | 问题 | 归属 |
|---|---|---|---|---|
| 前端通信 | `src/lib/api.ts` | `fetch('/api/hardware')` 等 | **不存在的后端**；Tauri 应使用 `invoke()`；`@tauri-apps/api` 未安装 | M0 |
| 前端兜底 | `api.ts` `DEFAULT_HARDWARE` | 检测失败回退到假 M1 Pro | 静默显示假硬件，违背"不藏技术细节"原则 | M0 |
| 兼容引擎 | `src/lib/compatibility.ts` | 完整（权重/KV/开销/缓冲/速度估算） | 与 Rust 版重复且不一致；**KV 公式是全仓库唯一正确的实现**（用了模型的 layers/kv_heads 字段） | M1 |
| 模型库 | `src/data/models.ts` + `database/models/models.json` | TS 版较全，JSON 版仅 3 条 | 双数据源，字段不同 | M1 |
| Tauri 工程 | `package.json`、`tauri.conf.json` | conf 完整 | 无 `@tauri-apps/cli`（无法 `tauri dev/build`）；引用的 `icons/*` 不存在 | M0 |
| 硬件检测 | `hardware/macos.rs` | sysctl 拿 CPU/内存 | GPU 型号与 VRAM 是用 CPU 品牌拼的；无空闲内存 | M1/M2 |
| 硬件检测 | `hardware/mod.rs` 非 macOS 分支 | 硬编码 Generic 桩 | `hardware/windows.rs`（README 架构图里有）不存在；`sysinfo` 依赖已声明但从未使用 | M0/M2 |
| 兼容引擎 | `compatibility/calculator.rs` | 简化公式 | KV 公式硬编码 32 层/8 kv_heads/128 维/fp16，无视模型元数据；无缓冲区项；阈值含义混乱（1.45×RAM 才判"不兼容"） | M1 |
| 基准测试 | `benchmark/runner.rs` | 单次非流式请求 | **TTFT=0.65、prefill=75 为硬编码假值**；无预热、无多次取中位、无模型加载等待；`check_ollama_status` 写了但没人调用 | M1 |
| 存储 | — | 无 | README 宣称 SQLite，实际没有；M0–M3 先不做（见 D7） | M4 |
| 测试/CI | — | 无 | 引擎是纯函数，最适合先补黄金样本单测 | M1 |
| 类型契约 | `src/types/index.ts` vs Rust 结构体 | 手写两套 | 字段对不上（`osName/freeBytes` vs `os/total_bytes`），serde 默认 snake_case → camelCase 也未处理 | M0/M1 |

**值得保留的资产**：整体 UI 结构与中英双语切换（`App.tsx`）、TS 版兼容引擎的公式与阈值思路（迁移到 Rust 即可）、模型 schema 里 layers/kv_heads/head_dim 的架构字段（KV 计算的关键）、`check_ollama_status` 的 Ollama 探活。

---

## 2. 目标架构

```text
┌─────────────────────────────── 前端 (React + TS) ───────────────────────────────┐
│  展示与交互：HardwareCard / ContextSlider / ModelExplorer / BenchmarkRunner      │
│  不含任何业务计算逻辑，只调用 IPC 绑定                                            │
└───────────────┬─────────────────────────────────────────────────────────────────┘
                │ invoke()（由 tauri-specta 生成类型安全的 TS 绑定）
┌───────────────▼──────────────────── Rust 核心 (src-tauri) ──────────────────────┐
│  hardware/   平台探测：trait Probe → macos.rs / windows.rs / linux.rs             │
│  models/     模型库加载与校验（database/models/*.json 打包进应用）                 │
│  engine/     兼容性引擎（唯一实现）：内存估算 → 分级 → 解释 → 速度估算             │
│  benchmark/  runner 状态机 + ollama.rs（HTTP，流式）+ 将来 lmstudio.rs 等          │
│  store/      跑分历史（M0–M3 JSON 文件；M4 起 SQLite）                            │
└───────────────┬─────────────────────────────────────────────────────────────────┘
                │ http://localhost:11434（Rust 侧 reqwest，不经前端，无 CORS 问题）
        ┌───────▼────────┐
        │ Ollama / LM Studio / llama.cpp │
        └────────────────┘
```

设计原则（对齐 README）：

- **计算只在一处**：所有估算与判定逻辑只存在于 Rust；前端只渲染结果。
- **类型单一来源**：Rust 结构体是唯一权威，TS 类型自动生成，杜绝两套手写类型漂移。
- **数据单一来源**：`database/models/*.json` 是模型元数据的唯一权威。
- **本地优先**：核心功能零网络依赖；Ollama 仅本机回环地址。

---

## 3. 核心设计决策

### D1 前后端通信：仅用 Tauri IPC（已修订）
- 安装 `@tauri-apps/api`（运行时）与 `@tauri-apps/cli`（工程化）。
- ~~引入 `tauri-specta` v2 自动生成绑定~~ **修订（2026-09-30，M1 实装）**：改用手写 TS 镜像类型——Rust 结构体统一 `#[serde(rename_all = "camelCase")]`，字段名与前端接口一一对应；类型漂移由黄金 fixture 快照测试兜底（引擎输出与提交进仓库的 JSON fixture 比对，同时充当序列化契约）。tauri-specta 可在工具链与依赖矩阵稳定后再引入。
- 删除所有 `fetch('/api/...')`；不引入额外 REST 层。

### D2 兼容性引擎：唯一实现放在 Rust
- 新建 `src-tauri/src/engine/`（替代 `compatibility/`），入口为纯函数：

```rust
pub fn evaluate(model: &ModelSpec, hw: &HardwareInfo, ctx: usize, quant: Quant) -> CompatibilityReport
```

- 把 `compatibility.ts` 中更完整的公式（含 GQA 的 KV、缓冲区、带宽查表估速）**移植**为 Rust 实现，然后删除 TS 版。移植时补黄金样本单测（见 §6）。

### D3 模型库：`database/models/*.json` 唯一来源
- JSON schema 版本化（`"schema": 1`），字段见 §4.2；构建时随资源打包，Rust 启动时 serde 加载 + 校验，缺失字段给出明确报错。
- `src/data/models.ts` 删除，前端需要展示的模型列表通过 IPC 获取。
- 建议扩充到 20 个左右覆盖各档位：Qwen3（0.6B/1.7B/4B/8B/14B/30B-A3B）、Llama 3.2/3.3、Gemma 3（4B/12B/27B）、Phi-4、Mistral 7B、DeepSeek-R1 蒸馏系。MoE 模型必须同时记录总参数与激活参数（见 §4.2）。

### D4 基准测试方法论（M1 的核心）
现状 `stream: false` 拿不到 TTFT，硬编码必须移除：

1. **预热**：先跑一次短请求（`num_predict: 16`），让模型完成冷加载，该次结果不计入。
2. **正式测量**：`stream: true`，固定 `temperature: 0`、`seed: 42`、`num_predict: 128`、固定 prompt；
   - **TTFT** = 收到首个含 token 的 chunk 的时刻 − 请求发出时刻；
   - **Prefill 速度** = `prompt_eval_count / prompt_eval_duration`（终帧 JSON）；
   - **生成速度** = `eval_count / eval_duration`（终帧 JSON）；
   - 记录模型加载是否发生（预热后不应发生）。
3. **重复 3 次取中位数**，同时上报 min/max 以示波动。
4. 网络层错误分类：运行时未启动 / 模型未安装 / 超时，分别给出可操作的中文+英文提示。

### D5 硬件检测：trait 抽象 + 平台实现
```rust
pub trait Probe { fn detect(&self) -> Result<HardwareInfo, ProbeError>; }
```
- `HardwareInfo` 需补充：`osVersion`、`freeMemoryBytes`（必须真实，不能省）、`gpus: Vec<Gpu>`（多卡）、`Gpu.vram_bytes`、`backends`（Metal/CUDA/ROCm/Vulkan/CPU 的判定依据）。
- macOS：沿用 sysctl，GPU 部分后续用 `IOReport`/`system_profiler` 补真实芯片名。
- Windows（M2，`windows.rs`，**已实装**）：
  - CPU/内存：`sysinfo`（`wmi` crate 暂不引入；CIM 查询经 PowerShell 无窗口进程完成）；
  - GPU 三级探测：NVIDIA 走 `nvml-wrapper`（feature `nvml`，默认开启，仅在 Windows 平台编译）→ 全厂商走 `windows` crate 的 DXGI 枚举（名称 / 专用显存 / 厂商 ID，跳过软件渲染适配器，取专用显存最大者）→ 驱动版本经 PowerShell CIM 查询；`Win32_VideoController.AdapterRAM` 因 32 位溢出从不作为显存来源；
  - CUDA 检测：NVML 初始化成功。
- Linux（M2 末）：`/proc/meminfo`、`lspci`、`nvidia-smi`。

### D6 速度估算：显式标注"预估值"
- 解码阶段是内存带宽受限的：`tok/s ≈ η × BW_eff / weights_GB`（η≈0.9 为经验系数，量化混合开销计入）。
- `BW_eff` 按芯片型号查表（`database/hardware/bandwidth.json`：M 系列、主流 NVIDIA/AMD/Intel 型号）；查不到的芯片回退保守值 50 GB/s 并在 UI 标注"未知芯片，粗略估算"。
- Prefill 速度是算力受限的，v1 阶段不给出估算（宁缺毋假）。
- UI 上预估值与实测值必须视觉区分；一旦该机该模型有实测数据，实测覆盖预估值。

### D7 存储：推迟引入 SQLite
- M0–M3 不用数据库。跑分历史以 `app_data_dir()/history.json` 追加保存即可（结构 = `BenchmarkResult` + 硬件指纹 + 时间戳）。
- M4（历史对比视图上线时）再引入 `rusqlite`（bundled）+ 迁移，理由：届时才有真正的查询需求。README 中的 SQLite 描述届时自然兑现。

### D8 打包与 CI
- `npx tauri icon` 生成全套图标，消除 `tauri.conf.json` 引用缺失。
- GitHub Actions 三平台矩阵：`cargo fmt --check` + `clippy -D warnings` + `cargo test` + `tsc --noEmit`；tag 触发 `tauri build` 产物上传。

---

## 4. 模块规格

### 4.1 硬件探测层

目标 `HardwareInfo`（camelCase 输出给前端）：

```text
platform: "windows"|"macos"|"linux"
arch: "x86_64"|"aarch64"
osName, osVersion
cpu:  { model, coresPhysical, coresLogical, arch, isAppleSilicon }
memory: { totalBytes, freeBytes, isUnified }
gpus: [ { name, vendor: nvidia|amd|intel|apple|unknown, vramBytes, isIntegrated, driverVersion } ]
backends: [ { kind: metal|cuda|rocm|vulkan|cpu, detail } ]
```

### 4.2 模型库 schema（v1，已实装：扁平字段）

```jsonc
// 与前端 AIModelDefinition 一一对应；当前为单文件 25 个模型。
// 嵌套 arch 与 MoE（activeParamsB）留待 v2。
{
  "schema": 1,
  "models": [{
    "id": "qwen-3-8b",
    "name": "Qwen 3 8B Instruct",
    "family": "Qwen",
    "parameterCountBillion": 8.2,
    "layers": 32, "heads": 32, "kvHeads": 8, "headDim": 128,
    "maxContextLength": 40960,
    "supportedQuantizations": ["Q3_K_M","Q4_K_M","Q5_K_M","Q8_0","FP16"],
    "defaultQuantization": "Q4_K_M",
    "ollamaName": "qwen3:8b",
    "description": "…（中文）",
    "recommendedUse": "…（中文）"
  }]
}
```

- 速度估算当前仅用 `totalParamsB`（暂无 MoE 入库；v2 引入后改用 `activeParamsB ?? totalParamsB`）。
- 当前为单文件 `database/models/models.json`（25 模型）；拆分一模型一文件待协作规模需要时进行，Rust 侧校验已覆盖唯一 id、量化合法性与架构字段。

### 4.3 兼容性引擎 spec

内存模型（顺序与解释输出一致）：

```text
weights_gb  = totalParams × 1e9 × bpw(quant) / 8 / 2^30          // bpw 查表，Q4_K_M≈4.85
kv_cache_gb = 2 × layers × kvHeads × headDim × ctx × bytesPerElem / 2^30   // 默认 fp16=2B；GQA 按 kvHeads
overhead_gb = 运行时基础开销(查表: ollama≈0.5) + 0.02 × totalParams
buffers_gb  = min(1.5, max(0.2, heads × headDim × ctx × 4 / 2^30))
total_gb    = weights + kv + overhead + buffers
```

判定阈值（v1，集中在一个 `thresholds.rs` 便于调参）：

```text
available = unified ? totalRam × 0.75        // macOS wired limit 经验值
          : min(vram + 0.6×(totalRam−freeRam), …)  // v1 简化：优先按显存判
total ≤ 0.90 × available              → 🟢 recommended
total ≤ available                     → 🟡 runnable
total ≤ available + 0.5 × totalRam    → 🔴 not_recommended（依赖 swap）
否则                                   → ⚫ incompatible
```

- 输出必须含 `bottleneck: vram|ram|context|backend|none` 与结构化建议（如"上下文降到 8K 可进入 🟢"），支撑 README 的"可解释"原则。
- Windows 判定与 macOS 分开建模：独显走 VRAM 硬约束 + 可卸载到内存，统一内存走 wired limit。这是 M2 的核心逻辑。

### 4.4 基准测试 runner 状态机

```text
检查运行时在线 → 检查模型已安装 → 预热(不计入)
→ 循环 3 次: 流式请求 → TTFT/prefill/gen 指标
→ 中位数汇总 + min/max → 返回 + 写入历史
```

命令签名（specta 导出）：`run_benchmark(modelId, opts) -> BenchmarkReport`、`check_runtime() -> RuntimeStatus`、`get_history() -> Vec<BenchmarkRecord>`。

### 4.5 前端调整

- `api.ts` 重写为 invoke 绑定的薄封装；组件结构不变。
- 删除 `DEFAULT_HARDWARE` 假兜底 → 显式 loading / 检测失败（含重试按钮）状态。
- 模型卡片上同时展示"预估"与"实测"（有实测时），徽章区分。

---

## 5. 里程碑

| 里程碑 | 目标（一句话） | 主要工作 | 验收标准 |
|---|---|---|---|
| **M0 跑起来** | 应用在真实机器上显示真实硬件 | 装 `@tauri-apps/api`+`cli`；api.ts → invoke；真实 free RAM（sysinfo）；删假兜底；`tauri icon`；Rust 侧从 JSON 加载模型库 | Windows + macOS `tauri dev` 显示本机真实 CPU/RAM/GPU 名称；无任何硬编码假数据 |
| **M1 量得准** | 估算可信、实测真实 | 引擎收归 Rust（specta 绑定）；KV 用模型架构字段；流式 TTFT；3 次中位数；删 `compatibility.ts`；黄金样本单测 | 同机同模型两次跑分 TTFT 差 <30%；引擎单测全绿；UI 无预估/实测混淆 |
| **M2 Windows 一等公民** | NVIDIA/AMD 机器上判定正确 | `windows.rs`（WMI+NVML+DXGI）；CUDA/Vulkan backend 检测；VRAM 硬约束与 offload 判定；带宽表扩充 | 在一台 NVIDIA 机器上：GPU/VRAM/驱动识别正确，7B Q4 判 🟢 且预估速度 ±50% 内 |
| **M3 运行时生态** | Ollama 之外多两个后端 | LM Studio（OpenAI 兼容端口）、llama.cpp server；运行时自动发现；模型自动发现 | 三种运行时各自完成一次完整跑分 |
| **M4 本地历史** | 跑分可留存可对比 | rusqlite + 迁移；历史列表与前后对比视图 | 卸载重装后历史仍在（app data 目录） |
| **M5 社区与分享** | 对应 README Phase 4–5 | opt-in 匿名上传、分享卡导出（UI 壳已存在） | — |

依赖关系：M0 → M1 → M2 相互串行；M3 可与 M2 并行；M4/M5 靠后。

---

## 6. 测试与质量策略

- **引擎黄金样本单测**（最高优先）：3 个虚拟机型（8GB Mac mini、16GB M1 Pro、32GB+RTX 4070）× 3 个模型（0.6B/8B/30B-A3B）× 2 个量化 = 18 个快照断言。公式改动必然触及快照，review 时一目了然。
- 探测层用 mock `Probe` 测上层逻辑；平台实现本身只能冒烟测试（断言字段非空）。
- CI（§D8）三平台跑；`bindings.ts` 生成结果若与提交不一致即失败——防止类型漂移。
- Clippy `-D warnings`、`cargo fmt --check`、`tsc --noEmit` 全部门禁化。

## 7. 风险与开放问题

1. **License**：`Cargo.toml` 已声明 MIT，README 说"首个稳定版前确定"。建议尽快正式化 MIT 并补 `LICENSE` 版权行，避免贡献者观望。
2. **Windows VRAM 报告**：`Win32_VideoController` 的 `AdapterRAM` 是 32 位截断值（>4GB 不可信），必须走 NVML/DXGI，文档里要写清这个坑。
3. **MoE 与多模态**：MoE 权重/速度分离已进 schema；多模态（视觉编码器）v1 不建模，UI 标注"仅按文本部分估算"。
4. **Ollama 量化 vs bpw 查表**：Ollama 拉取的模型实际 bpw 可能与查表不同（可从 `/api/show` 读 `quantization_level` 校正）——M1 加一个"以运行时报告为准"的校正步骤。
5. **带宽表维护成本**：芯片型号表会持续增长，保持为社区可 PR 的 JSON 数据文件，而不是代码常量。

## 8. M0 立即行动清单

```bash
cd can-i-run-ai
npm install
npm install @tauri-apps/api
npm install -D @tauri-apps/cli
npx tauri icon path/to/icon.png        # 生成 src-tauri/icons/*
npm run tauri dev                      # 需 Rust 工具链 (rustup) 与系统 WebView 依赖
```

代码改动（按顺序）：
1. `src/lib/api.ts`：`fetch` 全部替换为 `invoke("get_hardware_info")` / `invoke("run_ollama_benchmark", { model })`；新增 `check_ollama_status` 命令并接入。
2. Rust `hardware/`：非 macOS 分支先用 `sysinfo`（已在依赖中）填充 CPU/RAM/free/GPU 名称；`MemoryInfo` 加 `free_bytes`；所有结构体加 `#[serde(rename_all = "camelCase")]`。
3. 前端：删除 `DEFAULT_HARDWARE` 兜底，改为 loading/error 状态。
4. `main.rs`：补 `list_models` 命令，从 `database/models/models.json` 读取（M0 先整文件，M1 拆分）。
5. 首个 PR 只做上述内容，标题建议 `fix: wire frontend to Tauri IPC and remove fake data (M0)`。

---

## 9. 实施进度（2026-09-30）

| 里程碑 | 状态 | 分支 | 备注 |
|---|---|---|---|
| M0 跑起来 | ✅ 已完成 | `feat/m0-tauri-ipc` | invoke 接通、真实硬件、流式真 TTFT、删除全部假数据 |
| M1 量得准 | ✅ 已完成 | `feat/m1-engine` | 引擎收归 Rust、25 模型库统一、预热+3 次中位数跑分、黄金 fixture、CI |
| M2 Windows 一等公民 | ✅ 已完成 | `feat/m2-windows-hardware` | NVML/DXGI/CIM 三级探测、带宽查表；**真机验证**（i7-13650HX / RTX 4060 Laptop 8GB / 驱动 566.07） |
| M3 运行时生态 | ✅ 已完成 | `feat/m3-runtimes` | LM Studio / llama.cpp 接入（v0 API + OpenAI SSE），离线运行时上报启动提示 |
| M4 本地历史 | ✅ 已完成 | `feat/m4-history` | SQLite（rusqlite bundled，app data 目录）+ 硬件指纹 + 同模型前后对比视图 |
| M5 社区库与分享 | ⏳ 未开始 | — | 匿名上传 / 分享卡导出 |

验证门禁：`cargo check/test/clippy -D warnings/fmt` 与 `tsc/vite build` 全绿；真机 smoke test 经 `cargo test -- --ignored` 在桌面机执行。
