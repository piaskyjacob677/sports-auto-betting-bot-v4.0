const fs = require('fs');

const TelegramBot = require('node-telegram-bot-api');
const parseSignal = require('./utils/parseSignal.js');

const accounts = require("./data/accounts.json");
const Action = require('./services/action.js');
const Godds = require('./services/godds.js');
const Strikerich = require('./services/strikerich.js');
const Highroller = require('./services/highroller.js');
const Fesster = require('./services/fesster.js');
const Betwindycity = require('./services/betwindycity.js');
const Abcwager = require('./services/abcwager.js');

let tolerances = require("./data/tolerances.json");
let stakeAmounts = require("./data/stakeAmounts.json");

require('dotenv').config();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ALLOWED_CHATID = process.env.ALLOWED_CHATID ? process.env.ALLOWED_CHATID.split(",") : [];
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

class Server {
    constructor() {
        this.stakeAmountCount = 3;
        this.stakeChoice = 1;
        this.confirmMode = true;
        this.placedTickets = [];
        this.services = [
            new Action(),
            new Godds(),
            new Highroller(),
            new Fesster(),
            // new Strikerich(),
            // new Betwindycity(),
            // new Abcwager(),
        ];
    }
    init() {
        for (const service of this.services) {
            service.userManager();
            service.main();
        }
        this.handleProcessError();
        this.botRunner();
    }
    handleProcessError() {
        process.on('unhandledRejection', (reason, promise) => {
            console.log(new Date().toLocaleString(), 'Unhandled Rejection at:', promise, 'reason:', reason);
        });
        process.on('uncaughtException', (err) => {
            console.log(new Date().toLocaleString(), 'Uncaught Exception:', err);
        });
        process.on('uncaughtExceptionMonitor', (err) => {
            console.log(new Date().toLocaleString(), 'Uncaught Exception Monitor:', err);
        });
        process.on('rejectionHandled', (promise) => {
            console.log(new Date().toLocaleString(), 'Rejection Handled:', promise);
        });
        process.on('warning', (warning) => {
            console.log(new Date().toLocaleString(), 'Warning:', warning);
        });
    }
    async commandTolerances(msg) {
        const chatId = msg.chat.id;

        if (!ALLOWED_CHATID.includes(chatId.toString())) {
            await bot.sendMessage(chatId, "You are not authorized to use this bot.");
            await this.sendMessageToChannel(`A person with ${chatId} attempted to use this bot.`);
            return;
        }

        const keyboard = [
            [
                { text: "Sports", callback_data: "n/a" },
                { text: "Points", callback_data: "n/a" },
                { text: "Cents", callback_data: "n/a" }
            ]
        ];

        for (const sportName of Object.keys(tolerances.Points)) {
            keyboard.push([
                { text: sportName, callback_data: "n/a" },
                { text: tolerances.Points[sportName].toString(), callback_data: `tolerance_Points_${sportName}` },
                { text: tolerances.Cents[sportName].toString(), callback_data: `tolerance_Cents_${sportName}` }
            ]);
        }

        const replyMarkup = { inline_keyboard: keyboard };
        await bot.sendMessage(chatId, "Points & Cents Tolerance", { reply_markup: replyMarkup });
    }
    async commandTolerancesValue(callbackQuery) {
        const query = callbackQuery;
        await bot.answerCallbackQuery(query.id);

        const queryData = query.data;
        const parts = queryData.split("_");
        const tolerType = parts[parts.length - 2];
        const sportName = parts[parts.length - 1];

        const toleranceOptions = {
            "Points": [
                [0.0, 0.5, 1.0, 1.5, 2.0],
                [2.5, 3.0, 3.5, 4.0, 4.5],
                [5.0, 5.5, 6.0, 6.5, 7.0],
                [7.5, 8.0, 8.5, 9.0, 9.5]
            ],
            "Cents": [
                [5, 10, 15, 20, 25],
                [30, 35, 40, 45, 50]
            ]
        };

        const keyboard = [];
        for (let row = 0; row < toleranceOptions[tolerType].length; row++) {
            const rowKeyboard = [];
            for (let col = 0; col < 5; col++) {
                const value = toleranceOptions[tolerType][row][col];
                rowKeyboard.push({
                    text: value.toString(),
                    callback_data: `toleranceValue_${tolerType}_${sportName}_${value}`
                });
            }
            keyboard.push(rowKeyboard);
        }

        const replyMarkup = { inline_keyboard: keyboard };
        await bot.editMessageText(
            `${sportName} ${tolerType} Tolerance`,
            {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                reply_markup: replyMarkup
            }
        );
    }
    async commandStakeAmounts(msg) {
        const chatId = msg.chat.id;

        if (!ALLOWED_CHATID.includes(chatId.toString())) {
            await bot.sendMessage(chatId, "You are not authorized to use this bot.");
            await this.sendMessageToChannel(`A person with ${chatId} attempted to use this bot.`);
            return;
        }

        const keyboard = [];

        const headerRow = [{ text: "Sports", callback_data: "n/a" }];
        for (let index = 0; index < this.stakeAmountCount; index++) {
            headerRow.push({ text: `${index + 1}`, callback_data: "n/a" });
        }
        keyboard.push(headerRow);

        for (const sportName of Object.keys(stakeAmounts[0])) {
            const row = [{ text: sportName, callback_data: "n/a" }];
            for (let index = 0; index < this.stakeAmountCount; index++) {
                row.push({
                    text: `$${stakeAmounts[index][sportName]}`,
                    callback_data: `stakeAmounts_${index}_${sportName}`
                });
            }
            keyboard.push(row);
        }

        const replyMarkup = { inline_keyboard: keyboard };
        await bot.sendMessage(chatId, "Stake Amounts", { reply_markup: replyMarkup });
    }
    async commandStakeAmountsValue(callbackQuery) {
        const query = callbackQuery;
        await bot.answerCallbackQuery(query.id);

        const queryData = query.data;
        const parts = queryData.split("_");
        const index = parseInt(parts[parts.length - 2]);
        const sportName = parts[parts.length - 1];

        const stakeAmountOptions = [
            [0, 10, 25, 50],
            [100, 250, 500, 750],
            [1000, 1500, 2000, 2500],
            [3000, 3500, 4000, 4500],
            [5000, 6000, 7500, 10000]
        ];

        const keyboard = [];
        for (let row = 0; row < 5; row++) {
            const rowKeyboard = [];
            for (let col = 0; col < 4; col++) {
                const value = stakeAmountOptions[row][col];
                rowKeyboard.push({
                    text: value.toString(),
                    callback_data: `stakeAmountValue_${index}_${sportName}_${value}`
                });
            }
            keyboard.push(rowKeyboard);
        }

        const replyMarkup = { inline_keyboard: keyboard };
        await bot.editMessageText(
            `${sportName} Stake ${index + 1}`,
            {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id,
                reply_markup: replyMarkup
            }
        );
    }
    async commandStakeChoice(msg) {
        const chatId = msg.chat.id;

        if (!ALLOWED_CHATID.includes(chatId.toString())) {
            await bot.sendMessage(chatId, "You are not authorized to use this bot.");
            await this.sendMessageToChannel(`A person with ${chatId} attempted to use this bot.`);
            return;
        }

        const keyboard = [];
        for (let index = 0; index < this.stakeAmountCount; index++) {
            keyboard.push({
                text: `${index + 1}`,
                callback_data: `stakeChoice_${index + 1}`
            });
        }

        const replyMarkup = {
            inline_keyboard: [keyboard]
        };

        await bot.sendMessage(chatId, "Stake Amount Choice", { reply_markup: replyMarkup });
    }
    async commandConfirmToggle(msg) {
        const chatId = msg.chat.id;

        if (!ALLOWED_CHATID.includes(chatId.toString())) {
            await bot.sendMessage(chatId, "You are not authorized to use this bot.");
            await this.sendMessageToChannel(`A person with ${chatId} attempted to use this bot.`);
            return;
        }

        const keyboard = [{
            text: `${this.confirmMode ? 'OFF' : 'ON'}`,
            callback_data: `confirmToggle`
        }];

        const replyMarkup = {
            inline_keyboard: [keyboard]
        };

        await bot.sendMessage(chatId, "Confirmation Mode", { reply_markup: replyMarkup });
    }
    async commandUsers(msg) {
        const chatId = msg.chat.id;

        if (!ALLOWED_CHATID.includes(chatId.toString())) {
            await bot.sendMessage(chatId, "You are not authorized to use this bot.");
            await this.sendMessageToChannel(`A person with ${chatId} attempted to use this bot.`);
            return;
        }

        let keyboard = [];
        let index = 0;
        const headerRow = [
            { text: "No", callback_data: "n/a" },
            { text: "Username", callback_data: "n/a" },
            { text: "Balance", callback_data: "n/a" },
            { text: "Available", callback_data: "n/a" },
            { text: "Atrisk", callback_data: "n/a" },
            { text: "Delete", callback_data: "n/a" }
        ];
        keyboard.push(headerRow);

        for (const [serviceName, data] of Object.entries(accounts)) {
            for (const account of data) {
                let row = [];
                index++;
                row.push({ text: `${index}`, callback_data: "n/a" });
                row.push({ text: `${account.username} - ${serviceName}`, callback_data: "n/a" });
                row.push({ text: `${account.balance}`, callback_data: "n/a" });
                row.push({ text: `${account.available}`, callback_data: "n/a" });
                row.push({ text: `${account.atrisk}`, callback_data: "n/a" });
                row.push({ text: "Del", callback_data: `deleteUser_${serviceName}_${account.username}` });
                keyboard.push(row);
            }
        }

        const replyMarkup = {
            inline_keyboard: keyboard
        };

        await bot.sendMessage(chatId, "Users", { reply_markup: replyMarkup });
    }
    async commandServices(msg) {
        const chatId = msg.chat.id;

        if (!ALLOWED_CHATID.includes(chatId.toString())) {
            await bot.sendMessage(chatId, "You are not authorized to use this bot.");
            await this.sendMessageToChannel(`A person with ${chatId} attempted to use this bot.`);
            return;
        }

        const keyboard = [];
        for (const service of this.services) {
            keyboard.push({ text: service.serviceName, callback_data: "n/a" });
        }

        const replyMarkup = { inline_keyboard: [keyboard] };
        await bot.sendMessage(chatId, "Services", { reply_markup: replyMarkup });
    }
    async handleCallbackQuery(callbackQuery) {
        const query = callbackQuery;
        await bot.answerCallbackQuery(query.id);

        const queryData = query.data;

        if (queryData.startsWith("toleranceValue_")) {
            const parts = queryData.split("_");
            const tolerType = parts[1];
            const sportName = parts[2];
            const value = parseFloat(parts[3]);

            tolerances[tolerType][sportName] = value;

            await this.sendMessageToChannel(`${sportName} ${tolerType} Tolerance updated to ${value}`);

            fs.writeFileSync("data/tolerances.json", JSON.stringify(tolerances, null, 2));
        }
        else if (queryData.startsWith("tolerance_")) {
            await this.commandTolerancesValue(callbackQuery);
        }
        else if (queryData.startsWith("stakeAmountValue_")) {
            const parts = queryData.split("_");
            const index = parseInt(parts[1]);
            const sportName = parts[2];
            const value = parseInt(parts[3]);

            stakeAmounts[index][sportName] = value;

            await this.sendMessageToChannel(`${sportName} Stake ${index + 1} updated to ${value}. /stake_amount`);

            fs.writeFileSync("data/stakeAmounts.json", JSON.stringify(stakeAmounts, null, 2));
        }
        else if (queryData.startsWith("stakeAmounts_")) {
            await this.commandStakeAmountsValue(callbackQuery);
        }
        else if (queryData.startsWith("stakeChoice_")) {
            this.stakeChoice = parseInt(queryData.split("_")[1]);

            await this.sendMessageToChannel(`Stake Amount updated to ${this.stakeChoice}`);
        }
        else if (queryData.startsWith("confirmToggle")) {
            this.confirmMode = !this.confirmMode;

            await this.sendMessageToChannel(`Confirm Mode updated to ${this.confirmMode ? 'ON' : 'OFF'}`);
        }
        else if (queryData.startsWith("cc_")) {
            const parts = queryData.split("_");
            const serviceName = parts[1];
            const betTeamName = parts[2];
            const period = parts[3];
            const marketName = parts[4];
            const inputPoints = Number(parts[5]);
            const inputOdds = Number(parts[6]);
            const stake = Number(parts[7]);

            const service = this.services.find(service => service.serviceName == serviceName);
            if (!service) {
                await this.sendMessageToChannel(`Service ${serviceName} not found. Skipping...`);
                return;
            }
            const outputs = await service.place(betTeamName, period, marketName, inputPoints, inputOdds, stake);
            for (const output of outputs) {
                if (output && output.msg == "Success") {
                    await this.sendMessageToChannel(`${output.service} ${output.account.username} 👍`);
                }
                else {
                    await this.sendMessageToChannel(`${output.service} ${output.account.username} 👎 ${output.msg}.`);
                }
            }
        }
        else if (queryData.startsWith("cd_")) {
            const parts = queryData.split("_");
            const serviceName = parts[1];
            const betTeamName = parts[2];
            const period = parts[3];
            const marketName = parts[4];
            const inputPoints = Number(parts[5]);
            const inputOdds = Number(parts[6]);

            await this.sendMessageToChannel(`${serviceName} Bet canceled. ${betTeamName} ${period} ${marketName} ${inputPoints}/${inputOdds}`);
        }
        else if (queryData.startsWith("deleteUser_")) {
            const parts = queryData.split("_");
            const serviceName = parts[1];
            const username = parts[2];
            accounts[serviceName] = accounts[serviceName].filter(account => account.username != username);
            await this.sendMessageToChannel(`${serviceName} ${username} deleted. /users`);
            fs.writeFileSync("data/accounts.json", JSON.stringify(accounts, null, 2));
        }
    }
    async handleTextMessage(msg) {
        const input = msg.text;

        const parsedSignal = parseSignal.main(input);
        let betTeamName = parsedSignal.betTeamName;
        if (betTeamName) betTeamName = betTeamName.toLowerCase();
        const period = parsedSignal.period;
        const marketName = parsedSignal.marketName;
        let inputPoints = parsedSignal.points == "pk" ? "pk" : Number(parsedSignal.points);
        const inputOdds = Number(parsedSignal.odds);
        const inputStake = parsedSignal.stake;
        const props = parsedSignal.props;

        let alert = "";
        if (input.toLowerCase().includes("live")) alert = "Live bets are not supported. Skipping...";
        if (!alert && this.placedTickets.includes(input)) alert = "Ticket already placed. Skipping...";
        if (!alert && props) alert = "Props are not supported. Skipping...";
        if (!alert && inputOdds == 0) alert = "No odds value given. Skipping...";
        if (!alert && !betTeamName) alert = "Invalid bet signal. Skipping...";

        const inputMessage = `🔥 ${input}
            --------------------------------
            betTeamName: ${betTeamName}
            period: ${period}
            marketName: ${marketName}
            inputPoints: ${inputPoints}
            inputOdds: ${inputOdds}
            inputStake: ${inputStake}
            props: ${props}${alert ? `\n\n${alert}` : ''}`;

        await this.sendMessageToChannel(inputMessage);
        if (alert) return;

        let outputs = [];
        for (const service of this.services) {
            alert = "";

            if (!service.matches[betTeamName]) {
                alert = `${service.serviceName}: Team ${betTeamName} not found in matches data. Skipping...`;
            }
            else if ((!service.matches[betTeamName][period])) {
                alert = `${service.serviceName}: Period ${period} not found for team ${betTeamName}. Skipping...`;
            }
            else if (!service.matches[betTeamName][period][marketName]) {
                alert = `${service.serviceName}: Market ${marketName} not found for team ${betTeamName} in period ${period}. Skipping...`;
            }

            if (alert) {
                await this.sendMessageToChannel(alert);
                continue;
            }

            const betslip = service.matches[betTeamName][period][marketName];

            let sportName = betslip.sport;
            if (sportName == "MILB AAA") sportName = "MiLB";
            const desc = betslip.desc;
            const bookPoints = Number(betslip.points);
            const bookOdds = Number(betslip.odds);
            const idmk = betslip.idmk;

            if (inputPoints == "pk") inputPoints = bookPoints;
            if (idmk == 2) inputPoints = -inputPoints;

            const stake = inputStake || stakeAmounts[this.stakeChoice - 1][sportName] || 25;

            const url = typeof service.makeUrl === "function" ? service.makeUrl(betTeamName, period, marketName, inputPoints, inputOdds) : null;

            const message = `${service.serviceName} ${bookPoints}/${bookOdds} $${stake} ${url ? `<a href="${url}">${desc}</a>` : desc}`;

            const confirmData = `${service.serviceName}_${betTeamName}_${period}_${marketName}_${inputPoints}_${inputOdds}_${stake}`;

            const keyboard = this.confirmMode ? {
                inline_keyboard: [
                    [
                        { text: "Continue", callback_data: `cc_${confirmData}` },
                        { text: "Cancel", callback_data: `cd_${confirmData}` }
                    ]
                ]
            } : null;

            await this.sendMessageToChannel(message, keyboard);

            if (this.confirmMode) continue;

            outputs.push(...(await service.place(betTeamName, period, marketName, inputPoints, inputOdds, stake)));
        }

        for (const output of outputs) {
            if (output.msg == "Success") {
                if (!this.placedTickets.includes(input)) this.placedTickets.push(input);
                await this.sendMessageToChannel(`${output.service} ${output.account.username} 👍 ${input}`);
            }
            else await this.sendMessageToChannel(`${output.service} ${output.account.username} 👎 ${input} ${output.msg}.`);
        }

    }
    async sendMessageToChannel(message, keyboard = null) {
        for (const chatId of ALLOWED_CHATID) {
            try {
                await bot.sendMessage(chatId, message, {
                    parse_mode: "HTML",
                    disable_web_page_preview: true,
                    reply_markup: keyboard
                });
            } catch (error) {
                console.log(new Date().toLocaleString(), `Failed to send message to ${chatId}:`, error.message);
            }
        }
    }
    async errorHandler(error) {
        console.log(new Date().toLocaleString(), "Bot error:", error.message);
    }

