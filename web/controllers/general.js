const catchAsync = require("../utils/catchAsync");
class GeneralCtr {
    constructor(service) {
        this.service = service;
    }
    async skins(req, res, next) {
        return catchAsync(async (req, res, next) => {
            res.send(this.service.services.map(v => ({
                service: v.serviceName,
                title: v.serviceName
            })))
        })(req, res, next)
    }
    async teams(req, res, next) {
        return catchAsync(async (req, res, next) => {
            const service = this.service.services.find(service => service.serviceName == req.query.skin);
            const matches = service.allMatches;
            const teamNames = Object.keys(matches);
            const teams = teamNames.filter(v => v.toLocaleLowerCase().trim().includes((req.query.search || "").toLocaleLowerCase().trim())).map(v => ({
                title: v,
                ...matches[v],
            }))
            res.send(teams.slice(0, 10))
        })(req, res, next)
    }
    async bet(req, res, next) {
        return catchAsync(async (req, res, next) => {
            const service = this.service.services.find(service => service.serviceName == req.body.skin);
            const { betSlip, amount } = req.body;
            const results = await service.betPlaceFromWeb(betSlip, amount);
            res.send(results);
        })(req, res, next)
    }
}

module.exports = GeneralCtr;
