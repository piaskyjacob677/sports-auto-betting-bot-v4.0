const fs = require("fs");
const openai = require("openai");
const aliases = require("../data/aliases.json");
const fixedAliases = require("../data/fixedAliases.json");
const periodsMap = require("../data/periodsMap.json");
require('dotenv').config();
const client = new openai({ apiKey: process.env.OPENAI_API_KEY });

exports.getAlias = async (leagueName, leagueDescription, teamNames) => {
    try {
        const res = await Promise.race([
            client.chat.completions.create({
                model: "gpt-4o-mini",
                temperature: 0,
                response_format: { type: "json_object" },
                messages: [{
                    role: "system", 
                    content: `You are an expert in generating all possible aliases for sports teams and individual players across different leagues. Based on the league's Name (${leagueName}) and Description (${leagueDescription}), return all common, shortened, alternate, historical, translated, and mis-spelled aliases for each entry in the list below. List each entry on a separate line as shown. Include all meaningful aliases, following rules for abbreviations, nicknames, canonical forms, and deduplication.

                    -----------------------------------
                    ${teamNames.join("\n")}
                    -----------------------------------

                    Rules for generating aliases:

                    1. Always include the given input name itself as the first alias in each list.  
                    2. Include official full names, last name only, first name + last name, first initial + last name, common sportsbook formats, widely used fan/media nicknames, abbreviations (limit to 3-4 letters for shortened forms), common typos, international naming variations (e.g., accented vs non-accented), legacy names (previous franchise names), and standard 3-letter sportsbook/league codes (for teams).  
                    3. Deduplicate all aliases **strictly**: no repeated names in the same array, including duplicates caused by case differences, punctuation, spacing, or minor abbreviation variations. If two aliases are identical except for small typos or punctuation, keep only one, preferring the more complete or canonical version.  
                    4. Do not pad the list to a fixed number of aliases.  
                    5. Sort aliases by relevance/popularity, with the most official and widely used aliases appearing first.  
                    6. Return the result strictly as a JSON array of arrays, where each inner array contains all aliases for one team or player.  
                    7. Output only the JSON array, with no extra text, explanation, or formatting.
                    8. For tennis players and fighters, don't include only the first name or the last name, include both the first name and the last name. If middle name is present, include it as well.` 
                }]
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30 * 1000)
            )
        ]);
        
        const raw = (res.choices?.[0]?.message?.content || "").trim();
        const newAliases = JSON.parse(raw).result || JSON.parse(raw).data || JSON.parse(raw).aliases || [];
        if (newAliases.length > 0) {
            if (!aliases[leagueName]) aliases[leagueName] = [];
            aliases[leagueName].push(...newAliases);
            fs.writeFileSync("data/aliases.json", JSON.stringify(aliases, null, 2));
        }
    } catch (error) {
        console.log(`getAlias timeout or error for ${leagueName}:`, error.message);
        throw error;
    }
}

exports.findNormalizedTeamName = (leagueName, teamName) => {
    teamName = teamName.toLowerCase();

    if (["MLB", "MiLB", "NBA", "WNBA", "CBB", "NFL", "NHL"].includes(leagueName)) {
        for (const teamVariations of fixedAliases[leagueName]) {
            for (const teamVariation of teamVariations) {
                if (teamVariation.toLowerCase() == teamName) {
                    return [true, teamVariations[0].toLowerCase()];
                }
            }
        }

        return [true, teamName];
    }
    else {
        if (!aliases[leagueName]) return [false, teamName];

        for (const teamVariations of aliases[leagueName]) {
            for (const teamVariation of teamVariations) {
                if (teamVariation.toLowerCase() == teamName) {
                    return [true, teamVariations[0].toLowerCase()];
                }
            }
        }

        return [false, teamName];
    }
}

exports.cleanTeamName = (teamName) => {
    teamName = teamName.toLowerCase();
    teamName = teamName.replace(/\([a-z]{1,3}\)/g, "").replace(/[()]/g, "").trim();
    teamName = teamName.replace(/\b(3way|3 way|3-way|team total|no ot|total goals)\b/g, "").trim();

    for (const key of Object.keys(periodsMap)) {
        if (teamName.includes(key)) {
            return teamName.replace(key, "").trim();
        }
    }
    return teamName;
}

exports.cleanGpd = (gpd) => {
    gpd = gpd.toLowerCase();
    const suffix = (gpd.includes("3 way") || gpd.includes("3-way") || gpd.includes("3way")) ? " 3-way" : "";

    for (const [key, value] of Object.entries(periodsMap)) {
        if (gpd.includes(key)) {
            return `${value}${suffix}`;
        }
    }
    return `ft${suffix}`;
}

exports.checkTolerance = (bookPoints, bookOdds, inputPoints, inputOdds, pointsTolerance, oddsTolerance, marketName) => {
    bookPoints = parseFloat(bookPoints);
    bookOdds = parseFloat(bookOdds);
    inputPoints = parseFloat(inputPoints);
    inputOdds = parseFloat(inputOdds);

    bookOdds = bookOdds >= 100 ? bookOdds - 100 : bookOdds + 100;
    inputOdds = inputOdds >= 100 ? inputOdds - 100 : inputOdds + 100;

    if ((inputOdds - bookOdds) > oddsTolerance) return false;

    if (marketName == "total") {
        if (inputPoints - bookPoints > pointsTolerance) return false;
    }
    else {
        if (inputPoints > bookPoints && Math.abs(bookPoints - inputPoints) > pointsTolerance) return false;
    }

    return true;
}
