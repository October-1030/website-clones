# PlaygroundPage Specification

## Overview

- Target: `desktop-app/src/components/PlaygroundPage.tsx`
- Evidence: v1.16.1 `PlaygroundPage-D7Xv6J2u.js`
- Interaction model: form + async generation + persistent gallery

## Required states and behavior

- Header: `画图实验室`
- Description: `输入提示词 + 选风格 → 直接出图，专用于测试不同 prompt / 风格效果。不写入任务历史，不走流水线。`
- Modes: text-to-image and `图像参考`.
- Prompt textarea; reference mode accepts 1-10 local images.
- Aspect ratios: 9:16, 16:9, 1:1, 4:3, 3:4, 3:2, 2:3, 21:9.
- Resolution choices: 1K, 2K, 4K, with 1K marked most stable.
- Visual styles must reuse the image-task style catalog and allow no-style raw prompt mode.
- Multiple selected styles/ratios create a batch matrix and show the intended count before generation.
- Call the clone's real MiniMax image endpoint. Do not simulate successful output.
- For each result show image, prompt, style, ratio, resolution, time and status.
- Actions: download, reuse prompt, use as reference, regenerate in original slot, delete.
- Batch actions: retry failed, download selected, clear selection.
- Persist gallery and current form locally across refresh.
- Empty, loading, partial failure and all-failed states must be explicit.

## Visual contract

- Main content max-width about 1100 px with 28 px top padding.
- Use original global cards, inputs, chips and brand tokens.
- Result grid: 3 columns desktop, 2 tablet, 1 mobile.
- Image cards preserve requested aspect ratio and use `object-fit: cover`.

