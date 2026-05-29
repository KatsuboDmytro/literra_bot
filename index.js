require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MODERATION_CHAT_ID = process.env.MODERATION_CHAT_ID;

// Привітання користувача
bot.start((ctx) => {
    ctx.reply('Привіт! Надішли сюди свою історію (текст, фото або відео). Все абсолютно анонімно. Твій юзернейм ніхто не побачить!');
});

// Обробка будь-яких повідомлень
bot.on(['text', 'photo', 'video', 'animation'], async (ctx) => {
    try {
        // Сповіщаємо користувача, що прийняли історію
        await ctx.reply('Дякую! Твою історію відправлено на модерацію.');

        // Пересилаємо копію повідомлення в групу модерації (без згадки автора)
        await ctx.copyMessage(MODERATION_CHAT_ID);

    } catch (error) {
        console.error('Помилка при пересиланні:', error);
        ctx.reply('Ой, щось пішло не так. Спробуй ще раз трохи пізніше.');
    }
});

bot.launch().then(() => console.log('Бот успішно запущений!'));

// М'яка зупинка при перезапуску сервера
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));