    async setupBotCommands() {
        try {
            const commands = [
                { command: 'users', description: 'View user information' },
                { command: 'services', description: 'View available services' },
                { command: 'tolerances', description: 'View current tolerance settings' },
                { command: 'stake_amounts', description: 'View available stake amounts' },
                { command: 'stake_choice', description: 'Set your preferred stake amount' },
                { command: 'confirm_toggle', description: 'Toggle confirmation mode on/off' },
            ];

            await bot.setMyCommands(commands);
        } catch (error) {
            console.log('Error setting up bot commands:', error.message);
        }
    }
    botRunner() {
        bot.on('channel_post', async (msg) => {
            this.handleTextMessage(msg);
        });

        bot.on('message', async (msg) => {
            if (msg.text.startsWith('/users')) return this.commandUsers(msg);
            if (msg.text.startsWith('/services')) return this.commandServices(msg);
            if (msg.text.startsWith('/tolerances')) return this.commandTolerances(msg);
            if (msg.text.startsWith('/stake_amounts')) return this.commandStakeAmounts(msg);
            if (msg.text.startsWith('/stake_choice')) return this.commandStakeChoice(msg);
            if (msg.text.startsWith('/confirm_toggle')) return this.commandConfirmToggle(msg);

            for (const service of this.services) {
                if (msg.text.startsWith(`${service.serviceName}/`)) {
                    const username = msg.text.split("/")[1] || "";
                    const password = msg.text.split("/")[2] || "";
                    const playerId = msg.text.split("/")[3] || "";
                    const profileId = msg.text.split("/")[4] || "";
                    const profileLimitId = msg.text.split("/")[5] || "";

                    const account = accounts[service.serviceName].find(account => account.username == username);
                    if (account) {
                        await this.sendMessageToChannel(`${service.serviceName} ${username} already exists. Skipping...`);
                    }
                    else {
                        if (service.serviceName == "Godds") {
                            if (playerId == "" || profileId == "" || profileLimitId == "") {
                                await this.sendMessageToChannel(`${service.serviceName} ${username} missing playerId, profileId, or profileLimitId. Skipping...`);
                                return;
                            }
                            accounts[service.serviceName].push({
                                username: username,
                                password: password,
                                playerId: playerId,
                                profileId: profileId,
                                profileLimitId: profileLimitId,
                                balance: 0,
                                available: 0,
                                atrisk: 0,
                            });
                        }
                        else {
                            accounts[service.serviceName].push({
                                username: username,
                                password: password,
                                balance: 0,
                                available: 0,
                                atrisk: 0,
                            });
                        }
                        fs.writeFileSync("data/accounts.json", JSON.stringify(accounts, null, 2));
                        await this.sendMessageToChannel(`${service.serviceName} ${username} added. /users`);
                    }
                    return;
                }
            }

            this.handleTextMessage(msg);
        });

        bot.on('callback_query', (query) => this.handleCallbackQuery(query));
        bot.on('error', (error) => this.errorHandler(error));

        this.setupBotCommands();

        this.sendMessageToChannel("✨ Initializing… Please wait a moment while we get things ready for you.").then(() => {
            const intervalId = setInterval(async () => {
                if (this.services.every(service => service.isReady)) {
                    await this.sendMessageToChannel("🔥 Your betting assistant is ready — let's win big!");
                    clearInterval(intervalId);
                }
            }, 1000);
        });
    }
}

const server = new Server();
server.init();

require("./web/index.js")(server)
