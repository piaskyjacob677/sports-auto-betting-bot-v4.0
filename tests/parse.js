const fs = require("fs");
const data = fs.readFileSync("./temp/content.txt");
const { JSDOM } = require("jsdom")
const dom = new JSDOM(data);
let games = Array.from(dom.window.document.querySelectorAll("div.League") || []);
let leagueList = [];

for (const game of games) {
    const sport = game.querySelector("a").textContent;
    const leagues = game.querySelectorAll("li");
    for (const league of leagues) {
        const id = league.querySelector("input").getAttribute("value");
        const name = league.querySelector("label").textContent;
        leagueList.push({id, sport, name})
    }
}

console.log(leagueList);

