const cors = require('cors');
const http = require('http');
const morgan = require("morgan")
const { resolveApp } = require("../utils/path")

module.exports = (service) => {
    const express = require('express');
    const app = express();
    app.use(cors({ origin: /./, credentials: true }));
    app.use(express.json({ limit: "100mb" }));
    app.use(express.urlencoded({ extended: true }));
    app.use(morgan());
    app.use('/api/general', require('../routes/general')(service));

    app.use("/bet", express.static(resolveApp("./web/dist")));
    app.use(/\/bet\/.*/, (req, res) => res.sendFile(resolveApp("./web/dist/index.html")));

    const server = http.createServer(app);
    return { app, server };
}