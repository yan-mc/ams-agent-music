# @ams/agent-music-ui

嘉音Studio Kernel 界面换标客户端插件（独立于内核源码）。

- 通过 DSH Client 插件机制加载到 Kernel Web 页面；
- 运行时替换：窗口/页面标题、鲸鱼品牌图标（hero 与左上角）、品牌文字（DeepSeek / 探索未至之境 → 嘉音Studio）、favicon；
- 不修改 Kernel 二进制、不修改 `_harness_full` 源码；卸载插件即恢复原样；
- 与 `@ams/agent-music`、`@ams/agent-music-bundle` 一起安装（bundle patch 同时插入 Host 与 Client 两个插件）。
