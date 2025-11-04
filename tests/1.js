const fs = require("fs");
const fetch = require("node-fetch");

async function saveBet(token, selection, stake) {
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
async function confirmBet(token, ticketNumber) {
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

(async () => {
    const token = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjMwODVDMUVBRTgwOTE1MjM3MjI2MThBMDIzM0QwQjhFMTAzQjc3QkMiLCJ0eXAiOiJKV1QifQ.eyJzdWIiOiI0MDM3NDUiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJET0MyMDUiLCJqdGkiOiJjMDAzODhjZi0wMGNlLTQzNzQtYTA3Ny0wN2QzNGU1NDE1ZjgiLCJpYXQiOjE3NjE5NTA2NTYsImlkYWdlbnQiOiI0MDM2NzIiLCJ2ZXJzaW9uIjoiMS4zLjQ3Iiwic2NvcGUiOiJhcGl2MSIsInRpbWV6b25lIjoiMSIsImV3bCI6IjEiLCJuYmYiOjE3NjE5NTA2NTYsImV4cCI6MTc2MTk1NjY1NiwiaXNzIjoiYXBpY29nIiwiYXVkIjoiaHR0cHM6Ly9hcGljb2cifQ.hDmqaKVDxNdkhgzcv1MroLu5nsoSJZNGgCpufY_-acQhHi4k9TFq0x9INZ3KH1XqixSrYdovqI9PZHZsC-HVwcarorXdJ-lMmGLn_DeEAfJC06OWJF6oSB3BOJj4HX5VTsf_sI2yyvSi-XPF_sZRCFFu0jLD-vXgPrdyku50A6eB-zuaR1kem-EOslKLZuHa45qs4iAzkkP99U1L7ZF-QdQr367XGoN28zfrRIBvcRrlLlqkTaxXlChNPUmOMF3C59bS6cFc6kOcP0E4Z2P31lVXXi9srQK2WsYQ49YhfEb9L7gAfhkPq5XgWDKLElQwuYulkHStrxNb3hKoehX4-w";
    const selection = "2_579787918_0_-180_0_0_0";
    const stake = 35;
    const ticketNumber = await saveBet(token, selection, stake);
    console.log(ticketNumber);
    const result = await confirmBet(token, ticketNumber);
    console.log(result);
})();
