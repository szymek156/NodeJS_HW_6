const http          = require("http");
const StringDecoder = require("string_decoder").StringDecoder;
const url           = require("url");
const cluster       = require("cluster");

let server = {};

server.unifiedServer = function(req, res) {
    let decoder = new StringDecoder("utf-8");

    // Payload in HTTP request comes in streams
    let buffer = "";

    // When chunk of data is ready, append it to the buffer
    req.on("data", function(data) {
        buffer += decoder.write(data);
    });

    // End is always called, even if there is no payload
    req.on("end", function() {
        buffer += decoder.end();

        let parsedUrl = url.parse(req.url, true);                      // Split endpoint from query
        let path      = parsedUrl.pathname.replace(/^\/+|\/+$/g, "");  // Trim redundant slashes

        var data = {
            "endpoint": path,
            "method": req.method.toLowerCase(),
            "headers": req.headers,
            "payload": buffer
        };

        console.log(`HTTP Request dump:
            ${JSON.stringify(data)}`);

        // Route requests
        let handler = path in server.router ? server.router[path] : handlers.notFound;
        // let result  = await handler(data);

        handler(data).then((result) => {
            res.setHeader("Content-Type", "application/json");
            res.writeHead(result.status);
            res.end(result.payload);

            console.log(`response with status ${result.status} ${result.payload}`);
        })
    });
};


let handlers = {};

handlers.hello = async function(data) {
    let response = {status: 400, payload: "Bad request"};

    if (data.method === "post") {
        response.status = 200;

        if (data.payload && data.payload.length > 0) {
            response.payload = `Echo! Your payload: ${JSON.stringify(data.payload)}`;
        } else {
            response.payload = "Echo! Nothing in payload :O";
        }
    }

    // return Promise.resolve(response) -> JS does this automagically
    return response;
};

handlers.notFound = async function() {
    return {status: 400, payload: "Bad request"};
};

server.router = {
    hello: handlers.hello
};

const CPUs = require("os").cpus().length


if (cluster.isMaster) {
    for (let i = 0; i < CPUs; i++) {
        cluster.fork();
    }
}
else {
    server.httpServer = http.createServer(server.unifiedServer);

    server.httpServer.listen(3000, function() {
        console.log(`Server with PID ${process.pid} is listening on port 3000`);
    });
}
