/*
 * The managed render container blocks uv_interface_addresses(). Remotion only
 * uses this list to choose a localhost bind address, so provide the loopback
 * interface during renders. This file is not bundled into the video.
 */
const os = require('node:os');

try {
  os.networkInterfaces();
} catch {
  os.networkInterfaces = () => ({
    lo: [
      {
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:00',
        internal: true,
        cidr: '127.0.0.1/8',
      },
    ],
  });
}
