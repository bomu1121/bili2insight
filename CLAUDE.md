# Language / 语言

- 项目面向中文用户，所有面向用户的 UI 文本（Vue 模板中的标签、按钮、提示、占位符、状态文本等）必须使用简体中文，不得使用英文。
- 代码注释、变量名、commit message 可以使用中英文，但 UI 文本一律中文。
- 新增功能时，参考已有页面的中文措辞风格，保持一致性。

# Encoding / 编码

- 所有前端源文件（.vue、.ts、.json、.html）必须以 UTF-8 编码保存。
- 编辑文件后，确认文件中的中文字符可正常显示，不得出现乱码（如 Ã¥、æ、ç 等 UTF-8 被误读为 Latin-1 的产物）。
- 如果发现乱码，优先从 git 历史或兄弟分支恢复原始版本，而不是手动修复。

# Editing Constraints / 编辑约束

- 修改已有文件时，保持原有中文文本不变，除非用户明确要求修改文案。
- 从其他分支 cherry-pick 或合并时，注意不要引入英文替换中文或编码损坏。
- 如果任务涉及大量文件修改，完成后扫描所有变更文件的 UI 文本是否正确显示。

# Project Structure / 项目结构

- 前端：Vue 3 + Naive UI + Pinia + vue-router，源码在 src/
- 后端：Tauri (Rust)，源码在 src-tauri/
- Python worker 源码在 ili_worker/
- 分支命名：codex/xxx，主分支：main
