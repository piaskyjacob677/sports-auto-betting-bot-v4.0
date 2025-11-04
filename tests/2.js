const fetch = require("node-fetch");

async function checkWager(account, betslip) {
    const list = [
        {
            "gameNum": betslip.gameNum,
            "contestantNum": 0,
            "periodNumber": betslip.periodNumber,
            "store": "PPHINSIDER",
            "status": betslip.status,
            "profile": ".",
            "periodType": betslip.periodType,
            "description": betslip.description,
            "risk": betslip.risk,
            "win": betslip.win,
            "wagerType": betslip.wagerType
        }
    ];
    const token = account.code;
    const customerID = `${account.username}_0`;
    const operation = "checkWagerLineMulti";
    const RRO = 0;
    const agentSite = 0;

    try {
        const response = await fetch("https://strikerich.ag/cloud/api/WagerSport/checkWagerLineMulti", {
            "headers": {
                "accept": "*/*",
                "accept-language": "en-US,en;q=0.9",
                "authorization": `Bearer ${token}`,
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "priority": "u=0, i",
                "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin",
                "x-requested-with": "XMLHttpRequest",
                "Referer": "https://strikerich.ag/sports.html?v=1761729252861"
            },
            "body": `list=${encodeURIComponent(JSON.stringify(list))}&token=${encodeURIComponent(token)}&customerID=${encodeURIComponent(customerID)}&operation=${encodeURIComponent(operation)}&RRO=${encodeURIComponent(RRO)}&agentSite=${encodeURIComponent(agentSite)}`,
            "method": "POST"
        });

        const data = await response.json();
        return data;

    } catch (error) {
        console.error(error);
    }
}

async function placeBet(account, betslip) {
    // const result = await checkWager(account, betslip);
    // if (!result) {
    //     return false;
    // }
    // const customerID = `${account.username}_0`;
    // const list = result.LIST || [];
    // const delay = result.DELAY || {};

    try {
        const response = await fetch("https://strikerich.ag/cloud/api/WagerSport/insertWagerStraight", {
            "headers": {
              "accept": "*/*",
              "accept-language": "en-US,en;q=0.9",
              "authorization": `Bearer ${account.code}`,
              "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
              "priority": "u=1, i",
              "sec-ch-ua": "\"Chromium\";v=\"140\", \"Not=A?Brand\";v=\"24\", \"Google Chrome\";v=\"140\"",
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": "\"Windows\"",
              "sec-fetch-dest": "empty",
              "sec-fetch-mode": "cors",
              "sec-fetch-site": "same-origin",
              "x-requested-with": "XMLHttpRequest",
              "Referer": "https://strikerich.ag/sports.html?v=1761729252861"
            },
            "body": "customerID=RD341_0+++&list=%5B%7B%22customerID%22%3A%22RD341_0+++%22%2C%22docNum%22%3A48444497%2C%22wagerType%22%3A%22S%22%2C%22gameNum%22%3A618867253%2C%22wagerCount%22%3A1%2C%22gameDate%22%3A%222025-11-02+13%3A00%3A01.000%22%2C%22buyingFlag%22%3A%22N%22%2C%22extraGames%22%3A%22N%22%2C%22sportType%22%3A%22Football++++++++++++%22%2C%22sportSubType%22%3A%22NFL+++++++++%22%2C%22lineType%22%3A%22M%22%2C%22adjSpread%22%3A0%2C%22adjTotal%22%3A0%2C%22priceType%22%3A%22A%22%2C%22finalMoney%22%3A105%2C%22finalDecimal%22%3A2.05%2C%22finalNumerator%22%3A21%2C%22finalDenominator%22%3A20%2C%22chosenTeamID%22%3A%22Denver+Broncos%22%2C%22riskAmount%22%3A15%2C%22winAmount%22%3A15.75%2C%22store%22%3A%22PPHINSIDER++++++++++%22%2C%22office%22%3A%22PREMIER%22%2C%22custProfile%22%3A%22.+++++++++++++++++++%22%2C%22periodNumber%22%3A0%2C%22periodDescription%22%3A%22Game%22%2C%22oddsFlag%22%3A%22Y%22%2C%22listedPitcher1%22%3Anull%2C%22pitcher1ReqFlag%22%3A%22%22%2C%22listedPitcher2%22%3Anull%2C%22pitcher2ReqFlag%22%3A%22%22%2C%22percentBook%22%3A100%2C%22volumeAmount%22%3A1500%2C%22currencyCode%22%3A%22USD%22%2C%22date%22%3A%222025-10-29%22%2C%22agentID%22%3A%22MYLESM07A.%22%2C%22easternLine%22%3A0%2C%22origPrice%22%3A105%2C%22origDecimal%22%3A2.05%2C%22origNumerator%22%3A21%2C%22origDenominator%22%3A20%2C%22creditAcctFlag%22%3A%22Y%22%2C%22wager%22%3A%7B%22date%22%3A%222025-10-29%22%2C%22minPicks%22%3A1%2C%22totalPicks%22%3A1%2C%22maxPayOut%22%3A0%2C%22wagerCount%22%3A1%2C%22riskAmount%22%3A%2215%22%2C%22winAmount%22%3A%2215.75%22%2C%22description%22%3A%22Football+%23463+Broncos+%2B105+-+For+Game%22%2C%22lineType%22%3A%22M%22%2C%22team%22%3A1%2C%22freePlay%22%3A%22N%22%2C%22agentID%22%3A%22MYLESM07A.%22%2C%22currencyCode%22%3A%22USD%22%2C%22creditAcctFlag%22%3A%22Y%22%2C%22playNumber%22%3A1%7D%2C%22itemNumber%22%3A1%2C%22wagerNumber%22%3A0%2C%22origSpread%22%3A105%2C%22origTotal%22%3A105%2C%22origMoney%22%3A105%2C%22extra%22%3A%7B%22team1%22%3A%22Denver+Broncos%22%2C%22team2%22%3A%22Houston+Texans%22%2C%22rot1%22%3A463%2C%22rot2%22%3A464%2C%22line%22%3A%22%2B105%22%2C%22buy%22%3Afalse%2C%22point%22%3A0%7D%2C%22status%22%3A%22I%22%2C%22printing%22%3Afalse%7D%5D&agentView=false&operation=insertWagerStraight&agToken=&delay=%7B%22time%22%3A1761730200%2C%22secs%22%3A0%2C%22sig%22%3A%22-46rnZh_eIIbMnrDxrfPDvhweZqFUPo6XX3i8HUfOR0%22%7D&agentSite=0",
            "method": "POST"
          });;
        const data = await response.text();
        return data;

    } catch (error) {
        console.error(error);
    }
}

const account = {
    "username": "RD341",
    "password": "R1",
    "code": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJSRDM0MV8wIiwidHlwZSI6MSwiYWciOiJNWUxFU00wN0EuIiwiaW1wIjoiIiwib2ZmIjoiUFJFTUlFUiIsInJiIjpudWxsLCJuYmYiOjE3NjE3MzA0MjksImV4cCI6MTc2MTczMTY4OX0.FgMM1SbY4ttonnAC3VIIOW9Tjj8HFi9h0azNXrxB57U"
}

const betslip = {
    "gameNum": 618867253,
    "periodNumber": 0,
    "status": "I",
    "periodType": "Game",
    "description": "Football #463 Broncos +105 - For Game",
    "risk": 15,
    "win": 15.75,
    "wagerType": "M"
}

placeBet(account, betslip).then(r => console.log(r));
