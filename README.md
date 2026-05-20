# paste-to-cue

一个粘贴后即可使用的提词器（Teleprompter）。

## 简介（中文）
paste-to-cue 是一个面向口播、直播、拍摄场景的轻量提词器工具。
它的核心思路是：你已经在表格里把文案整理好了，就不需要再二次整理，直接粘贴进来即可滚动使用。

相比“直接滚动表格窗口”，这个工具把提词控制做了专门优化：
- 速度可控：支持键盘步进、鼠标区域控制、暂停恢复
- 阅读友好：尽量保留你原本内容的格式和重音标注
- 场景适配：支持定义屏幕比例，便于匹配不同监看屏和提词屏

## Introduction (English)
paste-to-cue is a lightweight teleprompter for recording, livestreaming, and content creation.
Its main idea is simple: if your script is already prepared in a table document, just paste it and start cueing.

Instead of scrolling a raw spreadsheet directly, paste-to-cue provides teleprompter-focused controls:
- Fine-grained speed control with keyboard and mouse zone input
- Pause/resume behavior designed for real shooting workflows
- Better readability by preserving formatted content and stress/accent marks
- Custom screen aspect ratio support for different display setups

## 项目缘起
之前帮同事拍视频时，直接滚动表格并不方便：
- 节奏不稳定，速度很难细调
- 画面和操作区域不够聚焦
- 临时改稿时体验不好

最近我也在准备做自媒体，于是做了这个简单项目：把做好的提词器表格内容直接粘贴进来，就能马上开始使用。

## 核心特色
- 直接粘贴已整理好的表格文案
- 保留格式与重音标注，适合口播与镜头前阅读
- 鼠标控制区 + 键盘控制，快速调整节奏
- 支持灵敏度（Sensitivity）与速度平滑（Smoothing）
- 支持定义屏幕比例（自由比例 / 预设比例 / 自定义宽高）

## 使用方式
1. 打开页面。
2. 在内容区粘贴你的文案（可包含表格格式和重音标注）。
3. 用空格开始/暂停。
4. 用方向键或 W/S 微调滚动速度。

## 快捷键
- 开始/暂停：Space / P
- 加速：ArrowDown / S
- 减速：ArrowUp / W
- 缩放+：= / Num+
- 缩放-：- / Num-

## 说明
- 暂停后恢复时，会先应用暂停前速度。
- 若恢复时鼠标位于控制区，会再按鼠标位置应用一次速度。
- 暂停状态按方向键，会直接开始滚动，并从 0 速度基线应用方向键步进。

## 通过 OBS 使用提词器
1. 打开提词器页面并粘贴文案。
2. 在 OBS 中添加窗口采集，选择提词器窗口。
3. 如果你使用的是反射式提词方案（镜前提词），在 OBS 里对该源执行右键镜像翻转（通常为水平翻转）。
4. 如果你使用的是正投屏（无需镜像的方案），可跳过上一步。
5. 在 OBS 中将画面全屏投影到对应提词屏幕（或监看屏）。

## 未来更新计划
1. 本地多窗口协同：可同时开多个窗口，减少对 OBS 投屏 + 水平镜像的依赖。
2. 多语言版本：提供更多语言界面与提示文案。
3. 直接输入文本并简单标注：除了粘贴表格外，也支持原生输入和基础标记。
