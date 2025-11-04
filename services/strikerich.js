const fs = require("fs");
const fetch = require("node-fetch");
const { prettyLog } = require("../utils/log.js");
const tolerances = require("../data/tolerances.json");
const { findNormalizedTeamName, getAlias, cleanTeamName, cleanGpd, checkTolerance } = require("../utils/alias.js");
const accounts = require("../data/accounts.json");

class Strikerich {
    constructor() {
        this.serviceName = "Strikerich";
        this.isReady = false;
        this.matches = {};
        this.allMatches = {};
        this.uids = [];
        this.aiRequests = 0;
        this.accounts = accounts[this.serviceName];
    }
    async getLeagues(code) {
        let leagues = [];
        try {
            const response = await fetch("https://strikerich.ag/cloud/api/League/Get_SportsLeagues", {
                "headers": {
                    "accept": "*/*",
                    "accept-language": "en-US,en;q=0.9",
                    "authorization": `Bearer ${code}`,
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-requested-with": "XMLHttpRequest",
                    "Referer": "https://strikerich.ag/sports.html"
                },
                "body": `customerID=${this.accounts[0].username}_0+++&wagerType=Straight&office=PREMIER&placeLateFlag=false&operation=Get_SportsLeagues&RRO=1&agentSite=0`,
                "method": "POST"
            });

            const data = await response.json();
            leagues = data?.Leagues || [];

        } catch (error) {
            console.log(this.serviceName, error);
        }
        return leagues;
    }
    async getLeagueMatches(code, league) {
        try {
            let unNormalizedTeams = [];
            let sport = league.SportType;
            const desc = `${sport} - ${league.SportSubType} - ${league.PeriodDescription}`;

            if (desc.includes("UFC") || desc.includes("MMA")) sport = "FIGHTING";
            else if (desc.includes("NCAAF") || (sport == "FOOTBALL" && desc.includes("COLLEGE"))) sport = "CFB";
            else if (desc.includes("NHL")) sport = "NHL";
            else if (desc.includes("NFL")) sport = "NFL";
            else if (desc.includes("WNBA")) sport = "WNBA";
            else if (desc.includes("NBA")) sport = "NBA";
            else if (desc.includes("MLB")) sport = "MLB";
            else if (desc.includes("MiLB")) sport = "MiLB";
            else if (desc.includes("NCAAB") || (sport == "BASKETBALL" && desc.includes("COLLEGE"))) sport = "CBB";
            else if (sport == "SOCCER") sport = "SOC";

            const response = await fetch("https://strikerich.ag/cloud/api/Lines/Get_LeagueLines2", {
                "headers": {
                    "accept": "*/*",
                    "accept-language": "en-US,en;q=0.9",
                    "authorization": `Bearer ${code}`,
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "priority": "u=1, i",
                    "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"Windows\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-requested-with": "XMLHttpRequest",
                    "Referer": "https://strikerich.ag/sports.html"
                },
                "body": `customerID=${this.accounts[0].username}_0+++&operation=Get_LeagueLines2&sportType=${league.SportType}&sportSubType=${league.SportSubType}&period=${league.PeriodDescription}&hourFilter=0&propDescription=&wagerType=Straight&keyword=&office=PREMIER&correlationID=&periodNumber=${league.PeriodNumber}&periods=0&rotOrder=0&placeLateFlag=false&RRO=1&agentSite=0`,
                "method": "POST"
            });

            const data = await response.json();
            const games = data?.Lines || [];

            console.log(prettyLog(this.serviceName, this.aiRequests, sport, desc, games.length));

            for (const gm of games) {
                const base = { sport, desc, gameNum: gm.GameNum, periodNumber: gm.PeriodNumber, status: gm.Status, periodType: gm.PeriodDescription };

                if (gm.SpreadAdj1) {
                    const points = Number(gm.Spread);
                    const odds = Number(gm.SpreadAdj1);
                    this.allMatches[`${gm.Team1ID} ${points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, wagerType: "S", points, odds };
                }
                if (gm.SpreadAdj2) {
                    const points = Number(gm.Spread);
                    const odds = Number(gm.SpreadAdj2);
                    this.allMatches[`${gm.Team2ID} ${points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, wagerType: "S", points, odds };
                }
                if (gm.MoneyLine1) {
                    const odds = Number(gm.MoneyLine1);
                    this.allMatches[`${gm.Team1ID} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, wagerType: "M", points: 0, odds };
                }
                if (gm.MoneyLine2) {
                    const odds = Number(gm.MoneyLine2);
                    this.allMatches[`${gm.Team2ID} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, wagerType: "M", points: 0, odds };
                }
                if (gm.MoneyLineDraw) {
                    const odds = Number(gm.MoneyLineDraw);
                    this.allMatches[`${gm.Team1ID} vrs ${gm.Team2ID} Draw ${odds > 0 ? "+" : ""}${odds}`] = { ...base, wagerType: "M", points: 0, odds };
                }
                if (gm.TtlPtsAdj1) {
                    const points = Number(gm.TotalPoints);
                    const odds = Number(gm.TtlPtsAdj1);
                    this.allMatches[`${gm.Team1ID} vrs ${gm.Team2ID} o${-points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, wagerType: "L", points: -points, odds };
                }
                if (gm.TtlPtsAdj2) {
                    const points = Number(gm.TotalPoints);
                    const odds = Number(gm.TtlPtsAdj2);
                    this.allMatches[`${gm.Team1ID} vrs ${gm.Team2ID} u${points} ${odds > 0 ? "+" : ""}${odds}`] = { ...base, wagerType: "L", points, odds };
                }
                if (gm.Team1TtlPtsAdj1) {
                    const points = Number(gm.Team1TotalPoints);
                    const odds = Number(gm.Team1TtlPtsAdj1);
                    this.allMatches[`${gm.Team1ID} Team Totals o${points} ${odds}`] = { ...base, wagerType: "L", points: -points, odds };
                }
                if (gm.Team1TtlPtsAdj2) {
                    const points = Number(gm.Team1TotalPoints);
                    const odds = Number(gm.Team1TtlPtsAdj2);
                    this.allMatches[`${gm.Team1ID} Team Totals u${points} ${odds}`] = { ...base, wagerType: "L", points, odds };
                }
                if (gm.Team2TtlPtsAdj1) {
                    const points = Number(gm.Team2TotalPoints);
                    const odds = Number(gm.Team2TtlPtsAdj1);
                    this.allMatches[`${gm.Team2ID} Team Totals o${points} ${odds}`] = { ...base, wagerType: "L", points: -points, odds };
                }
                if (gm.Team2TtlPtsAdj2) {
                    const points = Number(gm.Team2TotalPoints);
                    const odds = Number(gm.Team2TtlPtsAdj2);
                    this.allMatches[`${gm.Team2ID} Team Totals u${points} ${odds}`] = { ...base, wagerType: "L", points, odds };
                }

            }
            fs.writeFileSync("matches/strikerich_all.json", JSON.stringify(this.allMatches, null, 2));

            if (desc.toLowerCase().includes("prop") || desc.toLowerCase().includes("live")) return true;
            if (!["NBA", "WNBA", "CBB", "NFL", "CFB", "SOC", "MLB", "MiLB", "NHL", "FIGHTING", "TENNIS"].includes(sport)) return true;

            for (const gm of games) {
                const cleanedGpd = cleanGpd(gm.PeriodDescription);
                const cleanedVtm = cleanTeamName(gm.Team1ID);
                const cleanedHtm = cleanTeamName(gm.Team2ID);
                const [isNormalizedVtm, normalizedVtm] = findNormalizedTeamName(sport, cleanedVtm);
                const [isNormalizedHtm, normalizedHtm] = findNormalizedTeamName(sport, cleanedHtm);

                const teamNames = { vtm: normalizedVtm, htm: normalizedHtm };
                const isNormalized = { vtm: isNormalizedVtm, htm: isNormalizedHtm };
                const base = { sport, desc, gameNum: gm.GameNum, periodNumber: gm.PeriodNumber, status: gm.Status, periodType: gm.PeriodDescription };

                let data = {vtm: {}, htm: {}}
                if (gm.SpreadAdj1) data["vtm"]["sprd"] = { ...base, wagerType: "S", points: gm.Spread, odds: gm.SpreadAdj1 };
                if (gm.SpreadAdj2) data["htm"]["sprd"] = { ...base, wagerType: "S", points: gm.Spread, odds: gm.SpreadAdj2 };
                if (gm.MoneyLine1) data["vtm"]["ml"] = { ...base, wagerType: "M", points: 0, odds: gm.MoneyLine1 };
                if (gm.MoneyLine2) data["htm"]["ml"] = { ...base, wagerType: "M", points: 0, odds: gm.MoneyLine2 };
                if (gm.MoneyLineDraw) data["vtm"]["draw"] = { ...base, wagerType: "M", points: 0, odds: gm.MoneyLineDraw };
                if (gm.MoneyLineDraw) data["htm"]["draw"] = { ...base, wagerType: "M", points: 0, odds: gm.MoneyLineDraw };
                if (gm.TtlPtsAdj1) data["vtm"]["to"] = { ...base, wagerType: "L", points: -gm.TotalPoints, odds: gm.TtlPtsAdj1 };
                if (gm.TtlPtsAdj1) data["htm"]["to"] = { ...base, wagerType: "L", points: -gm.TotalPoints, odds: gm.TtlPtsAdj1 };
                if (gm.TtlPtsAdj2) data["vtm"]["tu"] = { ...base, wagerType: "L", points: gm.TotalPoints, odds: gm.TtlPtsAdj2 };
                if (gm.TtlPtsAdj2) data["htm"]["tu"] = { ...base, wagerType: "L", points: gm.TotalPoints, odds: gm.TtlPtsAdj2 };
                if (gm.Team1TtlPtsAdj1) data["vtm"]["tto"] = { ...base, wagerType: "L", points: -gm.Team1TotalPoints, odds: gm.Team1TtlPtsAdj1 };
                if (gm.Team1TtlPtsAdj2) data["vtm"]["ttu"] = { ...base, wagerType: "L", points: gm.Team1TotalPoints, odds: gm.Team1TtlPtsAdj2 };
                if (gm.Team2TtlPtsAdj1) data["htm"]["tto"] = { ...base, wagerType: "L", points: -gm.Team2TotalPoints, odds: gm.Team2TtlPtsAdj1 };
                if (gm.Team2TtlPtsAdj2) data["htm"]["ttu"] = { ...base, wagerType: "L", points: gm.Team2TotalPoints, odds: gm.Team2TtlPtsAdj2 };

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
            fs.writeFileSync("matches/strikerich.json", JSON.stringify(this.matches, null, 2));

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
            const response = await fetch(`https://strikerich.ag/cloud/api/System/authenticateCustomer`,
                {
                    "headers": {
                        "accept": "*/*",
                        "accept-language": "en-US,en;q=0.9",
                        "authorization": "Bearer undefined",
                        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "priority": "u=1, i",
                        "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                        "sec-ch-ua-mobile": "?0",
                        "sec-ch-ua-platform": "\"Windows\"",
                        "sec-fetch-dest": "empty",
                        "sec-fetch-mode": "cors",
                        "sec-fetch-site": "same-origin",
                        "x-requested-with": "XMLHttpRequest",
                        "Referer": "https://strikerich.ag/"
                    },
                    "referrer": "https://strikerich.ag/BetSlip/",
                    "body": `customerID=${account.username}&state=true&password=${account.password}&multiaccount=1&response_type=code&client_id=${account.username}&domain=strikerich.ag&redirect_uri=strikerich.ag&operation=authenticateCustomer&RRO=1`,
                    "method": "POST",
                    "mode": "cors",
                });
            const data = await response.json();
            account.code = data.code;

        } catch (error) {
            console.log(this.serviceName, error);
        }

        return account;
    }
    placebet(account, betslip, inputPoints, inputOdds, stake) {
        if (account.code == null) return { service: this.serviceName, account, msg: "Token expired" };

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
                matchOdd.points = `${inputPoints > 0 ? "+" : "-"}${points}`;
                matchOdd.numberPoints = parseFloat(inputPoints);
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
            fetch("https://strikerich.ag/Actions/api/Betting/SaveBet", {
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
                "referrer": "https://strikerich.ag/BetSlip/",
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
                    resolve({ service: this.serviceName, account, msg: "Unknown error" });
                }
            });
        })
    }
    async place(betTeamName, period, marketName, inputPoints, inputOdds, stake) {
        const betslip = this.matches[betTeamName][period][marketName];
        let outputs = [];
        for (let account of this.accounts) {
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

            const leagues = await this.getLeagues(account.code);
            if (leagues.length == 0) {
                account = await this.userLogin(account);
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            }
            
            for (const league of leagues) {
                const result = await this.getLeagueMatches(account.code, league);
                if (!result) account = await this.userLogin(account);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            this.isReady = true;
        }
    }
    async betPlaceFromWeb(betslip, stake) {
        let outputs = [];
        for (let account of this.accounts) {
            const result = await this.placebet(account, betslip, betslip.points, betslip.odds, stake);
            outputs.push(result);
        }
        return outputs;
    }
}

module.exports = Strikerich;
