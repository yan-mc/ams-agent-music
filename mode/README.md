# @ams/agent-music-mode

「音乐制作」Agent preset 的辅助 Host 插件：

- 新会话创建时（`agent/created`）把该会话工作目录切到嘉音Studio 安装目录下的 `data`；
- 目录动态解析：`AMS_HOME` → Kernel 工作目录的父目录 → `DSH_HOME` → 旧安装默认，不写死盘符；
- 只影响音乐制作 preset 创建的会话，标准/创造模式不受影响。

由 `@ams/agent-music-bundle` 的 preset 行包含；安装 Agent 插件时一起安装。
