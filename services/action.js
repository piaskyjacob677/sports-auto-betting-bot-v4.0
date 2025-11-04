const fs = require("fs");
const fetch = require("node-fetch");
const { prettyLog } = require("../utils/log.js");
const tolerances = require("../data/tolerances.json");
const { findNormalizedTeamName, getAlias, cleanTeamName, cleanGpd, checkTolerance } = require("../utils/alias.js");
const accounts = require("../data/accounts.json");

class Action {
    constructor() {
        this.serviceName = "Action";
        this.isReady = false;
        this.matches = {};
        this.allMatches = {};
        this.uids = [];
        this.aiRequests = 0;
        this.accounts = accounts[this.serviceName];
    }
    async getLeagues(sessionId) {
        let leagues = [];
        try {
            const response = await fetch("https://backend.play23.ag/wager/ActiveLeaguesHelper.aspx?WT=0", {
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "referer": "https://backend.play23.ag/wager/CreateSports.aspx?WT=0",
                    "cookie": `ASP.NET_SessionId=${sessionId}`
                }
            });

            const data = await response.json();
            leagues = data?.result || [];

        } catch (error) {
            console.log(this.serviceName, error);
        }
        return leagues;
    }
    async getLeagueMatches(league, sessionId) {
        try {            
            let sport = league.IndexName.replace("INTERNATIONAL", "").trim();
            const desc = league.Description;

            if (sport.includes("SOC")) sport = "SOC";
            else if (sport.includes("NHL")) sport = "NHL";
            else if (sport.includes("NFL")) sport = "NFL";
            else if (sport.includes("WNBA")) sport = "WNBA";
            else if (sport.includes("NBA")) sport = "NBA";
            else if (sport.includes("MLB")) sport = "MLB";
            else if (sport.includes("MiLB")) sport = "MiLB";
            else if (sport.includes("FIGHT")) sport = "FIGHTING";

            const response = await fetch(`https://backend.play23.ag/wager/NewScheduleHelper.aspx?WT=0&lg=${league.IdLeague}`, {
                headers: {
                    "accept": "application/json, text/plain, */*",
                    "referer": `https://backend.play23.ag/wager/NewSchedule.aspx?lg=${league.IdLeague}&WT=0`,
                    "cookie": `ASP.NET_SessionId=${sessionId}`
                }
            });

            const data = await response.json();
            const listLeagues = data?.result?.listLeagues || [];
            const games = listLeagues.reduce((prev, current) => [...prev, ...current], []).map(v => v.Games).reduce((prev, current) => [...prev, ...current], []);

            console.log(prettyLog(this.serviceName, this.aiRequests, sport, desc, games.length));

            for (const gm of games) {
                const base = { sport, desc, idgm: gm.idgm };
                const gl = gm.GameLines[0];

                if (gl.vsprdh) {
                    const points = Number(gl.vsprdt);
                    const odds = Number(gl.vsprdoddst);
                    this.allMatches[`${gm.vtm} ${points == 0 ? "PK" : points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, idmk: 0, points, odds };
                }
                if (gl.hsprdh) {
                    const points = Number(gl.hsprdt);
                    const odds = Number(gl.hsprdoddst);
                    this.allMatches[`${gm.htm} ${points == 0 ? "PK" : points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, idmk: 1, points, odds };
                }
                if (gl.ovh) {
                    const points = Number(gl.ovt);
                    const odds = Number(gl.ovoddst);
                    this.allMatches[`${gm.vtm} vrs ${gm.htm} o${-points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, idmk: 2, points, odds };
                }
                if (gl.unh) {
                    const points = Number(gl.unt);
                    const odds = Number(gl.unoddst);
                    this.allMatches[`${gm.vtm} vrs ${gm.htm} u${points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, idmk: 3, points, odds };
                }
                if (gl.voddsh) {
                    const odds = Number(gl.voddst);
                    this.allMatches[`${gm.vtm} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, idmk: 4, points: 0, odds };
                }
                if (gl.hoddsh) {
                    const odds = Number(gl.hoddst);
                    this.allMatches[`${gm.htm} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, idmk: 5, points: 0, odds };
                }
                if (gl.vspoddst) {
                    const odds = Number(gl.vspoddst);
                    this.allMatches[`${gm.vtm} vrs ${gm.htm} Draw ${odds > 0 ? "+" : ""}${odds}`] = { ...base, idmk: 6, points: 0, odds };
                }
                if (gl.oddsh) {
                    const odds = Number(gl.odds);
                    this.allMatches[`${gm.htm} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, idmk: gm.hnum || gl.tmnum, points: 0, odds };
                }
            }
            fs.writeFileSync("matches/action_all.json", JSON.stringify(this.allMatches, null, 2));

            const notAvailabeDescriptions = [
                "MLB - 3 INNINGS LINE",
                "MLB - 7 INNINGS LINE",
                "MLB - 1ST INNING WINNER (3 WAY)",
                "MLB - TEAM WITH THE HIGHEST SCORING INNING",
                "WTA - TENNIS DOUBLES"
            ];

            if (notAvailabeDescriptions.includes(desc)) return true;
            if (league.IndexName.includes("PROPS")) return true;
            if (league.IndexName.includes("UEFA") || league.IndexName.includes("INTERNATIONAL")) return true;
            if (league.IdSport == "PROP" || league.IdSport == "TNT") return true;
            if (league.IdSport == "MU" && !["TENNIS", "FIGHTING"].includes(sport)) return true;
            if (!["NBA", "WNBA", "CBB", "NFL", "CFB", "SOC", "MLB", "MiLB", "NHL", "FIGHTING", "TENNIS"].includes(sport)) return true;

            let unNormalizedTeams = [];

            for (const gm of games) {
                const isTT = `${gm.htm} ${gm.vtm}`.toLowerCase().includes("team total");
                const cleanedGpd = cleanGpd(gm.htm);
                const cleanedVtm = cleanTeamName(gm.vtm);
                const cleanedHtm = cleanTeamName(gm.htm);
                const [isNormalizedVtm, normalizedVtm] = findNormalizedTeamName(sport, cleanedVtm);
                const [isNormalizedHtm, normalizedHtm] = findNormalizedTeamName(sport, cleanedHtm);
                
                const teamNames = { vtm: normalizedVtm, htm: normalizedHtm };
                const isNormalized = { vtm: isNormalizedVtm, htm: isNormalizedHtm };
                const base = { sport, desc, idgm: gm.idgm };

                let data = { vtm: {}, htm: {} }
                const gl = gm.GameLines[0];
                if (gl.vsprdoddst) data["vtm"]["sprd"] = { ...base, idmk: 0, points: gl.vsprdt, odds: gl.vsprdoddst };
                if (gl.hsprdoddst) data["htm"]["sprd"] = { ...base, idmk: 1, points: gl.hsprdt, odds: gl.hsprdoddst };
                if (gl.voddst) data["vtm"]["ml"] = { ...base, idmk: 4, points: 0, odds: gl.voddst };
                if (gl.hoddst) data["htm"]["ml"] = { ...base, idmk: 5, points: 0, odds: gl.hoddst };
                if (gl.vspoddst) data["vtm"]["draw"] = { ...base, idmk: 6, points: 0, odds: gl.vspoddst };
                if (gl.vspoddst) data["htm"]["draw"] = { ...base, idmk: 6, points: 0, odds: gl.vspoddst };
                if (gl.ovoddst && !isTT) data["vtm"]["to"] = { ...base, idmk: 2, points: gl.ovt, odds: gl.ovoddst };
                if (gl.ovoddst && !isTT) data["htm"]["to"] = { ...base, idmk: 2, points: gl.ovt, odds: gl.ovoddst };
                if (gl.unoddst && !isTT) data["vtm"]["tu"] = { ...base, idmk: 3, points: gl.unt, odds: gl.unoddst };
                if (gl.unoddst && !isTT) data["htm"]["tu"] = { ...base, idmk: 3, points: gl.unt, odds: gl.unoddst };
                if (gl.ovoddst && isTT) data["htm"]["tto"] = { ...base, idmk: 2, points: gl.ovt, odds: gl.ovoddst };
                if (gl.unoddst && isTT) data["htm"]["ttu"] = { ...base, idmk: 3, points: gl.unt, odds: gl.unoddst };

                for (const [key, value] of Object.entries(data)) {
                    const teamName = teamNames[key];
                    if (!isNormalized[key]) {
                        unNormalizedTeams.push(teamName);
                        continue;
                    }

                    if (!this.matches[teamName]) this.matches[teamName] = {};
                    if (!this.matches[teamName][cleanedGpd]) this.matches[teamName][cleanedGpd] = {};

                    for (const [k, v] of Object.entries(value)) {
                        if (!this.uids.includes(`${teamName}-${cleanedGpd}-${k}`) && v.odds != "") {
                            this.matches[teamName][cleanedGpd][k] = v;
                            this.uids.push(`${teamName}-${cleanedGpd}-${k}`);
                        }
                    }
                }
            }
            fs.writeFileSync("matches/action.json", JSON.stringify(this.matches, null, 2));

            if (unNormalizedTeams.length > 0) {
                this.aiRequests++;
                // await getAlias(sport, desc, unNormalizedTeams);
            }

            return true;

        } catch (error) {
            console.log(this.serviceName, error, league);
        }
    }
    async userLogin(account) {
        try {
            const page = await fetch("https://backend.play23.ag/Login.aspx").then(r => r.text());
            const viewState = page.match(/name="__VIEWSTATE".*?value="([^"]+)"/)[1];
            const viewStateGenerator = page.match(/name="__VIEWSTATEGENERATOR".*?value="([^"]+)"/)[1];

            const response = await fetch("https://backend.play23.ag/Login.aspx", {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    "origin": "https://backend.play23.ag",
                    "referer": "https://backend.play23.ag/Login.aspx"
                },
                body: `__VIEWSTATE=${encodeURIComponent(viewState)}&__VIEWSTATEGENERATOR=${viewStateGenerator}&Account=${account.username}&Password=${account.password}&BtnSubmit=`,
                redirect: "manual"
            });

            account.sessionId = response.headers.get('set-cookie').match(/ASP\.NET_SessionId=([^;]+)/)[1];

        } catch (error) {
            console.log(this.serviceName, error);
        }

        return account;
    }
    placebet(account, betslip, points, odds, stake) {
        if (account.sessionId == null) return { service: this.serviceName, account, msg: "Session expired" };

        const pointsTolerance = tolerances.Points[betslip.sport] || 0;
        const oddsTolerance = tolerances.Cents[betslip.sport] || 10;

        return new Promise((resolve, reject) => {
            fetch("https://backend.play23.ag/wager/PostWagerMultipleHelper.aspx", {
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "en-US,en;q=0.9",
                    "content-type": "application/x-www-form-urlencoded",
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Not;A=Brand\";v=\"99\", \"Google Chrome\";v=\"139\", \"Chromium\";v=\"139\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "cookie": `_ga=GA1.2.775897760.1757515491; _ga_X975KR57TW=GS2.2.s1757515491$o1$g0$t1757515491$j60$l0$h0; ASP.NET_SessionId=${account.sessionId}; pl=`,
                    "Referer": "https://backend.play23.ag/wager/CreateWager.aspx"
                },
                "body": `postWagerRequests=%5B%7B%22WT%22%3A%220%22%2C%22open%22%3A0%2C%22IDWT%22%3A%220%22%2C%22sel%22%3A%22${betslip.idmk}_${betslip.idgm}_${points}_${odds}%22%2C%22sameAmount%22%3Afalse%2C%22amountType%22%3A%221%22%2C%22detailData%22%3A%22%5B%7B%5C%22Amount%5C%22%3A%5C%22${stake}%5C%22%2C%5C%22RiskWin%5C%22%3A%5C%220%5C%22%2C%5C%22TeaserPointsPurchased%5C%22%3A0%2C%5C%22IdGame%5C%22%3A${betslip.idgm}%2C%5C%22Play%5C%22%3A${betslip.idmk}%2C%5C%22Pitcher%5C%22%3A0%2C%5C%22Points%5C%22%3A%7B%5C%22BuyPoints%5C%22%3A0%2C%5C%22BuyPointsDesc%5C%22%3A%5C%22%5C%22%2C%5C%22LineDesc%5C%22%3A%5C%22%5C%22%2C%5C%22selected%5C%22%3Atrue%7D%7D%5D%22%2C%22confirmPassword%22%3A%22${account.password}%22%2C%22sameAmountNumber%22%3A%22${stake}%22%2C%22useFreePlayAmount%22%3Afalse%2C%22roundRobinCombinations%22%3A%22%22%7D%5D`,
                "method": "POST"
            }).then(r => r.text()).then(r => {
                try {
                    const res = JSON.parse(r);
                    const wagerResult = res.result[0].WagerPostResult

                    if (wagerResult.ErrorMsg == "GAMELINECHANGE") {
                        const bookPoints = wagerResult.details[0].details[0].OriginalPoints;
                        const bookOdds = wagerResult.details[0].details[0].OriginalOdds;
                        if (checkTolerance(bookPoints, bookOdds, points, odds, pointsTolerance, oddsTolerance, betslip.idmk == 2 || betslip.idmk == 3 ? "total" : "")) {
                            this.placebet(account, betslip, bookPoints, bookOdds, stake).then(resolve);
                        }
                        else {
                            resolve({ service: this.serviceName, account, msg: `Game line change. ${points}/${odds} ➝ ${bookPoints}/${bookOdds}` });
                        }
                    }
                    else if (wagerResult.ErrorMsg) {
                        resolve({ service: this.serviceName, account, msg: wagerResult.ErrorMsg });
                    }
                    else {
                        resolve({ service: this.serviceName, account, msg: "Success" });
                    }
                } catch (error) {
                    resolve({ service: this.serviceName, account, msg: error.message });
                }
            });
        })
    }
    makeUrl(betTeamName, period, marketName, inputPoints, inputOdds) {
        const { idmk, idgm, points, odds } = this.matches[betTeamName][period][marketName];
        return `https://backend.play23.ag/wager/CreateWager.aspx?sel=${idmk}_${idgm}_${inputPoints}_${inputOdds}&WT=0`;
    }
    async place(betTeamName, period, marketName, inputPoints, inputOdds, stake) {
        const betslip = this.matches[betTeamName][period][marketName];

        let outputs = [];
        for (let account of this.accounts) {
            if (account.sessionId == null) account = await this.userLogin(account);
            const result = await this.placebet(account, betslip, inputPoints, inputOdds, stake);
            outputs.push(result);
        }
        return outputs;
    }
    async userManager() {
        while (1) {
            for (let account of this.accounts) {
                account = await this.userLogin(account);
            }
            await new Promise(resolve => setTimeout(resolve, 30 * 60 * 1000));
        }
    }
    async main() {
        await new Promise(resolve => setTimeout(resolve, 5000));

        while (1) {
            this.uids = [];
            let account = this.accounts[0];

            const leagues = await this.getLeagues(account.sessionId);
            if (leagues.length == 0) {
                account = await this.userLogin(account);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            for (const league of leagues) {
                const result = await this.getLeagueMatches(league, account.sessionId);
                if (!result) account = await this.userLogin(account);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            this.isReady = true;
        }
    }
    async betPlaceFromWeb(betslip, stake) {
        let outputs = [];
        for (let account of this.accounts) {
            if (account.sessionId == null) account = await this.userLogin(account);
            const result = await this.placebet(account, betslip, betslip.points, betslip.odds, stake);
            outputs.push(result);
        }
        return outputs;
    }
}

module.exports = Action;
