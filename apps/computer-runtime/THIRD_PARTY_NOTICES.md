# Third-party notices

`seccomp_profile.json` is redistributed from Microsoft Playwright, commit `b630e71fcda7885885c459bcbb88e5bfa7c0a1ac`, `utils/docker/seccomp_profile.json`.

Copyright (c) Microsoft Corporation. Licensed under Apache License 2.0. The complete license is in `licenses/PLAYWRIGHT-Apache-2.0.txt`. The profile adds an unconditional chroot syscall rule for Chromium's unprivileged user-namespace sandbox. The container still drops all host capabilities; this does not grant host CAP_SYS_CHROOT. Other upstream rules are preserved.

The operator TypeScript implementation uses architectural concepts examined in Open Dots (`tharolankit19-create/open-dots`, commit `01f12886eaa687266d9b8705d18ab8f4f178994c`). No Open Dots source files or proprietary product assets are included in this implementation.
