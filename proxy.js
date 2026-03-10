const http = require('http');
const httpProxy = require('http-proxy');

// Create a proxy server with custom application logic
const proxy = httpProxy.createProxyServer({});

// Listen on 19000 (which ngrok points to)
// Route / to Flask on 19001
// Route WebSockets to 6001

const server = http.createServer(function(req, res) {
  proxy.web(req, res, { target: 'http://127.0.0.1:19001' }, function(e) {
    res.writeHead(502);
    res.end("Bad gateway (Flask down)");
  });
});

server.on('upgrade', function(req, socket, head) {
  proxy.ws(req, socket, head, { target: 'ws://127.0.0.1:6001' });
});

server.listen(19000, () => {
  console.log("Unified Proxy running on port 19000");
  console.log("-> HTTP routes to 19001 (Flask)");
  console.log("-> WS routes to 6001 (Event Bus)");
});
