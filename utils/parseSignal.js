const periodsMap = require("../data/periodsMap.json");
const aliases = require("../data/aliases.json");
const fixedAliases = require("../data/fixedAliases.json");

function searchTeamName(input, subText, template) {
    if (subText == null) return [0, null];

    for (const league of Object.keys(template)) {
        for (const teamVariations of template[league]) {
            for (const teamVariation of teamVariations) {
                if (teamVariation.length > 3) {
                    if (subText.includes(`${teamVariation.toLowerCase()} `) || subText.includes(` ${teamVariation.toLowerCase()}`)) {
                        return [(input.match(new RegExp(teamVariation.toLowerCase(), "g")) || []).length, teamVariations[0]];
                    }
                }
                else {
                    if (subText.includes(` ${teamVariation.toLowerCase()} `)) {
                        return [(input.match(new RegExp(teamVariation.toLowerCase(), "g")) || []).length, teamVariations[0]];
                    }
                }
            }
        }
    }

    return [0, null];
}

function extractBetTeamName(input) {
    let template;
    if (input.includes("mlb")) template = { MLB: fixedAliases.MLB || [] };
    else if (input.includes("milb")) template = { MiLB: fixedAliases.MiLB || [] };
    else if (input.includes("wnba")) template = { WNBA: fixedAliases.WNBA || [] };
    else if (input.includes("nba")) template = { NBA: fixedAliases.NBA || [] };
    else if (input.includes("nfl")) template = { NFL: fixedAliases.NFL || [] };
    else if (input.includes("nhl") || input.includes("hockey")) template = { NHL: fixedAliases.NHL || [] };
    else if (input.includes("cfb")) template = { CFB: aliases.CFB || [] };
    else if (input.includes("ncaaf")) template = { CFB: aliases.CFB || [] };
    else if (input.includes("ncaab")) template = { NBA: fixedAliases.CBB || [] };
    else if (input.includes("basketball")) template = { NBA: fixedAliases.NBA || [], WNBA: fixedAliases.WNBA || [] };
    else if (input.includes("baseball")) template = { MLB: fixedAliases.MLB || [], MiLB: fixedAliases.MiLB || [] };
    else if (input.includes("soccer") || input.includes("soc ")) template = { SOC: aliases.SOC || [] };
    else if (input.includes("football") || input.includes("futbol")) template = { NFL: fixedAliases.NFL || [], CFB: aliases.CFB || [] };
    else template = { TENNIS: aliases.TENNIS || [], FIGHTING: aliases.FIGHTING || [] };

    input = input.replace(/\s+vrs\s+|\s+vs\s+|\s+v.s\s+|\s+vs.\s+|\//g, " vrs ");
    
    const [prev, next] = input.split(" vrs ");

    const [prevCount, prevTeamName] = searchTeamName(input, prev, template);
    const [nextCount, nextTeamName] = searchTeamName(input, next, template);

    if (prevCount >= nextCount) {
        return prevTeamName;
    }
    
    return nextTeamName;
}

function extractMarketName(input) {
    let cleanedInput = input.replace(/\s+|-|,/g, "").replace("under/over", "").replace("over/under", "");

    if (cleanedInput.includes("teamtotalo") || cleanedInput.includes("tto")) return "tto";
    if (cleanedInput.includes("teamt") && cleanedInput.includes("over")) return "tto";

    if (cleanedInput.includes("teamtotalu") || cleanedInput.includes("ttu")) return "ttu";
    if (cleanedInput.includes("teamt") && cleanedInput.includes("under")) return "ttu";

    if (cleanedInput.includes("totalu") || cleanedInput.includes("under") || input.includes(" tu ") || input.includes(" u ") || input.match(/u\d+/)) {
        if (cleanedInput.includes("team")) return "ttu";
        return "tu";
    }

    if (cleanedInput.includes("totalo") || cleanedInput.includes("over") || input.includes(" to ") || input.includes(" o ") || input.match(/o\d+/)) {
        if (cleanedInput.includes("team")) return "tto";
        return "to";
    }

    return null;
}

function extractPeriod(input) {
    for (const [key, value] of Object.entries(periodsMap)) {
        if (input.includes(`${key} `) || input.includes(` ${key}`)) {
            return [input.replace(key, "").trim(), value];
        }
    }
    return [input, "ft"];
}

function extractPoints(input) {
    if (input.includes("pk")) {
        return "pk";
    }

    input = input.replace(/\s+|,|@/g, "");
    input = input.replace("½", ".5").replace("¼", ".25").replace("¾", ".75");
    input = input.replace("1/2", ".5").replace("1/4", ".25").replace("3/4", ".75");
    input = input.replace("+.", "+0.").replace("-.", "-0.").replace("o.", "o0.").replace("u.", "u0.");

    if (input.includes(" ev") || input.match(/(\d+)ev/i)) input = input.replace("ev", "+100");

    let points = input.match(/([+\-])(\d{1,3}(?:\.\d{1,2})?)([+\-])/);  // +7.5+ or -3.25-
    if (points && points[1] && points[2] && points[3]) {
        return points[1] + points[2];
    }

    points = input.match(/(\d{1,3}(?:\.\d{1,2})?)([+\-])/);  // 7.5+ or 3.25-
    if (points && points[1] && points[2]) {
        return points[1];
    }

    return 0;
}

function extractOdds(input) {
    input = input.replace("½", ".5").replace("¼", ".25").replace("¾", ".75");
    input = input.replace("1/2", ".5").replace("1/4", ".25").replace("3/4", ".75");

    const odds = input.match(/([+\-]\d{3,4})/);
    if (odds && odds[1]) {
        return parseInt(odds[1]);
    }

    if (input.includes(" ev") || input.match(/(\d+)ev/i)) return 100;
    
    return null;
}

function extractStake(input) {
    if (input.match(/(\d+(?:\.\d{1,2})?)k/)) {
        return parseFloat(input.match(/(\d+(?:\.\d{1,2})?)k/)[1]) * 1000;
    }

    const patterns = [/\$(\d+(?:\.\d{1,2})?)/, /usd\s+(\d+(?:\.\d{1,2})?)/, /(\d+(?:\.\d{1,2})?)\s+usd/];
    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
            return parseFloat(match[1]);
        }
    }

    const lastValue = input.split(" ").at(-1);
    if (/^\d+$/.test(lastValue)) {
        return parseFloat(lastValue);
    }

    return null;
}

exports.main = function (input) {
    input = input.toLowerCase().replace(/ - /g, "");

    const points = extractPoints(input);
    const odds = extractOdds(input);
    const stake = extractStake(input);
    const [simplifiedInput, period] = extractPeriod(input);
    const updatedPeriod = input.includes("3-way") || input.includes("3 way") || input.includes("3way") ? `${period} 3-way` : period;
    const betTeamName = extractBetTeamName(simplifiedInput);

    let marketName = null;
    if (simplifiedInput.includes(" draw ") || simplifiedInput.includes(" tie ") || simplifiedInput.includes(" x ")) marketName = "draw";
    else if (points == 0) marketName = "ml";
    else if (points == "pk" || points.includes("+") || points.includes("-")) marketName = "sprd";
    else marketName = extractMarketName(simplifiedInput);

    const props = input.includes("props") ? true : false;

    const output = { betTeamName, period: updatedPeriod, marketName, points, odds, stake, props };
    return output;
}
