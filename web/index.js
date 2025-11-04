require('dotenv').config();
const express = require("./config/express");
module.exports = (service) => {
    const { server } = express(service);
    server.listen(process.env.WEB_SERVER_PORT, (err) => {
        if (err)
            console.log(err);
        else
            console.log(`Server running on port ${process.env.WEB_SERVER_PORT}`);
    });
}