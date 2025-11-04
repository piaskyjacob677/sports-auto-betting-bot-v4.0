const fs = require("fs");
const fetch = require("node-fetch");
const { prettyLog } = require("../utils/log.js");
const { JSDOM } = require("jsdom")
const tolerances = require("../data/tolerances.json");
const { findNormalizedTeamName, getAlias, cleanTeamName, cleanGpd, checkTolerance } = require("../utils/alias.js");
const accounts = require("../data/accounts.json");

class Abcwager {
    constructor() {
        this.serviceName = "Action";
        this.isReady = false;
        this.matches = {};
        this.allMatches = {};
        this.uids = [];
        this.aiRequests = 0;
        this.accounts = accounts[this.serviceName];
    }
    async getLeagues(sessinoId) {
        let leagueList = [];
        try {
            const response = await fetch("https://wager.abcwagering.ag/wager/CreateSports.aspx?WT=0", {
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
                    "cookie": `pl=; ASP.NET_SessionId=${sessinoId}; idSiteCookie=tagAgentURL=http://www.abcwagering.ag`,
                    "Referer": "https://wager.abcwagering.ag/DefaultLogin.aspx"
                },
                "body": null,
                "method": "GET"
            });
            const result = await response.text();
            const dom = new JSDOM(result);
            let blocks = Array.from(dom.window.document.querySelectorAll("div.leaguesblock") || []);

            for (const block of blocks) {
                const sport = block.querySelector("h3").textContent.trim();
                const leagues = block.querySelectorAll("div.leagueevent");
                for (const league of leagues) {
                    const id = league.querySelector("input").getAttribute("value");
                    let desc = league.textContent.trim();
                    desc = desc.includes(sport) ? desc : `${sport} ${desc}`;
                    leagueList.push({ id, sport, desc })
                }
            }

        } catch (error) {
            console.log(this.serviceName, error);
        }
        return leagueList;
    }
    async getLeagueMatches(league, sessinoId) {
        try {
            let sport = league.sport;
            const desc = league.desc;

            if (sport.includes("SOC")) sport = "SOC";
            else if (sport == "MMA") sport = "FIGHTING";
            else if (sport.includes("TENNIS")) sport = "TENNIS";
            else if (desc.includes("NFL")) sport = "NFL";
            else if (desc.includes("WNBA")) sport = "WNBA";
            else if (desc.includes("NBA")) sport = "NBA";
            else if (desc.includes("MLB")) sport = "MLB";
            else if (desc.includes("MiLB")) sport = "MiLB";
            else if (desc.includes("NHL") || desc.includes("NATIONAL HOCKEY LEAGUE")) sport = "NHL";
            else if (sport.replace(/\s+/g, "").includes("NCAAF")) sport = "CFB";
            else if (sport.replace(/\s+/g, "").includes("NCAAB")) sport = "CBB";

            const response = await fetch(`https://wager.abcwagering.ag/wager/splitschedule.aspx?wt=0&lg=${league.id}`, {
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
                    "cookie": `pl=; ASP.NET_SessionId=${sessinoId}; idSiteCookie=tagAgentURL=http://www.abcwagering.ag`,
                    "Referer": "https://wager.abcwagering.ag/wager/CreateSports.aspx?WT=0"
                },
                "body": null,
                "method": "GET"
            });

            const data = await response.text();
            const dom = new JSDOM(data);
            const document = dom.window.document;
            let games = [...document.querySelectorAll("div.ScheduleGameEven"), ...document.querySelectorAll("div.ScheduleGameOver")];
            games = games.map(v => {
                const team = v.querySelector("img[src^='/App_Themes/ThemeLogo/images/teams/']");
                const content = team ? team.parentElement.textContent.replace(/[\t\n\r]/g, "").replace(/ +/g, " ").trim() : v.textContent.replace(/[\t\n\r]/g, "").replace(/ +/g, " ").trim();
                const [team1, team2] = content.split(")").map(v => v.trim());

                const sprd1 = v.querySelector('input[value^="0_"]');
                const sprd2 = v.querySelector('input[value^="1_"]');
                const to = v.querySelector('input[value^="2_"]');
                const tu = v.querySelector('input[value^="3_"]');
                const ml1 = v.querySelector('input[value^="4_"]');
                const ml2 = team2 ? v.querySelector('input[value^="5_"]') : v.querySelector('input');
                const draw = v.querySelector('input[value^="6_"]');

                return {
                    team1: team2 ? team1.split("(")[0] : "",
                    team2: team2 ? team2.split("(")[0] : team1.split("(")[0],
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
                if (gm.tto1) {
                    const points = Number(gm.tto1.split("_")[2]);
                    const odds = Number(gm.tto1.split("_")[3]);
                    this.allMatches[`${gm.team1} Team totals o${-points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.tto1, points, odds };
                }
                if (gm.ttu1) {
                    const points = Number(gm.ttu1.split("_")[2]);
                    const odds = Number(gm.ttu1.split("_")[3]);
                    this.allMatches[`${gm.team1} Team totals u${points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.ttu1, points, odds };
                }
                if (gm.tto2) {
                    const points = Number(gm.tto2.split("_")[2]);
                    const odds = Number(gm.tto2.split("_")[3]);
                    this.allMatches[`${gm.team2} Team totals o${-points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.tto2, points, odds };
                }
                if (gm.ttu2) {
                    const points = Number(gm.ttu2.split("_")[2]);
                    const odds = Number(gm.ttu2.split("_")[3]);
                    this.allMatches[`${gm.team2} Team totals u${points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, sel: gm.ttu2, points, odds };
                }
            }

            fs.writeFileSync("matches/abcwager_all.json", JSON.stringify(this.allMatches, null, 2));

            if (desc.includes("PROP") || desc.includes("Score")) return true;
            if (!["NBA", "WNBA", "CBB", "NFL", "CFB", "SOC", "MLB", "MiLB", "NHL", "FIGHTING", "TENNIS"].includes(sport)) return true;
            let unNormalizedTeams = [];

            for (const gm of games) {
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
                if (gm.to) data["vtm"]["to"] = { ...base, sel: gm.to, points: gm.to.split("_")[2], odds: gm.to.split("_")[3] };
                if (gm.to) data["htm"]["to"] = { ...base, sel: gm.to, points: gm.to.split("_")[2], odds: gm.to.split("_")[3] };
                if (gm.tu) data["vtm"]["tu"] = { ...base, sel: gm.tu, points: gm.tu.split("_")[2], odds: gm.tu.split("_")[3] };
                if (gm.tu) data["htm"]["tu"] = { ...base, sel: gm.tu, points: gm.tu.split("_")[2], odds: gm.tu.split("_")[3] };
                if (gm.tto1) data["vtm"]["tto"] = { ...base, sel: gm.tto1, points: gm.tto1.split("_")[2], odds: gm.tto1.split("_")[3] };
                if (gm.ttu1) data["vtm"]["ttu"] = { ...base, sel: gm.ttu1, points: gm.ttu1.split("_")[2], odds: gm.ttu1.split("_")[3] };
                if (gm.tto2) data["htm"]["tto"] = { ...base, sel: gm.tto2, points: gm.tto2.split("_")[2], odds: gm.tto2.split("_")[3] };
                if (gm.ttu2) data["htm"]["ttu"] = { ...base, sel: gm.ttu2, points: gm.ttu2.split("_")[2], odds: gm.ttu2.split("_")[3] };

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
            fs.writeFileSync("matches/abcwager.json", JSON.stringify(this.matches, null, 2));

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
            const response = await fetch("https://wager.abcwagering.ag/DefaultLogin.aspx", {
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
                    "cookie": "pl=; ASP.NET_SessionId=; idSiteCookie=tagAgentURL=http://www.abcwagering.ag",
                    "Referer": "https://www.abcwagering.ag/"
                },
                "body": `siteID=11&errorURL=%2F%2Fwww.abcwagering.ag%2F%3Flogin-error&account=${account.username}&password=${account.password}`,
                "method": "POST"
            });
            const cookie = response.headers.get('set-cookie');
            const sessionId = cookie.match(/ASP\.NET_SessionId=([^;]+)/)[1];
            account.sessionId = sessionId;

            await fetch("https://wager.abcwagering.ag/login.aspx", {
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
                    "upgrade-insecure-requests": "1",
                    "cookie": `pl=; ASP.NET_SessionId=${sessionId}; idSiteCookie=tagAgentURL=http://www.abcwagering.ag`,
                    "Referer": "https://wager.abcwagering.ag/DefaultLogin.aspx"
                },
                "body": `Account=${account.username}&Password=${account.password}&IdBook=6&Redir=&ErrorURL=%2F%2Fwww.abcwagering.ag%2F%3Flogin-error&SiteID=11`,
                "method": "POST",
                "redirect": "manual"
            });

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
            const response = await fetch(`https://wager.abcwagering.ag/wager/CreateWager.aspx?lg=${leagueID}&wt=0&sel=${selection}`, {
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
                    "cookie": `pl=; ASP.NET_SessionId=${account.sessionId}; idSiteCookie=tagAgentURL=http://www.abcwagering.ag`,
                    "Referer": `https://wager.abcwagering.ag/wager/splitschedule.aspx?wt=0&lg=${leagueID}`
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
            const response = await fetch("https://wager.abcwagering.ag/wager/CreateWager.aspx?lg=1&sel=0_18667355_9.5_-115&wt=0", {
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
                    "cookie": "pl=; ASP.NET_SessionId=xcsxyw45r4hcws554py4cgy3; idSiteCookie=tagAgentURL=http://www.abcwagering.ag",
                    "Referer": "https://wager.abcwagering.ag/wager/CreateWager.aspx?lg=1&wt=0&sel=0_18667355_9.5_-115"
                },
                "body": `__EVENTTARGET=&__EVENTARGUMENT=&__LASTFOCUS=&__VIEWSTATE=${encodeURIComponent(viewState)}&__VIEWSTATEGENERATOR=${encodeURIComponent(viewStateGenerator)}&__EVENTVALIDATION=${encodeURIComponent(eventValidation)}&BUY_${selection.split("_")[1]}_0=0&ctl00%24WagerContent%24chkPostBack=on&UseSameAmount=0&WAMT_=${stake}&ctl00%24WagerContent%24btn_Continue1=Continue&RISKWIN=0`,
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
            const response = await fetch("https://wager.abcwagering.ag/wager/ConfirmWager.aspx?WT=0", {
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
                    "cookie": `pl=; ASP.NET_SessionId=${account.sessionId}; idSiteCookie=tagAgentURL=http://www.abcwagering.ag`,
                    "Referer": `https://wager.abcwagering.ag/wager/CreateWager.aspx?lg=${betslip.idlg}&sel=${betslip.sel}`
                },
                "body": `__EVENTTARGET=&__EVENTARGUMENT=&__VIEWSTATE=${encodeURIComponent(viewState)}&__VIEWSTATEGENERATOR=${encodeURIComponent(viewStateGenerator)}&__EVENTVALIDATION=${encodeURIComponent(eventValidation)}&password=${account.password}&RMV_0=&ctl00%24WagerContent%24btn_Continue1=Continue`,
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

module.exports = Abcwager;
