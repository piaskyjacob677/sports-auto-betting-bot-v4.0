const fs = require("fs");
const fetch = require("node-fetch");
const { prettyLog } = require("../utils/log.js");
const tolerances = require("../data/tolerances.json");
const { findNormalizedTeamName, getAlias, cleanTeamName, cleanGpd, checkTolerance } = require("../utils/alias.js");
const accounts = require("../data/accounts.json");

class Godds {
    constructor() {
        this.serviceName = "Godds";
        this.isReady = false;
        this.matches = {};
        this.allMatches = {};
        this.uids = [];
        this.aiRequests = 0;
        this.accounts = accounts[this.serviceName];
    }
    async getLeagues(playerToken) {
        let groups = [];
        try {
            const response = await fetch("https://godds.ag/Actions/api/Menu/GetMenu", {
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "en-US,en;q=0.9",
                    "apptoken": "E35EA58E-245D-44F3-B51D-C3BACCB1CFD3",
                    "locker-captcha-validated": "",
                    "locker-status": "",
                    "playertoken": playerToken,
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "Referer": "https://godds.ag/BetSlip/"
                },
                "body": null,
                "method": "GET"
            });

            const data = await response.json();
            groups = data?.Groups || [];

        } catch (error) {
            console.log(this.serviceName, error);
        }
        return groups;
    }
    async getLeagueMatches(league, playerToken) {
        try {            
            let sport = league.SportId;
            const desc = league.LeagueDescription;

            if (sport == "SOC" && desc.includes("NHL")) sport = "NHL";
            else if (desc.startsWith("TENNIS")) sport = "TENNIS";
            else if (desc.includes("UFC") || desc.includes("MMA")) sport = "FIGHTING";
            else if (desc.includes("NCAAF")) sport = "CFB";
            else if (desc.includes("NHL") || desc.includes("NATIONAL HOCKEY LEAGUE")) sport = "NHL";
            else if (desc.includes("HK") || desc.includes("HOCKEY")) sport = "HOCKEY";
            else if (desc.includes("NFL")) sport = "NFL";
            else if (desc.includes("WNBA")) sport = "WNBA";
            else if (desc.includes("NBA")) sport = "NBA";
            else if (desc.includes("BK") || desc.includes("BASKETBALL")) sport = "BASKETBALL";
            else if (desc.includes("MLB")) sport = "MLB";
            else if (desc.includes("BB") || desc.includes("BASEBALL")) sport = "BASEBALL";
            else if (desc.includes("MiLB")) sport = "MiLB";
            else if (desc.includes("NCAAB")) sport = "CBB";
            else if (desc.includes("SOCCER")) sport = "SOC";

            const body = `leagueId=${league.LeagueId}&loadAgentLines=false&loadDefaultOdds=false&sportId=${league.SportId}&loadMlbLines=true&loadPropsEvents=false`;
            const response = await fetch(`https://godds.ag/Actions/api/Event/GetEvent?${body}`, {
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "en-US,en;q=0.9",
                    "apptoken": "E35EA58E-245D-44F3-B51D-C3BACCB1CFD3",
                    "locker-captcha-validated": "",
                    "locker-status": "",
                    "playertoken": playerToken,
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "Referer": "https://godds.ag/BetSlip/"
                },
                "body": null,
                "method": "GET"
            });

            const data = await response.json();
            let games = data?.Events?.LEAGUES?.[0]?.EVENTS || [];
            const tntGames = data?.Events?.LEAGUES?.[0]?.EVENTSTNT || [];
            for (const gm of tntGames) {
                games.push(...gm.PARTICIPANTS);
            }

            console.log(prettyLog(this.serviceName, this.aiRequests, sport, desc, games.length));

            for (const gm of games) {
                const base = { sport, desc, idgm: gm.GAME_ID, idgmType: gm.GAME_TYPE_ID, idfgm: gm.FAMILY_GAME, idpgm: gm.PARENT_GAME };

                if (gm.VISITOR_SPREAD_ODDS) {
                    const points = Number(gm.VISITOR_SPREAD);
                    const odds = Number(gm.VISITOR_SPREAD_ODDS);
                    this.allMatches[`${gm.VISITOR_TEAM} ${points == 0 ? "PK" : points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: gm.VISITOR_TEAM, idmk: 0, hv: 2, stl: 2, points, odds };
                }
                if (gm.HOME_SPREAD_ODDS) {
                    const points = Number(gm.HOME_SPREAD);
                    const odds = Number(gm.HOME_SPREAD_ODDS);
                    this.allMatches[`${gm.HOME_TEAM} ${points == 0 ? "PK" : points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: gm.HOME_TEAM, idmk: 1, hv: 1, stl: 2, points, odds };
                }
                if (gm.VISITOR_ODDS) {
                    const odds = Number(gm.VISITOR_ODDS);
                    this.allMatches[`${gm.VISITOR_TEAM} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: gm.VISITOR_TEAM, idmk: 4, hv: 2, stl: 3, points: 0, odds };
                }
                if (gm.HOME_ODDS) {
                    const odds = Number(gm.HOME_ODDS);
                    this.allMatches[`${gm.HOME_TEAM} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: gm.HOME_TEAM, idmk: 5, hv: 1, stl: 3, points: 0, odds };
                }
                if (gm.VISITOR_SPECIAL_ODDS) {
                    const odds = Number(gm.VISITOR_SPECIAL_ODDS);
                    this.allMatches[`${gm.VISITOR_TEAM} vrs ${gm.HOME_TEAM} Draw ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: "draw", idmk: 6, hv: 3, stl: 3, points: 0, odds };
                }
                if (gm.OVER_ODDS) {
                    const points = Number(gm.TOTAL_OVER);
                    const odds = Number(gm.OVER_ODDS);  
                    this.allMatches[`${gm.VISITOR_TEAM} vrs ${gm.HOME_TEAM} o${points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: gm.VISITOR_TEAM, idmk: 2, hv: 2, stl: 1, points, odds };
                }
                if (gm.UNDER_ODDS) {
                    const points = Number(gm.TOTAL_UNDER);
                    const odds = Number(gm.UNDER_ODDS);
                    this.allMatches[`${gm.VISITOR_TEAM} vrs ${gm.HOME_TEAM} u${points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: gm.HOME_TEAM, idmk: 3, hv: 1, stl: 1, points, odds };
                }
                if (!gm.TEAM_NAME && gm.VISITOR_ODDS) {
                    const odds = Number(gm.VISITOR_ODDS);
                    this.allMatches[`${gm.VISITOR_TEAM} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: gm.VISITOR_TEAM, idmk: 4, hv: 2, stl: 3, points: 0, odds };
                }
                if (!gm.TEAM_NAME && gm.HOME_ODDS) {
                    const odds = Number(gm.HOME_ODDS);
                    this.allMatches[`${gm.HOME_TEAM} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: gm.HOME_TEAM, idmk: 5, hv: 1, stl: 3, points: 0, odds };
                }
                if (gm.TEAM_NAME && gm.HOME_ODDS) {
                    const odds = Number(gm.HOME_ODDS);
                    this.allMatches[`${gm.TEAM_NAME} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: gm.TEAM_NAME, 4: 5, hv: 2, stl: 3, points: 0, odds };
                }
                if (gm.VISITOR_SPECIAL_ODDS) {
                    const odds = Number(gm.VISITOR_SPECIAL_ODDS);
                    this.allMatches[`${gm.VISITOR_TEAM} vrs ${gm.HOME_TEAM} Draw ${odds > 0 ? "+" : ""}${odds}`] = { ...base, name: "draw", idmk: 6, hv: 3, stl: 3, points: 0, odds };
                }
            }
            fs.writeFileSync("matches/godds_all.json", JSON.stringify(this.allMatches, null, 2));

            if (desc.includes("PROPS")) return true;
            if (desc.includes("FB") || desc.includes("FOOTBALL")) return true;
            if (["PROP", "TNT"].includes(sport)) return true;
            if (sport == "MU" && !desc.includes("TEAM TOTALS")) return true;
            if (!["NBA", "WNBA", "CBB", "NFL", "CFB", "SOC", "MLB", "MiLB", "NHL", "FIGHTING", "TENNIS"].includes(sport)) return true;

            let unNormalizedTeams = [];

            for (const gm of games) {
                const isTT = `${gm.VISITOR_TEAM} ${gm.HOME_TEAM}`.toLowerCase().includes("total goals");
                const cleanedGpd = cleanGpd(gm.HOME_TEAM);
                const cleanedVtm = cleanTeamName(gm.VISITOR_TEAM);
                const cleanedHtm = cleanTeamName(gm.HOME_TEAM);
                const [isNormalizedVtm, normalizedVtm] = findNormalizedTeamName(sport, cleanedVtm);
                const [isNormalizedHtm, normalizedHtm] = findNormalizedTeamName(sport, cleanedHtm);

                const teamNames = { vtm: normalizedVtm, htm: normalizedHtm };
                const isNormalized = { vtm: isNormalizedVtm, htm: isNormalizedHtm };
                const base = { sport, desc, idgm: gm.GAME_ID, idgmType: gm.GAME_TYPE_ID, idfgm: gm.FAMILY_GAME, idpgm: gm.PARENT_GAME };

                let data = { vtm: {}, htm: {} }
                if (gm.VISITOR_SPREAD_ODDS) data["vtm"]["sprd"] = { ...base, name: gm.VISITOR_TEAM, idmk: 0, hv: 2, stl: 2, points: gm.VISITOR_SPREAD, odds: gm.VISITOR_SPREAD_ODDS };
                if (gm.HOME_SPREAD_ODDS) data["htm"]["sprd"] = { ...base, name: gm.HOME_TEAM, idmk: 1, hv: 1, stl: 2, points: gm.HOME_SPREAD, odds: gm.HOME_SPREAD_ODDS };
                if (gm.VISITOR_ODDS) data["vtm"]["ml"] = { ...base, name: gm.VISITOR_TEAM, idmk: 4, hv: 2, stl: 3, points: 0, odds: gm.VISITOR_ODDS };
                if (gm.HOME_ODDS) data["htm"]["ml"] = { ...base, name: gm.HOME_TEAM, idmk: 5, hv: 1, stl: 3, points: 0, odds: gm.HOME_ODDS };
                if (gm.VISITOR_SPECIAL_ODDS) data["vtm"]["draw"] = { ...base, name: "draw", idmk: 6, hv: 3, stl: 3, points: 0, odds: gm.VISITOR_SPECIAL_ODDS };
                if (gm.VISITOR_SPECIAL_ODDS) data["htm"]["draw"] = { ...base, name: "draw", idmk: 6, hv: 3, stl: 3, points: 0, odds: gm.VISITOR_SPECIAL_ODDS };
                if (gm.OVER_ODDS && !isTT) data["vtm"]["to"] = { ...base, name: gm.VISITOR_TEAM, idmk: 2, hv: 2, stl: 1, points: gm.TOTAL_OVER, odds: gm.OVER_ODDS };
                if (gm.OVER_ODDS && !isTT) data["htm"]["to"] = { ...base, name: gm.VISITOR_TEAM, idmk: 2, hv: 2, stl: 1, points: gm.TOTAL_OVER, odds: gm.OVER_ODDS };
                if (gm.UNDER_ODDS && !isTT) data["vtm"]["tu"] = { ...base, name: gm.HOME_TEAM, idmk: 3, hv: 1, stl: 1, points: gm.TOTAL_UNDER, odds: gm.UNDER_ODDS };
                if (gm.UNDER_ODDS && !isTT) data["htm"]["tu"] = { ...base, name: gm.HOME_TEAM, idmk: 3, hv: 1, stl: 1, points: gm.TOTAL_UNDER, odds: gm.UNDER_ODDS };
                if (gm.OVER_ODDS && isTT) data["htm"]["tto"] = { ...base, name: gm.VISITOR_TEAM, idmk: 2, hv: 2, stl: 1, points: gm.TOTAL_OVER, odds: gm.OVER_ODDS };
                if (gm.UNDER_ODDS && isTT) data["htm"]["ttu"] = { ...base, name: gm.HOME_TEAM, idmk: 3, hv: 1, stl: 1, points: gm.TOTAL_UNDER, odds: gm.UNDER_ODDS };

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
            fs.writeFileSync("matches/godds.json", JSON.stringify(this.matches, null, 2));

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
            const response = await fetch(`https://godds.ag/Actions/api/Login/PlayerLogin?player=${account.username}&password=${account.password}&domain=https://godds.ag`,
                {
                    "headers": {
                        "accept": "application/json, text/plain, */*",
                        "accept-language": "en-US,en;q=0.9",
                        "apptoken": "E35EA58E-245D-44F3-B51D-C3BACCB1CFD3",
                        "locker-captcha-validated": "",
                        "locker-status": "",
                        "playertoken": "",
                        "priority": "u=1, i",
                        "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                        "sec-ch-ua-mobile": "?0",
                        "sec-ch-ua-platform": "\"Windows\"",
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin"
                    },
                    "referrer": "https://godds.ag/BetSlip/",
                    "body": null,
                    "method": "POST",
                    "mode": "cors",
                    "credentials": "include"
                });
            account.playerToken = (await response.json()).PlayerToken;
        } catch (error) {
            console.log(this.serviceName, error);
        }

        return account;
    }
    placebet(account, betslip, inputPoints, inputOdds, stake) {
        if (account.playerToken == null) return { service: this.serviceName, account, msg: "Player token expired" };

        const pointsTolerance = tolerances.Points[betslip.sport] || 0;
        const oddsTolerance = tolerances.Cents[betslip.sport] || 10;

        const dateString = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\//g, "");
        const toRisk = Math.abs(inputOdds >= 100 ? stake : Math.round(stake * (inputOdds / 100)));
        const toWin = Math.abs(inputOdds >= 100 ? Math.round(stake * (inputOdds / 100)) : stake);

        const matchOdd = {
            odds: `${inputOdds}`,
            oddsToShow: `${inputOdds > 0 ? "+" : "-"}${Math.abs(inputOdds).toFixed(2)}`,
            type: betslip.stl,
            [`style_${betslip.stl == 1 ? 'total' : betslip.stl == 2 ? 'spread' : 'money_line'}`]: betslip.idmk
        };

        if (betslip.stl == 1 || betslip.stl == 2) {
            const points = `${Math.abs(inputPoints)}`.replace("0.5", "½").replace("0.25", "¼").replace("0.75", "¾").replace(".5", "½").replace(".25", "¼").replace(".75", "¾");
            if (betslip.idmk == 2) {
                matchOdd.points = `o${points}`;
                matchOdd.numberPoints = -parseFloat(inputPoints);
            }
            else if (betslip.idmk == 3) {
                matchOdd.points = `u${points}`;
                matchOdd.numberPoints = parseFloat(inputPoints);
            }
            else {
                if (inputPoints == 0) {
                    matchOdd.points = "PK";
                    matchOdd.numberPoints = 0;
                }
                else {
                    matchOdd.points = `${inputPoints > 0 ? "+" : "-"}${points}`;
                    matchOdd.numberPoints = parseFloat(inputPoints);
                }
            }
        }

        const body = {
            betSlip: {
                PlayerId: account.PlayerId,
                ProfileId: account.ProfileId,
                ProfileLimitId: account.ProfileLimitId,
                Details: [{
                    Id: `${dateString}1`,
                    Bets: [{
                        Id: `${dateString}11`,
                        ToRisk: toRisk,
                        ToWin: toWin,
                        Details: [{
                            Id: `${betslip.idgm}${betslip.name.replace(/ /g, "")}${betslip.stl}${betslip.hv}`,
                            SportId: betslip.sport,
                            GameId: betslip.idgm,
                            GameTypeId: betslip.idgmType,
                            TeamName: betslip.name,
                            BetSpotType: betslip.stl,
                            MatchOdd: matchOdd,
                            OriginalMatchOdd: matchOdd,
                            GameTime: betslip.gameTime,
                            LeagueName: betslip.desc,
                            BetTypeLimitUsed: false,
                            BuyPoints: 0,
                            ParentGameId: betslip.idpgm,
                            FamilyGameId: betslip.idfgm,
                            HomeOrVisitor: betslip.hv,
                            IsOnOpenBets: false,
                            Pitcher: 0
                        }]
                    }],
                    BetType: 1,
                    OpenSpots: 0,
                    Amount: toRisk,
                    ToRisk: toRisk,
                    ToWin: toWin,
                    UseFreePlay: false
                }]
            }
        }

        return new Promise((resolve, reject) => {
            fetch("https://godds.ag/Actions/api/Betting/SaveBet", {
                "headers": {
                    "accept": "application/json, text/plain, */*",
                    "accept-language": "en-US,en;q=0.9",
                    "apptoken": "E35EA58E-245D-44F3-B51D-C3BACCB1CFD3",
                    "content-type": "application/json",
                    "locker-captcha-validated": "",
                    "locker-status": "",
                    "playertoken": account.playerToken,
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin"
                },
                "referrer": "https://godds.ag/BetSlip/",
                "body": JSON.stringify(body),
                "method": "POST",
                "mode": "cors",
                "credentials": "include"
            }).then(r => r.text()).then(r => {
                try {
                    const res = JSON.parse(r);
                    if (res[0].httpStatusCode == 200) {
                        resolve({ service: this.serviceName, account, msg: "Success" });
                    }
                    else {
                        if (res[0].errorResponse.errorMessage.includes("line change")) {
                            const currentMatch = res[0].errorResponse.gameLists.differentGames[0];
                            const bookPoints = currentMatch.matchOdd.numberPoints;
                            const bookOdds = currentMatch.matchOdd.odds;
                            if (checkTolerance(bookPoints, bookOdds, betslip.idmk == 2 ? -inputPoints : inputPoints, inputOdds, pointsTolerance, oddsTolerance, betslip.stl == 1 ? "total" : "")) {
                                inputPoints = bookPoints;
                                inputOdds = bookOdds;
                                this.placebet(account, betslip, inputPoints, inputOdds, stake).then(resolve);
                            }
                            else {
                                resolve({ service: this.serviceName, account, msg: `Game line change. ${inputPoints}/${inputOdds} ➝ ${bookPoints}/${bookOdds}` });
                            }
                        }
                        else resolve({ service: this.serviceName, account, msg: res[0].errorResponse.errorMessage });
                    }
                } catch (error) {
                    resolve({ service: this.serviceName, account, msg: error.message });
                }
            });
        })
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

            const groups = await this.getLeagues(account.playerToken);
            if (groups.length == 0) {
                account = await this.userLogin(account);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }

            for (const group of groups) {
                for (const league of group.Leagues) {
                    const result = await this.getLeagueMatches(league, account.playerToken);
                    if (!result) account = await this.userLogin(account);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            this.isReady = true;
        }
    }
    async betPlaceFromWeb(betslip, stake) {
        let outputs = [];
        for (let account of this.accounts) {
            if (account.playerToken == null) account = await this.userLogin(account);
            const result = await this.placebet(account, betslip, betslip.points, betslip.odds, stake);
            outputs.push(result);
        }
        return outputs;
    }
}

module.exports = Godds;
