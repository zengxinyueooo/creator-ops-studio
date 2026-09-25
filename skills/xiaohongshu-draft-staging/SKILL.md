---
name: xiaohongshu-draft-staging
description: 将本项目已审核 Brief、最终选图和已保存文案版本，暂存到当前 Chrome 登录的小红书创作者中心草稿箱，供人工复核及发布。仅用于用户明确点击暂存或提出同等请求；不执行正式发布。
---

# 小红书草稿暂存

本 Skill 的终点是创作者中心**草稿箱**，不是公开发布。用户在「文案工作台」选定已保存版本后点击「暂存到小红书草稿箱」；也可明确要求代理暂存某个版本。

## 前置核对

- Brief 状态为 `approved`，保存版本的 `generation_meta.brief` 与当前 Brief 一致。
- 当前标题、正文、话题标签已保存；若编辑器有未保存修改，先请用户保存。
- 当前选图顺序与版本的 `generation_meta.assetIds` 完全一致；图片为可用状态，第一张是封面，数量 1–9 张。
- 本机 Chrome 已登录**目标**小红书创作者账号，OpenCLI 扩展已连接。若无法确认账号或遇到登录、验证页面，停止并请用户处理。

## 执行

1. 使用项目页面按钮时，页面创建绑定用户、账号、选题与草稿版本的 `xhs_draft_staging` 任务。Pi Worker 必须先调用 `get_draft_staging_context`，由宿主重新读取数据库并核对已保存版本、Brief、选图顺序和素材状态；再调用一次 `stage_xiaohongshu_draft`。不要自行选择其他草稿 ID、图片或内容。
2. 暂存工具使用本地 Vite bridge 和 OpenCLI：从当前 Supabase 素材库签名 URL 下载图片到临时目录，调用 `xiaohongshu publish` 时始终带 `--draft true`；成功或失败都会清理临时图片。外部提交前先记录开始状态；结果不明时停止，不自动再次提交。仅开发机本地页面和 Worker 具备此能力。
3. 直接从对话执行时，先按 `opencli-usage` 检查 `opencli doctor` 和当前适配器帮助。读取保存的文案及最终选图，确认素材所属账号和顺序；将图片准备为本地文件后，调用 `opencli xiaohongshu publish <正文> --title <标题> --images <按顺序逗号分隔的本地路径> --topics <逗号分隔的话题> --draft true --window foreground --keep-tab true -f json`。不得省略 `--draft true`。
4. 只有 OpenCLI 返回「暂存成功」后才报告完成；可只读核对草稿箱中的标题、图片数和内容。结果不明确时，先核对草稿箱再决定是否重试，避免重复草稿。

## 停止边界

暂存不会调用项目的「标记已发布」，不会累计素材使用次数。请用户在**同一 Chrome 登录环境**的创作者中心打开草稿、调整并自行发布。小红书网页草稿可能保存在该浏览器本地，不能承诺与手机或其他浏览器同步。验证码、账号不一致、图片上传或保存状态不明时停止，不自行点击正式发布。
