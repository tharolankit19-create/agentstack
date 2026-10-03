import { createServer } from "node:http";
import { connect } from "node:net";
import { resolvePublic } from "./security.mjs";
const allowed = new Set(JSON.parse(process.env.KRYX_ALLOWED_DOMAINS || "[]"));
const server = createServer((_req, res) => {
  res.writeHead(403);
  res.end();
});
server.on("connect", async (req, client, head) => {
  let socket;
  try {
    const u = new URL("https://" + req.url);
    if ((u.port && u.port !== "443") || !allowed.has(u.hostname.toLowerCase()))
      throw new Error("Domain blocked");
    const ip = await resolvePublic(u.hostname);
    socket = connect({ host: ip, port: 443 });
    socket.setTimeout(60000, () => socket.destroy());
    socket.once("connect", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) socket.write(head);
      socket.pipe(client);
      client.pipe(socket);
    });
    socket.on("error", () => client.destroy());
    client.on("error", () => socket.destroy());
  } catch {
    client.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket?.destroy();
  }
});
server.listen(8080, "0.0.0.0");
