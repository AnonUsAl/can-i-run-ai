import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import os from 'node:os';

// Custom plugin to provide system hardware & Ollama live benchmark APIs directly in dev/preview server
function systemHardwareApiPlugin() {
  return {
    name: 'system-hardware-api',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = new URL(req.url, `http://${req.headers.host}`);

        // 1. Hardware detection endpoint
        if (url.pathname === '/api/hardware') {
          try {
            const platform = os.platform();
            let cpuModel = os.cpus()[0]?.model || 'Unknown CPU';
            let cpuCores = os.cpus().length;
            let totalRamBytes = os.totalmem();
            let freeRamBytes = os.freemem();
            let arch = os.arch();
            let osVersion = `${os.type()} ${os.release()}`;
            let gpuInfo = 'Integrated / Unknown GPU';
            let isAppleSilicon = false;
            let metalSupport = 'None';
            let backends = ['CPU inference'];

            if (platform === 'darwin') {
              try {
                const brand = execSync('sysctl -n machdep.cpu.brand_string', { encoding: 'utf-8' }).trim();
                if (brand) cpuModel = brand;
              } catch (_) {}

              try {
                const mem = execSync('sysctl -n hw.memsize', { encoding: 'utf-8' }).trim();
                if (mem) totalRamBytes = parseInt(mem, 10);
              } catch (_) {}

              try {
                const profilerOutput = execSync('system_profiler SPHardwareDataType SPDisplaysDataType -json', { encoding: 'utf-8', timeout: 4000 });
                const parsed = JSON.parse(profilerOutput);
                const hw = parsed?.SPHardwareDataType?.[0];
                const gpus = parsed?.SPDisplaysDataType;
                
                if (hw?.chip_type) {
                  cpuModel = hw.chip_type;
                  isAppleSilicon = true;
                  backends.push('Apple Metal');
                  metalSupport = 'Metal 4';
                } else if (cpuModel.toLowerCase().includes('apple')) {
                  isAppleSilicon = true;
                  backends.push('Apple Metal');
                  metalSupport = 'Metal 4';
                }

                if (Array.isArray(gpus) && gpus.length > 0) {
                  const gpu = gpus[0];
                  gpuInfo = `${gpu.sppci_model || gpu._name || 'Apple GPU'}${gpu.sppci_cores ? ` (${gpu.sppci_cores} Cores)` : ''}`;
                  if (gpu.spdisplays_metal) {
                    metalSupport = gpu.spdisplays_metal;
                  }
                }
              } catch (err) {
                if (cpuModel.toLowerCase().includes('apple') || arch === 'arm64') {
                  isAppleSilicon = true;
                  gpuInfo = `${cpuModel} Integrated GPU`;
                  metalSupport = 'Metal Supported';
                  backends.push('Apple Metal');
                }
              }
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: true,
              hardware: {
                platform,
                arch,
                osName: platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux',
                osVersion,
                cpu: {
                  model: cpuModel,
                  cores: cpuCores,
                  arch,
                  isAppleSilicon,
                },
                memory: {
                  totalBytes: totalRamBytes,
                  totalGb: +(totalRamBytes / (1024 ** 3)).toFixed(1),
                  freeBytes: freeRamBytes,
                  freeGb: +(freeRamBytes / (1024 ** 3)).toFixed(1),
                  isUnified: isAppleSilicon,
                },
                gpu: {
                  model: gpuInfo,
                  isUnifiedMemory: isAppleSilicon,
                  metalSupport,
                  vramGb: isAppleSilicon ? +(totalRamBytes / (1024 ** 3)).toFixed(1) : 0,
                },
                backends,
              }
            }));
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: e.message }));
            return;
          }
        }

        // 2. Ollama Status & List models
        if (url.pathname === '/api/ollama/models') {
          try {
            const ollamaRes = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(2500) });
            if (!ollamaRes.ok) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ isRunning: false, models: [] }));
              return;
            }
            const data: any = await ollamaRes.json();
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              isRunning: true,
              models: data.models || [],
            }));
            return;
          } catch (_) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ isRunning: false, models: [] }));
            return;
          }
        }

        // 3. Ollama Benchmark Endpoint
        if (url.pathname === '/api/ollama/benchmark' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const { modelName } = JSON.parse(body || '{}');
              if (!modelName) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Missing modelName' }));
                return;
              }

              // Warm-up call
              try {
                await fetch('http://localhost:11434/api/generate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    model: modelName,
                    prompt: 'Hi',
                    stream: false,
                    options: { num_predict: 5 }
                  }),
                  signal: AbortSignal.timeout(15000)
                });
              } catch (_) {}

              // Actual benchmark call
              const prompt = "Explain in three concise bullet points why local AI inference is beneficial for privacy, speed, and offline access.";
              const startTime = performance.now();
              const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: modelName,
                  prompt,
                  stream: false,
                  options: {
                    temperature: 0.2,
                    num_predict: 120
                  }
                }),
                signal: AbortSignal.timeout(60000)
              });

              if (!response.ok) {
                res.statusCode = 502;
                res.end(JSON.stringify({ error: `Ollama error: ${response.statusText}` }));
                return;
              }

              const result: any = await response.json();
              const totalWallTimeMs = performance.now() - startTime;

              // Ollama returns timings in nanoseconds:
              // total_duration, load_duration, prompt_eval_count, prompt_eval_duration, eval_count, eval_duration
              const promptEvalCount = result.prompt_eval_count || 0;
              const promptEvalDurationSec = (result.prompt_eval_duration || 1) / 1e9;
              const promptSpeedTokPerSec = +(promptEvalCount / (promptEvalDurationSec || 0.001)).toFixed(1);

              const evalCount = result.eval_count || 0;
              const evalDurationSec = (result.eval_duration || 1) / 1e9;
              const genSpeedTokPerSec = +(evalCount / (evalDurationSec || 0.001)).toFixed(1);

              // TTFT estimated from load_duration + prompt_eval_duration
              const ttftSec = +(((result.load_duration || 0) + (result.prompt_eval_duration || 0)) / 1e9).toFixed(2);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                benchmark: {
                  model: modelName,
                  ttftSec: ttftSec > 0 ? ttftSec : +(totalWallTimeMs / 1000 * 0.25).toFixed(2),
                  promptEvalTokPerSec: promptSpeedTokPerSec,
                  generationTokPerSec: genSpeedTokPerSec,
                  totalTokens: evalCount,
                  totalDurationSec: +(totalWallTimeMs / 1000).toFixed(2),
                  sampleOutput: result.response?.trim() || '',
                  timestamp: new Date().toISOString()
                }
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), systemHardwareApiPlugin()],
  server: {
    port: 5173,
    host: true,
  }
});
