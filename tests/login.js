const fetch = require("node-fetch");
fetch("https://www.thehighroller.net/Login.aspx", {
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
    "body": "Account=WWG15&Password=1&ctl00%24MainContent%24loginControl1%24BtnSubmit=Login&IdBook=&Redir=&ctl00%24MainContent%24loginControl1%24hdnResponsiveUrl=%2FLogin.aspx&ctl00%24MainContent%24loginControl1%24hdnResponsiveMblUrl=%2FLogin.aspx&ctl00%24MainContent%24loginControl1%24hdnDynamicDskUrl=https%3A%2F%2Fdynamic.thehighroller.net%2Fservice%2FLogIn.aspx&ctl00%24MainContent%24loginControl1%24hdnDynamicMblUrl=https%3A%2F%2Fdynamic.thehighroller.net%2Fservice%2FLogInMobile.aspx&ctl00%24MainContent%24loginControl1%24hdnClassicAgDskUrl=agents%2F&ctl00%24MainContent%24loginControl1%24hdnClassicAgMblUrl=agents-mobile%2F&ctl00%24MainContent%24loginControl1%24hdnDynamicAgDskUrl=https%3A%2F%2Fdynamic.thehighroller.net%2Fagents%2FLogin.aspx&ctl00%24MainContent%24loginControl1%24hdnDynamicAgMblUrl=https%3A%2F%2Fdynamic.thehighroller.net%2Fagents%2FLoginMobile.aspx&ctl00%24MainContent%24loginControl1%24hdnIsMobile=False",
    "method": "POST",
    redirect: "manual"

}).then(r => {
    console.log(cookie)
    fetch("https://www.thehighroller.net/wager/CreateSports.aspx?WT=0&msg=true", {
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
            "Referer": "https://www.thehighroller.net/?logout=yes",
            "cookie": cookie,
        },
        "body": null,
        "method": "GET"
    }).then(r => r.text()).then(console.log);
})
