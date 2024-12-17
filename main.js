const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const express = require("express");

const botToken = '7801977957:AAGZav-Jyxv39AQUdivE_EfvIpGEF9cJFfU'; // Replace with your bot token
const bot = new TelegramBot(botToken, { polling: true }); // Use polling mode for the bot

const app = express();

const ownerUserId = 6923915798; // Replace with your user ID
const authorizedUsers = {}; // Object to store authorized user IDs and their data

const startMessage = "Welcome to 𝐒𝐏𝐘 𝐅𝐎𝐑𝐖𝐀𝐑𝐃 𝐁𝐎𝐓..."; // Your start message

// Load authorized users data from file if it exists
const authorizedUsersFile = 'authorized_users.json';
if (fs.existsSync(authorizedUsersFile)) {
  const data = fs.readFileSync(authorizedUsersFile);
  Object.assign(authorizedUsers, JSON.parse(data));
}

let isForwarding = false;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function forwardMessagesInRange(chatId, sourceChatId, destinationChatId, startId, endId) {
  isForwarding = true;

  const batchSize = 20;
  const batchDelay = 2000;
  const messageDelay = 50;
  const floodWaitDelay = 15000;

  for (let messageId = startId; messageId <= endId; messageId += batchSize) {
    if (!isForwarding) {
      break;
    }

    const endBatchId = Math.min(messageId + batchSize - 1, endId);

    try {
      for (let batchMessageId = messageId; batchMessageId <= endBatchId; batchMessageId++) {
        await bot.copyMessage(destinationChatId, sourceChatId, batchMessageId, { disable_notification: true });
        console.log(`Forwarded message ${batchMessageId}`);
        if (batchMessageId !== endBatchId) {
          await delay(messageDelay);
        }
      }
      console.log(`Forwarded messages from ${messageId} to ${endBatchId}`);

      if (endBatchId !== endId) {
        await delay(batchDelay);
      }
    } catch (error) {
      console.error(`Error forwarding messages:`, error);
      if (error.response && error.response.statusCode === 429) {
        console.log(`Flood Wait error. Waiting for ${floodWaitDelay / 1000} seconds...`);
        await delay(floodWaitDelay);
      }
    }
  }

  isForwarding = false;
}

// Handle authorized users and commands
bot.onText(/\/auth (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = parseInt(match[1]);

  if (msg.from.id === ownerUserId) {
    authorizedUsers[userId] = true;
    saveAuthorizedUsers();
    bot.sendMessage(chatId, `User ${userId} is now authorized.`);
  } else {
    bot.sendMessage(chatId, 'You are not authorized to perform this action...');
  }
});

bot.onText(/\/unauth/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (userId === ownerUserId) {
    if (authorizedUsers[userId]) {
      delete authorizedUsers[userId];
      saveAuthorizedUsers();
      bot.sendMessage(chatId, 'You are now unauthorized to use the bot...');
    } else {
      bot.sendMessage(chatId, 'You are not authorized to use the bot...');
    }
  } else {
    bot.sendMessage(chatId, 'Only the owner can perform this action...');
  }
});

bot.onText(/\/owner/, (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.from.id === ownerUserId) {
    bot.sendMessage(chatId, 'You are the owner of this bot.');
  } else {
    bot.sendMessage(chatId, 'You are not the owner of this bot.');
  }
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, startMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '𝙊𝙬𝙣𝙚𝙧', url: 'https://t.me/gazabho' }],
        [{ text: '𝙂𝙚𝙩 𝙔𝙤𝙪𝙧𝙨𝙚𝙡𝙛 𝘼𝙪𝙩𝙝𝙤𝙧𝙞𝙯𝙚𝙙', url: 'https://t.me/dev_gagan' }],
      ],
    },
  });
});

bot.onText(/\/forward/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (!authorizedUsers[msg.from.id]) {
    bot.sendMessage(chatId, 'You are not authorized to perform this action.');
    return;
  }

  await bot.sendMessage(chatId, 'Please provide the source chat ID (integer):');
  bot.once('message', (sourceMessage) => {
    const sourceChatId = parseIntegerMessage(sourceMessage);

    if (isNaN(sourceChatId)) {
      bot.sendMessage(chatId, 'Invalid input. Please resend the source chat ID as an integer.');
      return;
    }

    bot.sendMessage(chatId, 'Please provide the destination chat ID (integer):');
    bot.once('message', (destinationMessage) => {
      const destinationChatId = parseIntegerMessage(destinationMessage);

      if (isNaN(destinationChatId)) {
        bot.sendMessage(chatId, 'Invalid input. Please resend the destination chat ID as an integer.');
        return;
      }

      bot.sendMessage(chatId, 'Please provide the start message ID (integer):');
      bot.once('message', (startMessageIdMessage) => {
        const startMessageId = parseIntegerMessage(startMessageIdMessage);

        if (isNaN(startMessageId)) {
          bot.sendMessage(chatId, 'Invalid input. Please resend the start message ID as an integer.');
          return;
        }

        bot.sendMessage(chatId, 'Please provide the end message ID (integer):');
        bot.once('message', (endMessageIdMessage) => {
          const endMessageId = parseIntegerMessage(endMessageIdMessage);

          if (isNaN(endMessageId)) {
            bot.sendMessage(chatId, 'Invalid input. Please resend the end message ID as an integer.');
            return;
          }

          forwardMessagesInRange(chatId, sourceChatId, destinationChatId, startMessageId, endMessageId)
            .then(() => {
              bot.sendMessage(chatId, 'Forwarded messages to the destination chat');
            })
            .catch((error) => {
              bot.sendMessage(chatId, 'Error forwarding messages. Please try again later.');
              console.error('Error forwarding messages:', error);
            });
        });
      });
    });
  });
});

bot.onText(/\/cancel/, async (msg) => {
  const chatId = msg.chat.id;
  if (isForwarding) {
    isForwarding = false;
    await bot.sendMessage(chatId, 'Forwarding process canceled.');
  } else {
    await bot.sendMessage(chatId, 'No forwarding process is currently ongoing.');
  }
});

function saveAuthorizedUsers() {
  const data = JSON.stringify(authorizedUsers, null, 2);
  fs.writeFileSync('authorized_users.json', data, 'utf8');
}

// Basic health check endpoint for Express
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

// Start the Express server
const PORT = 3000;
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown for both the bot and server
process.once('SIGINT', () => {
  bot.stop('SIGINT');
  server.close(() => {
    console.log('Server shut down gracefully');
    process.exit(0);
  });
});

process.once('SIGTERM', () => {
  bot.stop('SIGTERM');
  server.close(() => {
    console.log('Server shut down gracefully');
    process.exit(0);
  });
});

// Utility to parse integer from message
function parseIntegerMessage(message) {
  const parsedValue = parseInt(message.text.trim());
  return isNaN(parsedValue) ? NaN : parsedValue;
}
