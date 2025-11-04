const fs = require("fs");
const fetch = require("node-fetch");
const { prettyLog } = require("../utils/log.js");
const { JSDOM } = require("jsdom")
const tolerances = require("../data/tolerances.json");
const { findNormalizedTeamName, getAlias, cleanTeamName, cleanGpd, checkTolerance } = require("../utils/alias.js");
const accounts = require("../data/accounts.json");

class Highroller {
    constructor() {
        this.serviceName = "Highroller";
        this.isReady = false;
        this.matches = {};
        this.allMatches = {};
        this.uids = [];
        this.aiRequests = 0;
        this.accounts = accounts[this.serviceName];
    }
    async getLeagues(cookie) {
        let leagueList = [];

        try {
            const response = await fetch("https://www.thehighroller.net/wager/CreateSports.aspx?WT=0&msg=true", {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Google Chrome\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "cookie": cookie,
                    "Referer": "https://www.thehighroller.net/Login.aspx"
                },
                "body": null,
                "method": "GET"
            });

            const result = await response.text();
            const dom = new JSDOM(result);
            let games = Array.from(dom.window.document.querySelectorAll("div.League") || []);

            for (const gm of games) {
                const sport = gm.querySelector("a").textContent;
                const leagues = gm.querySelectorAll("li");
                for (const league of leagues) {
                    const id = league.querySelector("input").getAttribute("value");
                    const name = league.querySelector("label").textContent;
                    leagueList.push({ id, sport, name })
                }
            }

        } catch (error) {
            console.log(this.serviceName, error);
        }

