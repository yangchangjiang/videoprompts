# VideoPrompt — Free AI Video Prompt Generator & Video-to-Prompt

**[videoprompts.tools](https://videoprompts.tools/)** — a free, private, on-device AI tool for AI video creation.

- **1,890 pages · 14 languages** (EN, 中文, 日本語, 한국어, Español, Português, Français, Deutsch, العربية, हिन्दी, ไทย, Tiếng Việt, Bahasa Indonesia, Русский)
- **21 AI video platforms** — Sora, Runway, Kling, Pika, PixVerse, Hailuo, Seedance, Veo, Luma, Krea, Haiper, Stable Video, Moonvalley, Morph, Dreamina, Wan, Hunyuan Video, CogVideoX, Firefly Video, Vidu, Movie Gen
- **103 hand-written prompt templates**, including a short-drama line (vertical 9:16, character-locked)
- **6 on-device AI engines** — everything runs in the browser via WebGPU; nothing is uploaded

## What it does

| Engine | Model | What it does |
|---|---|---|
| Text → Prompt | Qwen2.5 (0.5B / 1.5B / 3B tiers) | Turn an idea into a cinematic video prompt |
| Video → Prompt | Florence-2 + Qwen2.5 | Reverse-engineer a prompt from a video (frame extraction + captioning + synthesis) |
| Image → Prompt | Florence-2 + Qwen2.5 | Describe an image as a reusable prompt |
| Prompt Improver | Qwen2.5 | Cinematic rewrite in the signature style of 21 platforms |
| Character Card Generator | Qwen2.5 | Build a reusable character-lock card (name/age/appearance/outfit/personality) |
| Short-Drama Templates | — | 8 genre-based character-locked storyboard templates |

## Privacy model

All inference runs **in the user's browser** (WebGPU). Videos, images and ideas never leave the device. Model weights are downloaded once (~430MB / 1.2GB / 2.2GB tiers), then the tools work offline. There is no account, no sign-up and no server-side AI.

## Tech stack

- **Cloudflare Workers Assets** + **R2** (model-weight mirror, range-request streaming with resume)
- **WebLLM** (`@mlc-ai/web-llm` 0.2.84) — Qwen2.5 inference in-browser
- **transformers.js** (v3.8.1) + ONNX Runtime Web — Florence-2 vision
- Static site generator (Python) producing 14-language pages, FAQPage/WebApplication schema, sitemap, `llms.txt` for AI crawlers

## What's in this repo

This repository contains the **edge worker** (`worker.js`) that serves the site and routes model weights from R2 with correct MIME types, range requests and caching, plus the deployment configuration (`wrangler.jsonc`).

The full site generator and content data remain private. **All rights reserved** — this code is provided for reference; no license to copy or reuse is granted.

## Links

- Site: <https://videoprompts.tools/>
- AI crawlers: <https://videoprompts.tools/llms.txt>
- Templates: <https://videoprompts.tools/templates/>
