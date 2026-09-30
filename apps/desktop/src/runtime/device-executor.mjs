/**
 * Platform-independent local execution contract.
 *
 * Cloud planning is not allowed to reach platform-specific automation directly.
 * The device runtime exposes these capabilities; planners assign only work the
 * selected device reports as supported.
 */
export class DeviceExecutor {
  async capabilities() { throw new Error("Not implemented"); }
  async openApp(_request) { throw new Error("Not implemented"); }
  async inspectUI(_request) { throw new Error("Not implemented"); }
  async tap(_request) { throw new Error("Not implemented"); }
  async type(_request) { throw new Error("Not implemented"); }
  async scroll(_request) { throw new Error("Not implemented"); }
  async swipe(_request) { throw new Error("Not implemented"); }
  async readScreen(_request) { throw new Error("Not implemented"); }
  async openURL(_request) { throw new Error("Not implemented"); }
  async captureScreen(_request) { throw new Error("Not implemented"); }
  async notifyUser(_request) { throw new Error("Not implemented"); }
}