        return leagueList;
    }
    async getLeagueMatches(cookie, league) {
        try {
            let unNormalizedTeams = [];
            let sport = league.sport;
            const desc = league.name.includes(sport) ? league.name : `${league.sport} ${league.name}`;

            if (sport == "COLLEGE FOOTBALL") sport = "CFB";
            else if (sport == "COLLEGE BASKETBALL") sport = "CBB";
            else if (sport.includes("SOCCER")) sport = "SOC";

            const response = await fetch("https://www.thehighroller.net/wager/CreateSports.aspx?WT=0&msg=true", {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "content-type": "application/x-www-form-urlencoded",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Google Chrome\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "cookie": cookie,
                    "Referer": "https://www.thehighroller.net/wager/CreateSports.aspx?WT=0&msg=true"
                },
                "body": `__EVENTTARGET=&__EVENTARGUMENT=&__VIEWSTATE=%2FwEPDwUKMjA2MzgxOTkwOQ9kFgJmD2QWBmYPZBYmAgwPFQo5L2ltYWdlcy9pY29ucy9pb3MvYXBwbGUtdG91Y2gtaWNvbi0xODB4MTgwLnBuZz92PTMuOC42MC4wNy9pbWFnZXMvaWNvbnMvaW9zL2FwcGxlLXRvdWNoLWljb24tNTd4NTcucG5nP3Y9My44LjYwLjA3L2ltYWdlcy9pY29ucy9pb3MvYXBwbGUtdG91Y2gtaWNvbi02MHg2MC5wbmc%2Fdj0zLjguNjAuMDcvaW1hZ2VzL2ljb25zL2lvcy9hcHBsZS10b3VjaC1pY29uLTcyeDcyLnBuZz92PTMuOC42MC4wNy9pbWFnZXMvaWNvbnMvaW9zL2FwcGxlLXRvdWNoLWljb24tNzZ4NzYucG5nP3Y9My44LjYwLjA5L2ltYWdlcy9pY29ucy9pb3MvYXBwbGUtdG91Y2gtaWNvbi0xMTR4MTE0LnBuZz92PTMuOC42MC4wOS9pbWFnZXMvaWNvbnMvaW9zL2FwcGxlLXRvdWNoLWljb24tMTIweDEyMC5wbmc%2Fdj0zLjguNjAuMDkvaW1hZ2VzL2ljb25zL2lvcy9hcHBsZS10b3VjaC1pY29uLTE0NHgxNDQucG5nP3Y9My44LjYwLjA5L2ltYWdlcy9pY29ucy9pb3MvYXBwbGUtdG91Y2gtaWNvbi0xNTJ4MTUyLnBuZz92PTMuOC42MC4wOS9pbWFnZXMvaWNvbnMvaW9zL2FwcGxlLXRvdWNoLWljb24tMTgweDE4MC5wbmc%2Fdj0zLjguNjAuMGQCDw8VAj8vcmVzb3VyY2VzL2Jvb3RzdHJhcC10b3VyL2Nzcy9ib290c3RyYXAtdG91ci5taW4uY3NzP3Y9My44LjYwLjAzL3Jlc291cmNlcy9ib290c3RyYXAtdG91ci9jc3MvY3VzdG9tLmNzcz92PTMuOC42MC4wZAIQDxYCHgRocmVmBU8vQXBwX1RoZW1lcy9SZXNwb25zaXZlL2Fzc2V0cy9BbGVydGlmeS4zLjguNjAuMC9jc3MvYWxlcnRpZnkubWluLmNzcz92PTMuOC42MC4wZAIRDxYCHwAFVy9BcHBfVGhlbWVzL1Jlc3BvbnNpdmUvYXNzZXRzL0FsZXJ0aWZ5LjMuOC42MC4wL2Nzcy90aGVtZXMvYm9vdHN0cmFwLm1pbi5jc3M%2Fdj0zLjguNjAuMGQCEg8WAh8ABVsvQXBwX1RoZW1lcy9SZXNwb25zaXZlL2Fzc2V0cy9BbGVydGlmeS4zLjguNjAuMC9jc3MvdGhlbWVzL2Jvb3RzdHJhcC5ydGwubWluLmNzcz92PTMuOC42MC4wZAITDxYCHwAFVS9BcHBfVGhlbWVzL1Jlc3BvbnNpdmUvYXNzZXRzL0FsZXJ0aWZ5LjMuOC42MC4wL2Nzcy90aGVtZXMvZGVmYXVsdC5taW4uY3NzP3Y9My44LjYwLjBkAhQPFgIfAAVZL0FwcF9UaGVtZXMvUmVzcG9uc2l2ZS9hc3NldHMvQWxlcnRpZnkuMy44LjYwLjAvY3NzL3RoZW1lcy9kZWZhdWx0LnJ0bC5taW4uY3NzP3Y9My44LjYwLjBkAhUPFgIfAAVWL0FwcF9UaGVtZXMvUmVzcG9uc2l2ZS9hc3NldHMvQWxlcnRpZnkuMy44LjYwLjAvY3NzL3RoZW1lcy9zZW1hbnRpYy5taW4uY3NzP3Y9My44LjYwLjBkAhYPFgIfAAVaL0FwcF9UaGVtZXMvUmVzcG9uc2l2ZS9hc3NldHMvQWxlcnRpZnkuMy44LjYwLjAvY3NzL3RoZW1lcy9zZW1hbnRpYy5ydGwubWluLmNzcz92PTMuOC42MC4wZAIXDxYCHwAFSC9BcHBfVGhlbWVzL1Jlc3BvbnNpdmUvYXNzZXRzL2Nzcy4zLjguNjAuMC9kYXRhdGFibGVzLm1pbi5jc3M%2Fdj0zLjguNjAuMGQCGA8WAh8ABUkvQXBwX1RoZW1lcy9SZXNwb25zaXZlL2Fzc2V0cy9jc3MuMy44LjYwLjAvZGF0ZXJhbmdlcGlja2VyLmNzcz92PTMuOC42MC4wZAIZDxYCHwAFPy9BcHBfVGhlbWVzL1Jlc3BvbnNpdmUvYXNzZXRzL2Nzcy4zLjguNjAuMC9pY29ucy5jc3M%2Fdj0zLjguNjAuMGQCGg8WAh8ABUAvQXBwX1RoZW1lcy9SZXNwb25zaXZlL2Fzc2V0cy9jc3MuMy44LjYwLjAvbW9iaWxlLmNzcz92PTMuOC42MC4wZAIbDxYCHwAFPy9BcHBfVGhlbWVzL1Jlc3BvbnNpdmUvYXNzZXRzL2Nzcy4zLjguNjAuMC9zdHlsZS5jc3M%2Fdj0zLjguNjAuMGQCHA8WAh8ABUgvQXBwX1RoZW1lcy9SZXNwb25zaXZlL2Fzc2V0cy9jc3MuMy44LjYwLjAveHMvZGVmYXVsdDIwMTkuY3NzP3Y9My44LjYwLjBkAh0PFgIfAAVYL0FwcF9UaGVtZXMvUmVzcG9uc2l2ZS9hc3NldHMvc2VsZWN0aXplLjMuOC42MC4wL2Nzcy9zZWxlY3RpemUuYm9vdHN0cmFwMy5jc3M%2Fdj0zLjguNjAuMGQCHg8WAh8ABU0vQXBwX1RoZW1lcy9SZXNwb25zaXZlL2Fzc2V0cy9zZWxlY3RpemUuMy44LjYwLjAvY3NzL3NlbGVjdGl6ZS5jc3M%2Fdj0zLjguNjAuMGQCHw8WAh8ABVUvQXBwX1RoZW1lcy9SZXNwb25zaXZlL2Fzc2V0cy9zZWxlY3RpemUuMy44LjYwLjAvY3NzL3NlbGVjdGl6ZS5kZWZhdWx0LmNzcz92PTMuOC42MC4wZAIgDxYCHwAFVC9BcHBfVGhlbWVzL1Jlc3BvbnNpdmUvYXNzZXRzL3NlbGVjdGl6ZS4zLjguNjAuMC9jc3Mvc2VsZWN0aXplLmxlZ2FjeS5jc3M%2Fdj0zLjguNjAuMGQCAg9kFgZmD2QWLgIDDxYCHgNzcmMFHS9NUy81NDEuaW1nP3Q9bG9nbyZ2PTMuOC42MC4wZAIGDw8WAh4HVmlzaWJsZWhkZAIHDw8WAh8CaGRkAgkPDxYCHwJoZGQCCg8PFgIfAmhkZAILDw8WAh8CaGRkAgwPDxYCHwJoZGQCDQ8PFgIfAmhkZAIODw8WAh8CaGRkAg8PDxYCHwJoZGQCEA8PFgIfAmhkZAIXDw8WAh8CaGRkAhsPFgIeBFRleHQFBVdXRzE1ZAIcDxYCHwJoZAIeDxYCHwMFAjAgZAIgDxYCHwMFBjUsMDAwIGQCIg8WAh8DBQIwIGQCIw9kFgICAw8WAh8DBQIwIGQCJw9kFgICAQ9kFgICAQ8PFgIfAwUFVGVybXNkZAIsDxYCHwJoZAItDxYCHwJoZAIvDxYCHwJoZAIwDxYCHwJoZAIBD2QWEGYPZBYCZg8WAh8BBR0vTVMvNTQxLmltZz90PWxvZ28mdj0zLjguNjAuMGQCBA8WAh8CaGQCBQ8PFgIfAwUFVGVybXNkZAIGDxYCHwMFBVdXRzE1ZAINDxYCHwJoZAIODxYCHwJoZAIPDxYCHwJoZAIQDxYCHwJoZAICD2QWJAIBDxYCHwMFBVdXRzE1ZAIFDxYCHwMFAjAgZAIJDxYCHwMFBjUsMDAwIGQCDQ8WAh8DBQIwIGQCDw8WAh8CaGQCEQ9kFgICAw8WAh8DBQIwIGQCFw8PFgIfAmhkZAIZDw8WAh8CaGRkAh0PDxYCHwJoZGQCHw8PFgIfAmhkZAIhDw8WAh8CaGRkAiMPDxYCHwJoZGQCJQ8PFgIfAmhkZAInDw8WAh8CaGRkAikPDxYCHwJoZGQCKw8PFgIfAmhkZAItDw8WAh8CaGRkAjMPDxYCHwJoZGQCAw9kFgICAQ9kFgICCw8WAh8CZ2Rk6Qy11OoWVV0cFDhcZVZ%2BETHhBio%3D&__VIEWSTATEGENERATOR=3DB83FCB&__EVENTVALIDATION=%2FwEWJwLLu%2FrrBALw3aLWAwKgq%2F7iAQKxyJ2UCwL93%2F63BgL935KTDwL936buBwL937pJAv3fzqQJAv3f4v8BAv3f9toKAv3firYDAv3fnpEMAsfd7vcOAsbd7vcOAsXd7vcOAsTd7vcOAsPd7vcOAsLd7vcOAsHd7vcOAsDd7vcOAr%2Fd7vcOAr7d7vcOAsfdgtMHAsbdgtMHAsXdgtMHAsTdgtMHAsPdgtMHAsLdgtMHAsHdgtMHAsDdgtMHAr%2FdgtMHAr7dgtMHAsfdli4Cxt2WLgLF3ZYuAt3m06QJAuqVhrQGAuuOzfEPKeiHVY5xX6z6NHsm4vvofNmeaz4%3D&lg_${league.id}=${league.id}&ctl00%24WagerContent%24btn_Continue=Continue&ctl00%24WagerContent%24hidden_ResponsiveInput=0`,
                "method": "POST"
            });

            const data = await response.text();
            const dom = new JSDOM(data);
            let games = Array.from(dom.window.document.querySelectorAll("tbody") || [])
            games = games.map(v => {
                const team1 = v.querySelector("span.visit-team");
                const team2 = v.querySelector("span.home-team");
                const sprd1 = v.querySelector('input[name^="text_0"]');
                const sprd2 = v.querySelector('input[name^="text_1"]');
                const to = v.querySelector('input[name^="text_2"]');
                const tu = v.querySelector('input[name^="text_3"]');
                const ml1 = v.querySelector('input[name^="text_4"]');
                const ml2 = v.querySelector('input[name^="text_5"]');
                const draw = v.querySelector('input[name^="text_6"]');

                return {
                    team1: team1 ? team1.textContent.trim() : "",
                    team2: team2 ? team2.textContent.trim() : "",
                    sprd1: sprd1 ? sprd1.getAttribute("value") : null,
                    sprd2: sprd2 ? sprd2.getAttribute("value") : null,
                    to: to ? to.getAttribute("value") : null,
                    tu: tu ? tu.getAttribute("value") : null,
                    ml1: ml1 ? ml1.getAttribute("value") : null,
                    ml2: ml2 ? ml2.getAttribute("value") : null,
                    draw: draw ? draw.getAttribute("value") : null,
                }
            })

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
            fs.writeFileSync("matches/highroller_all.json", JSON.stringify(this.allMatches, null, 2));

            if (desc.includes("Winner") || desc.includes("Score")) return true;
            if (!["NBA", "WNBA", "CBB", "NFL", "CFB", "SOC", "MLB", "MiLB", "NHL", "FIGHTING", "TENNIS"].includes(sport)) return true;

            for (const gm of games) {
                const isTT = `${gm.team1} ${gm.team2}`.toLowerCase().includes("total points");
                const cleanedGpd = cleanGpd(desc);
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
            fs.writeFileSync("matches/highroller.json", JSON.stringify(this.matches, null, 2));

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
            const response = await fetch("https://www.thehighroller.net/Login.aspx", {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "content-type": "application/x-www-form-urlencoded",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "Referer": "https://www.thehighroller.net/?logout=yes"
                },
                "body": `Account=${account.username}&Password=${account.password}&ctl00%24MainContent%24loginControl1%24BtnSubmit=Login&IdBook=&Redir=&ctl00%24MainContent%24loginControl1%24hdnResponsiveUrl=%2FLogin.aspx&ctl00%24MainContent%24loginControl1%24hdnResponsiveMblUrl=%2FLogin.aspx&ctl00%24MainContent%24loginControl1%24hdnDynamicDskUrl=https%3A%2F%2Fdynamic.thehighroller.net%2Fservice%2FLogIn.aspx&ctl00%24MainContent%24loginControl1%24hdnDynamicMblUrl=https%3A%2F%2Fdynamic.thehighroller.net%2Fservice%2FLogInMobile.aspx&ctl00%24MainContent%24loginControl1%24hdnClassicAgDskUrl=agents%2F&ctl00%24MainContent%24loginControl1%24hdnClassicAgMblUrl=agents-mobile%2F&ctl00%24MainContent%24loginControl1%24hdnDynamicAgDskUrl=https%3A%2F%2Fdynamic.thehighroller.net%2Fagents%2FLogin.aspx&ctl00%24MainContent%24loginControl1%24hdnDynamicAgMblUrl=https%3A%2F%2Fdynamic.thehighroller.net%2Fagents%2FLoginMobile.aspx&ctl00%24MainContent%24loginControl1%24hdnIsMobile=False`,
                "method": "POST",
                redirect: "manual"

            });
            const cookie = response.headers.get('set-cookie').replace("Path=/, ", "").replace(" HttpOnly; Path=/", "") + " IsAgent-IsClassic=false-true; pl=";
            account.cookie = cookie;

        } catch (error) {
            console.log(this.serviceName, error);
        }

        return account;
    }
    async getViewState(cookie, leagueID, selection) {
        let viewState = null;
        let viewStateGenerator = null;
        let eventValidation = null;

        try {
            const response = await fetch(`https://www.thehighroller.net/wager/CreateWager.aspx?WT=0&lg=${leagueID}&sel=${selection}_${selection}`, {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "cookie": cookie,
                    "Referer": "https://www.thehighroller.net/wager/CreateSports.aspx?WT=0&msg=true"
                },
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
    async createWager(cookie, leagueID, selection, stake) {
        let { viewState, viewStateGenerator, eventValidation } = await this.getViewState(cookie, leagueID, selection);

        try {
            const response = await fetch(`https://www.thehighroller.net/wager/CreateWager.aspx?WT=0&lg=${leagueID}&sel=${selection}_${selection}`, {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "content-type": "application/x-www-form-urlencoded",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "cookie": cookie,
                    "Referer": `https://www.thehighroller.net/wager/CreateWager.aspx?WT=0&lg=${leagueID}&sel=${selection}_${selection}`
                },
                "body": `__EVENTTARGET=&__EVENTARGUMENT=&__LASTFOCUS=&__VIEWSTATE=${encodeURIComponent(viewState)}&__VIEWSTATEGENERATOR=${encodeURIComponent(viewStateGenerator)}&__EVENTVALIDATION=${encodeURIComponent(eventValidation)}&BUY_5627598_0=0&UseSameAmount=0&ctl00%24WagerContent%24chkPostBack=on&WAMT_=${stake}&RISKWIN=0&ctl00%24WagerContent%24btn_Continue1=Continue`,
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
        if (account.cookie == null) return { service: this.serviceName, account, msg: "Cookie expired" };

        const pointsTolerance = tolerances.Points[betslip.sport] || 0;
        const oddsTolerance = tolerances.Cents[betslip.sport] || 10;

        const selection = [...betslip.sel.split("_").slice(0, 2), inputPoints, inputOdds].join("_");
        const idmk = Number(selection[0]);

        const { viewState, viewStateGenerator, eventValidation } = await this.createWager(account.cookie, betslip.idlg, betslip.sel, stake);

        try {
            const response = await fetch("https://www.thehighroller.net/wager/ConfirmWager.aspx?WT=0", {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "content-type": "application/x-www-form-urlencoded",
                    "priority": "u=0, i",
                    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "cookie": account.cookie,
                    "Referer": `https://www.thehighroller.net/wager/CreateWager.aspx?WT=0&lg=${betslip.leagueID}&sel=${betslip.sel}_${betslip.sel}`
                },
                "body": `__EVENTTARGET=&__EVENTARGUMENT=&__VIEWSTATE=${encodeURIComponent(viewState)}&__VIEWSTATEGENERATOR=${encodeURIComponent(viewStateGenerator)}&__EVENTVALIDATION=${encodeURIComponent(eventValidation)}&password=${encodeURIComponent(account.password)}&RMV_0=&ctl00%24WagerContent%24btn_Continue1=Continue`,
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
            if (account.cookie == null) account = await this.userLogin(account);
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
            let account = this.accounts[0]

            const leagues = await this.getLeagues(account.cookie);
            if (leagues.length == 0) {
                account = await this.userLogin(account);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            for (const league of leagues) {
                const result = await this.getLeagueMatches(account.cookie, league);
                if (!result) account = await this.userLogin(account);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            this.isReady = true;
        }
    }
    async betPlaceFromWeb(betslip, stake) {
        let outputs = [];
        for (let account of this.accounts) {
            if (account.cookie == null) account = await this.userLogin(account);
            const result = await this.placebet(account, betslip, betslip.points, betslip.odds, stake);
            outputs.push(result);
        }
        return outputs;
    }
}

module.exports = Highroller;
