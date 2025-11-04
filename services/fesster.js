const fs = require("fs");
const fetch = require("node-fetch");
const { prettyLog } = require("../utils/log.js");
const { JSDOM } = require("jsdom")
const tolerances = require("../data/tolerances.json");
const { findNormalizedTeamName, getAlias, cleanTeamName, cleanGpd, checkTolerance } = require("../utils/alias.js");
const accounts = require("../data/accounts.json");

class Fesster {
    constructor() {
        this.serviceName = "Fesster";
        this.isReady = false;
        this.matches = {};
        this.allMatches = {};
        this.uids = [];
        this.aiRequests = 0;
        this.accounts = accounts[this.serviceName];
    }
    async getLeagues(sessionId) {
        let leagueList = [];
        try {
            const response = await fetch("https://m.blue987.com/wager/CreateSports.aspx?WT=0", {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "cookie": `ASP.NET_SessionId=${sessionId}; pl=; SERVERID=RN-PLAYER05`,
                    "Referer": "https://m.blue987.com/wager/Wager.aspx"
                },
                "body": null,
                "method": "GET"
            });

            const result = await response.text();
            const dom = new JSDOM(result);
            let sports = Array.from(dom.window.document.querySelectorAll("div.welcome") || []);

            for (const sport of sports) {
                const sportName = sport.querySelector("div.card-header").textContent.replace(/\n|\s+/g, " ").replace("  ", " ").trim();
                const leagues = sport.querySelectorAll("label");
                for (const league of leagues) {
                    const id = league.querySelector("input").getAttribute("value");
                    const name = league.textContent.replace(/\n|\s+/g, " ").replace("  ", " ").trim();
                    leagueList.push({ id, sport: sportName, name })
                }
            }

        } catch (error) {
            console.log(this.serviceName, error);
        }
        return leagueList;
    }
    async getLeagueMatches(league, sessionId) {
        try {
            let sport = league.sport;
            const desc = league.name.includes(sport) ? league.name : `${league.sport} ${league.name}`;

            if (sport.includes("SOC")) sport = "SOC";
            else if (sport.includes("TENNIS")) sport = "TENNIS";
            else if (desc.includes("NFL")) sport = "NFL";
            else if (desc.includes("WNBA")) sport = "WNBA";
            else if (desc.includes("NBA")) sport = "NBA";
            else if (desc.includes("MLB")) sport = "MLB";
            else if (desc.includes("MiLB")) sport = "MiLB";
            else if (desc.includes("NHL")) sport = "NHL";
            else if (desc.replace(/\s+/g, "").includes("NCAAF")) sport = "CFB";
            else if (desc.replace(/\s+/g, "").includes("NCAAB")) sport = "CBB";

            const response = await fetch("https://m.blue987.com/wager/CreateSports.aspx?WT=0", {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "content-type": "application/x-www-form-urlencoded",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "upgrade-insecure-requests": "1",
                    "cookie": `ASP.NET_SessionId=${sessionId}; SERVERID=RN-PLAYER05; pl=`,
                    "Referer": "https://m.blue987.com/wager/CreateSports.aspx?WT=0"
                },
                "body": `__EVENTTARGET=&__EVENTARGUMENT=&lg_${league.id}=${league.id}&ctl00%24WagerContent%24btn_Continue_top=Continue`,
                "method": "POST"
            });;

            const data = await response.text();
            const dom = new JSDOM(data);


            let games = Array.from(dom.window.document.querySelectorAll("div.schedule"));
            games = [...games, ...Array.from(dom.window.document.querySelectorAll("div.tnt-row"))];

            games = games.map(v => {
                const team1 = v.querySelector("div.visitor")?.querySelector("div.team-header");
                const team2 = v.querySelector("div.home")?.querySelector("div.team-header") || v.querySelector("div.tnt-name");
                const sprd1 = v.querySelector('input[value^="0_"]');
                const sprd2 = v.querySelector('input[value^="1_"]');
                const to = v.querySelector('input[value^="2_"]');
                const tu = v.querySelector('input[value^="3_"]');
                const ml1 = v.querySelector('input[value^="4_"]');
                const ml2 = v.querySelector('input[value^="5_"]') || v.querySelector('div.tnt')?.querySelector('input');
                const draw = v.querySelector('input[value^="6_"]');

                return {
                    team1: team1 ? team1.textContent.replace(/\d+ - /g, "").trim() : "",
                    team2: team2 ? team2.textContent.replace(/\d+ - /g, "").trim() : "",
                    sprd1: sprd1 ? sprd1.value : null,
                    sprd2: sprd2 ? sprd2.value : null,
                    to: to ? to.value : null,
                    tu: tu ? tu.value : null,
                    ml1: ml1 ? ml1.value : null,
                    ml2: ml2 ? ml2.value : null,
                    draw: draw ? draw.value : null,
                }
            });

            console.log(prettyLog(this.serviceName, this.aiRequests, sport, desc, games.length));

            for (const gm of games) {
                const base = { sport, desc, idlg: league.id };

                if (gm.sprd1) {
                    const points = Number(gm.sprd1.split("_")[2]);
                    const odds = Number(gm.sprd1.split("_")[3]);
                    this.allMatches[`${gm.team1} ${points == 0 ? "PK" : points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.sprd1, points, odds };
                }
                if (gm.sprd2) {
                    const points = Number(gm.sprd2.split("_")[2]);
                    const odds = Number(gm.sprd2.split("_")[3]);
                    this.allMatches[`${gm.team2} ${points == 0 ? "PK" : points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.sprd2, points, odds };
                }
                if (gm.ml1) {
                    const odds = Number(gm.ml1.split("_")[3]);
                    this.allMatches[`${gm.team1} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.ml1, points: 0, odds };
                }
                if (gm.ml2) {
                    const odds = Number(gm.ml2.split("_")[3]);
                    this.allMatches[`${gm.team2} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.ml2, points: 0, odds };
                }
                if (gm.draw) {
                    const odds = Number(gm.draw.split("_")[3]);
                    this.allMatches[`${gm.team1} vrs ${gm.team2} Draw ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.draw, points: 0, odds };
                }
                if (gm.to) {
                    const points = Number(gm.to.split("_")[2]);
                    const odds = Number(gm.to.split("_")[3]);
                    this.allMatches[`${gm.team1} vrs ${gm.team2} o${-points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.to, points, odds };
                }
                if (gm.tu) {
                    const points = Number(gm.tu.split("_")[2]);
                    const odds = Number(gm.tu.split("_")[3]);
                    this.allMatches[`${gm.team1} vrs ${gm.team2} u${points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.tu, points, odds };
                }
            }
            fs.writeFileSync("matches/fesster_all.json", JSON.stringify(this.allMatches, null, 2));

            if (desc.includes("PROP") || desc.includes("Score")) return true;
            if (!["NBA", "WNBA", "CBB", "NFL", "CFB", "SOC", "MLB", "MiLB", "NHL", "FIGHTING", "TENNIS"].includes(sport)) return true;
            let unNormalizedTeams = [];

            for (const gm of games) {
                const isTT = `${gm.team1} ${gm.team2}`.toLowerCase().includes("total points");
                const cleanedGpd = cleanGpd(gm.team2);
                const cleanedVtm = cleanTeamName(gm.team1);
                const cleanedHtm = cleanTeamName(gm.team2);
                const [isNormalizedVtm, normalizedVtm] = findNormalizedTeamName(sport, cleanedVtm);
                const [isNormalizedHtm, normalizedHtm] = findNormalizedTeamName(sport, cleanedHtm);

                const teamNames = { vtm: normalizedVtm, htm: normalizedHtm };
                const isNormalized = { vtm: isNormalizedVtm, htm: isNormalizedHtm };
                const base = { sport, desc, idlg: league.id };

                let data = { vtm: {}, htm: {} }
                if (gm.sprd1) data["vtm"]["sprd"] = { ...base, sel: gm.sprd1, points: gm.sprd1.split("_")[2], odds: gm.sprd1.split("_")[3] };
                if (gm.sprd2) data["htm"]["sprd"] = { ...base, sel: gm.sprd2, points: gm.sprd2.split("_")[2], odds: gm.sprd2.split("_")[3] };
                if (gm.ml1) data["vtm"]["ml"] = { ...base, sel: gm.ml1, points: gm.ml1.split("_")[2], odds: gm.ml1.split("_")[3] };
                if (gm.ml2) data["htm"]["ml"] = { ...base, sel: gm.ml2, points: gm.ml2.split("_")[2], odds: gm.ml2.split("_")[3] };
                if (gm.draw) data["vtm"]["draw"] = { ...base, sel: gm.draw, points: gm.draw.split("_")[2], odds: gm.draw.split("_")[3] };
                if (gm.draw) data["htm"]["draw"] = { ...base, sel: gm.draw, points: gm.draw.split("_")[2], odds: gm.draw.split("_")[3] };
                if (gm.to && !isTT) data["vtm"]["to"] = { ...base, sel: gm.to, points: gm.to.split("_")[2], odds: gm.to.split("_")[3] };
                if (gm.to && !isTT) data["htm"]["to"] = { ...base, sel: gm.to, points: gm.to.split("_")[2], odds: gm.to.split("_")[3] };
                if (gm.tu && !isTT) data["vtm"]["tu"] = { ...base, sel: gm.tu, points: gm.tu.split("_")[2], odds: gm.tu.split("_")[3] };
                if (gm.tu && !isTT) data["htm"]["tu"] = { ...base, sel: gm.tu, points: gm.tu.split("_")[2], odds: gm.tu.split("_")[3] };
                if (gm.to && isTT) data["htm"]["tto"] = { ...base, sel: gm.to, points: gm.to.split("_")[2], odds: gm.to.split("_")[3] };
                if (gm.tu && isTT) data["htm"]["ttu"] = { ...base, sel: gm.tu, points: gm.tu.split("_")[2], odds: gm.tu.split("_")[3] };

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
            fs.writeFileSync("matches/fesster.json", JSON.stringify(this.matches, null, 2));

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
            const response = await fetch("https://m.blue987.com/login.aspx", {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "content-type": "application/x-www-form-urlencoded",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-site",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "cookie": `SERVERID=RN-PLAYER${account.playerId.toString().padStart(2, "0")}; pl=`,
                    "Referer": "https://www.blue987.com/"
                },
                "body": `IdBook=&Account=${account.username.toUpperCase()}&Password=${account.password.toUpperCase()}&Submit=`,
                "method": "POST",
                "redirect": "manual"
            });

            const cookie = response.headers.get('set-cookie');
            account.sessionId = cookie.match(/ASP\.NET_SessionId=([^;]+)/)[1];

        } catch (error) {
            console.log(this.serviceName, error);
        }

        return account;
    }
    async getViewState(account, leagueID, selection) {
        let viewState = null;
        let viewStateGenerator = null;
        let eventValidation = null;

        try {
            const response = await fetch(`https://m.blue987.com/wager/CreateWager.aspx?WT=0&lg=${leagueID}&sel=${selection}`, {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "cookie": `ASP.NET_SessionId=${account.sessionId}; SERVERID=RN-PLAYER${account.playerId.toString().padStart(2, "0")}; pl=`,
                    "Referer": "https://m.blue987.com/wager/CreateSports.aspx?WT=0"
                },
                "body": null,
                "method": "GET"
            });
            const data = await response.text();
            viewState = data.match(/name="__VIEWSTATE".*?value="([^"]+)"/)[1];
            viewStateGenerator = data.match(/name="__VIEWSTATEGENERATOR".*?value="([^"]+)"/)[1];
            eventValidation = data.match(/name="__EVENTVALIDATION".*?value="([^"]+)"/)[1];

        } catch (error) {
            console.log(this.serviceName, error);
        }
        return { viewState, viewStateGenerator, eventValidation };
    }
    async createWager(account, leagueID, selection, stake) {
        let { viewState, viewStateGenerator, eventValidation } = await this.getViewState(account, leagueID, selection);

        try {
            const response = await fetch(`https://m.blue987.com/wager/CreateWager.aspx?WT=0&lg=${leagueID}&sel=${selection}`, {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "content-type": "application/x-www-form-urlencoded",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "cookie": `ASP.NET_SessionId=${account.sessionId}; SERVERID=RN-PLAYER${account.playerId.toString().padStart(2, "0")}; pl=`,
                    "Referer": "https://m.blue987.com/wager/CreateWager.aspx?WT=0&lg=1&sel=0_5058369_-3_100"
                },
                "body": `__EVENTTARGET=&__EVENTARGUMENT=&__LASTFOCUS=&__VIEWSTATE=${encodeURIComponent(viewState)}&__VIEWSTATEGENERATOR=${encodeURIComponent(viewStateGenerator)}&__EVENTVALIDATION=${encodeURIComponent(eventValidation)}&BUY_${selection.split("_")[1]}_0=0&RISKWIN=0&WAMT_=${stake}&UseSameAmount=0&ctl00%24WagerContent%24chkPostBack=on&ctl00%24WagerContent%24btn_Continue1=Continue`,
                "method": "POST"
            });
            const data = await response.text();
            viewState = data.match(/name="__VIEWSTATE".*?value="([^"]+)"/)[1];
            viewStateGenerator = data.match(/name="__VIEWSTATEGENERATOR".*?value="([^"]+)"/)[1];
            eventValidation = data.match(/name="__EVENTVALIDATION".*?value="([^"]+)"/)[1];
        }
        catch (error) {
            console.log(this.serviceName, error);
        }
        return { viewState, viewStateGenerator, eventValidation };
    }
    async placebet(account, betslip, inputPoints, inputOdds, stake) {
        if (account.sessionId == null) return { service: this.serviceName, account, msg: "Session expired" };

        const pointsTolerance = tolerances.Points[betslip.sport] || 0;
        const oddsTolerance = tolerances.Cents[betslip.sport] || 10;

        const selection = [...betslip.sel.split("_").slice(0, 2), inputPoints, inputOdds].join("_");
        const idmk = Number(selection[0]);

        const { viewState, viewStateGenerator, eventValidation } = await this.createWager(account, betslip.idlg, betslip.sel, stake);

        try {
            const response = await fetch("https://m.blue987.com/wager/ConfirmWager.aspx?WT=0", {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "content-type": "application/x-www-form-urlencoded",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "cookie": `ASP.NET_SessionId=${account.sessionId}; SERVERID=RN-PLAYER${account.playerId.toString().padStart(2, "0")}; pl=`,
                    "Referer": "https://m.blue987.com/wager/CreateWager.aspx?WT=0&lg=1&sel=0_5058369_-3_100"
                },
                "body": `__EVENTTARGET=&__EVENTARGUMENT=&__VIEWSTATE=${encodeURIComponent(viewState)}&__VIEWSTATEGENERATOR=${encodeURIComponent(viewStateGenerator)}&__EVENTVALIDATION=${encodeURIComponent(eventValidation)}&RMV_0=&password=${account.password.toUpperCase()}&ctl00%24WagerContent%24btn_Continue1=Continue`,
                "method": "POST"
            });
            const data = await response.text();
            const lineChange = data.match(/LineChange text-danger">([^<]+)</)?.[1]?.replace("&frac12;", ".5").replace("&frac14;", ".25").replace("&frac34;", ".75").trim();
            if (lineChange) {
                const bookPoints = String(Number(lineChange.match(/^[+-]?[0-9.]+/)));
                const bookOdds = String(Number(lineChange.match(/[+-]?[0-9.]+$/)));
                if (!checkTolerance(bookPoints, bookOdds, inputPoints, inputOdds, pointsTolerance, oddsTolerance, idmk == 2 || idmk == 3 ? "total" : "")) {
                    return { service: this.serviceName, account, msg: `Game line change. ${inputPoints}/${inputOdds} ➝ ${bookPoints}/${bookOdds}` };
                }
                return await this.placebet(account, { ...betslip, sel: [...selection.split("_").slice(0, 2), bookPoints, bookOdds].join("_") }, bookPoints, bookOdds, stake)
            }
            else {
                let msg = "Success";
                if (data.includes("The Following Error Occurred")) msg = "Error occurred";
                return { service: this.serviceName, account, msg };
            }
        }
        catch (error) {
            return { service: this.serviceName, account, msg: error.message };
        }
    }
    async place(betTeamName, period, marketName, inputPoints, inputOdds, stake) {
        const betslip = this.matches[betTeamName][period][marketName];
        let outputs = [];
        for (let account of this.accounts) {
            if (account.playerToken == null) account = await this.userLogin(account);
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

module.exports = Fesster;
