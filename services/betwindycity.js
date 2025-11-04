const fs = require("fs");
const fetch = require("node-fetch");
const { prettyLog } = require("../utils/log.js");
const tolerances = require("../data/tolerances.json");
const { findNormalizedTeamName, getAlias, cleanTeamName, cleanGpd, checkTolerance } = require("../utils/alias.js");
const accounts = require("../data/accounts.json");

class Betwindycity {
    constructor() {
        this.serviceName = "Betwindycity";
        this.isReady = false;
        this.matches = {};
        this.allMatches = {};
        this.uids = [];
        this.aiRequests = 0;
        this.accounts = accounts[this.serviceName];
    }
    async getLeagues(token) {
        let leagues = [];
        try {
            const response = await fetch("https://betwindycity.com/player-api/api/wager/sportsavailablebyplayeronleague/false", {
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "en-US,en;q=0.9",
                    "authorization": `Bearer ${token}`,
                    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "Referer": "https://betwindycity.com/v2/"
                },
                "body": null,
                "method": "GET"
            });

            const data = await response.json();
            leagues = Object.keys(data.Items).flatMap(v => {
                return data.Items[v].items.map(w => {
                    return {
                        id: data.Items[v].IdLeague,
                        sport: v,
                        IdSportType: w.CombinedItems[0].IdSportType,
                        SportSubType: w.SportSubType,
                        SportType: w.SportType,
                        PeriodDescription: w.PeriodDescription,
                        PeriodNumber: w.PeriodNumber,
                        EventId: w.EventId,
                    }
                })
            });
            const liveLeagues = Object.keys(data.LiveLeagues).flatMap(v => {
                return data.LiveLeagues[v].items.map(w => {
                    return {
                        sport: v,
                        id: data.LiveLeagues[v].IdLeague,
                        IdSportType: w.CombinedItems[0].IdSportType,
                        SportSubType: w.SportSubType,
                        SportType: w.SportType,
                        PeriodDescription: w.PeriodDescription,
                        PeriodNumber: w.PeriodNumber,
                        EventId: w.EventId,
                    }
                })
            });
            leagues = [...leagues, ...liveLeagues];

        } catch (error) {
            console.log(this.serviceName, error);
        }
        return leagues;
    }
    async getLeagueMatches(league, token) {
        try {
            let sport = league.sport;
            const desc = `${league.SportType} - ${league.SportSubType} - ${league.PeriodDescription}`;

            if (sport.includes("Soc")) sport = "SOC";
            else if (sport == "MMA") sport = "FIGHTING";
            else if (sport.includes("TENNIS")) sport = "TENNIS";
            else if (desc.includes("NFL")) sport = "NFL";
            else if (desc.includes("WNBA")) sport = "WNBA";
            else if (desc.includes("NBA")) sport = "NBA";
            else if (desc.includes("MLB")) sport = "MLB";
            else if (desc.includes("MiLB")) sport = "MiLB";
            else if (desc.includes("NHL")) sport = "NHL";
            else if (sport.replace(/\s+/g, "").includes("NCAAF")) sport = "CFB";
            else if (sport.replace(/\s+/g, "").includes("NCAAB")) sport = "CBB";

            const response = await fetch("https://betwindycity.com/player-api/api/wager/schedules/S/0", {
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "en-US,en;q=0.9",
                    "authorization": `Bearer ${token}`,
                    "content-type": "application/json",
                    "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "Referer": "https://betwindycity.com/v2/"
                },
                "body": JSON.stringify([{ "IdSport": league.IdSportType, "Period": league.PeriodNumber }]),
                "method": "POST"
            });

            const data = await response.json();
            let games = data[0]?.sc?.schl.flatMap(v => v.g.map(w => w.ts));
            games = games.map(v => {
                return {
                    team1: v[0].n,
                    team2: v[1].n,
                    sprd1: v[0].ls.s[0]?.i || null,
                    sprd2: v[1].ls.s[0]?.i || null,
                    to: v[0].ls.t[0]?.i || null,
                    tu: v[1].ls.t[0]?.i || null,
                    ml1: v[0].ls.m[0]?.i || null,
                    ml2: v[1].ls.m[0]?.i || null,
                    draw: v[0].ls.s[3]?.i || null,
                    tto1: v[0].ls.to[0]?.i || null,
                    ttu1: v[0].ls.tu[0]?.i || null,
                    tto2: v[1].ls.to[0]?.i || null,
                    ttu2: v[1].ls.tu[0]?.i || null,
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
            
            fs.writeFileSync("matches/betwindycity_all.json", JSON.stringify(this.allMatches, null, 2));

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
            fs.writeFileSync("matches/betwindycity.json", JSON.stringify(this.matches, null, 2));

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
            const response = await fetch("https://betwindycity.com/player-api/identity/CustomerLoginRedir?RedirToHome=1", {
                "headers": {
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "accept-language": "en-US,en;q=0.9",
                    "cache-control": "max-age=0",
                    "content-type": "application/x-www-form-urlencoded",
                    "sec-ch-ua": "\"Not;A=Brand\";v=\"99\", \"Google Chrome\";v=\"139\", \"Chromium\";v=\"139\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "same-origin",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                    "Referer": "https://betwindycity.com/"
                },
                "body": `customerid=${account.username}&password=${account.password}&submit2=Login`,
                "method": "POST",
                "redirect": "manual"
            });

            const { location } = response.headers.raw();
            const token = location[0].split("=")[1];

            const response2 = await fetch("https://betwindycity.com/player-api/identity/customerLoginFromToken", {
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "content-type": "application/json",
                    "Referer": "https://betwindycity.com/v2/"
                },
                "body": "{\"token\":\"" + token + "\",\"version\":\"1.3.47\"}",
                "method": "POST"
            });
            const data2 = await response2.json();
            account.token = data2.AccessToken;

        } catch (error) {
            console.log(this.serviceName, error);
        }

        return account;
    }
    async saveBet(token, selection, stake) {
        const body = {
            "CaptchaMessage": null,
            "DelayKey": "",
            "DelaySeconds": 0,
            "Details": [
                {
                    "BetType": "S",
                    "TotalPicks": 1,
                    "IdTeaser": 0,
                    "IsFreePlay": false,
                    "Amount": stake,
                    "RoundRobinOptions": [],
                    "Wagers": [
                        {
                            "Id": selection,
                            "PitcherVisitor": false,
                            "PitcherHome": false
                        }
                    ],
                    "AmountCalculation": "A",
                    "ContinueOnPush": true,
                    "PropParlay": false
                }
            ],
            "PasswordConfirmation": null
        };
    
        const response = await fetch("https://betwindycity.com/player-api/api/wager/SaveBet/", {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "accept-language": "en-US,en;q=0.9",
                "authorization": `Bearer ${token}`,
                "content-type": "application/json",
                "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "Referer": "https://betwindycity.com/v2/"
            },
            "body": JSON.stringify(body),
            "method": "POST"
        });
        const data = await response.json();
        return data.TicketNumber;
    }
    async confirmBet(token, ticketNumber) {
        const response = await fetch("https://betwindycity.com/player-api/api/wager/confirmBet/", {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "accept-language": "en-US,en;q=0.9",
                "authorization": `Bearer ${token}`,
                "content-type": "application/json",
                "sec-ch-ua": "\"Chromium\";v=\"142\", \"Google Chrome\";v=\"142\", \"Not_A Brand\";v=\"99\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "Referer": "https://betwindycity.com/v2/"
            },
            "body": `{\"TicketNumber\":${ticketNumber}}`,
            "method": "POST"
        });
        const data = await response.json();
        return data;    
    }
    async placebet(account, betslip, inputPoints, inputOdds, stake) {
        if (account.token == null) return { service: this.serviceName, account, msg: "Token expired" };

        const pointsTolerance = tolerances.Points[betslip.sport] || 0;
        const oddsTolerance = tolerances.Cents[betslip.sport] || 10;

        const selection = [...betslip.sel.split("_").slice(0, 2), inputPoints, inputOdds].join("_") + "_0_0_0";
        const idmk = Number(selection[0]);

        const ticketNumber = await this.saveBet(account.token, selection, stake);
        const result = await this.confirmBet(account.token, ticketNumber);
        if (result.StatusDescription == "ACCEPTED") return { service: this.serviceName, account, msg: "Success" };
        return { service: this.serviceName, account, msg: result.StatusDescription };
        
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

            const leagues = await this.getLeagues(account.token);
            if (leagues.length == 0) {
                account = await this.userLogin(account);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            for (const league of leagues) {
                const result = await this.getLeagueMatches(league, account.token);
                if (!result) account = await this.userLogin(account);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            this.isReady = true;
        }
    }
    async betPlaceFromWeb(betslip, stake) {
        console.log(betslip, stake);
        let outputs = [];
        for (let account of this.accounts) {
            if (account.token == null) account = await this.userLogin(account);
            const result = await this.placebet(account, betslip, betslip.points, betslip.odds, stake);
            outputs.push(result);
        }
        return outputs;
    }
}

module.exports = Betwindycity;
