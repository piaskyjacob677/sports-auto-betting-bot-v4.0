const express = require('express');
const router = express.Router();
const GeneralCtr = require("../controllers/general");
module.exports = (service) => {
    const generalCtr = new GeneralCtr(service);
    router.get('/skins', (req, res, next)=>generalCtr.skins(req, res, next));
    router.get('/teams', (req, res, next)=>generalCtr.teams(req, res, next));
    router.post('/bet', (req, res, next)=>generalCtr.bet(req, res, next));
    return router;
}