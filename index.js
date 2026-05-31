require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MODERATION_CHAT_ID = process.env.MODERATION_CHAT_ID;

// Зберігаємо роль користувача в пам'яті сесії
const userRoles = new Map();

// Привітання
bot.start((ctx) => {
    ctx.reply(
        `Привіт. Тут можна виговоритись.\n\nЄ що розповісти про акселератор, інвестора, партнера або власний факап? Надсилай — це анонімно. Імена компаній, міста та будь-які деталі що можуть тебе ідентифікувати — прибираємо перед публікацією, якщо сам не попросиш залишити.\n\nСпочатку скажи хто ти:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('Фаундер', 'role_founder')],
            [Markup.button.callback('Менеджер акселератора / хабу', 'role_accelerator')],
            [Markup.button.callback('Інвестор', 'role_investor')],
        ])
    );
});

// Обробка вибору ролі
bot.action(/^role_(.+)$/, async (ctx) => {
    const role = ctx.match[1];
    const labels = {
        founder: 'Фаундер',
        accelerator: 'Менеджер акселератора / хабу',
        investor: 'Інвестор',
    };
    userRoles.set(ctx.from.id, labels[role]);
    await ctx.answerCbQuery();
    await ctx.reply('Добре. Тепер напиши або надішли скріншот 👇');
});

// Обробка повідомлень
bot.on(['text', 'photo', 'video', 'animation'], async (ctx) => {
    // Ігноруємо якщо це команда
    if (ctx.message.text?.startsWith('/')) return;

    const role = userRoles.get(ctx.from.id) || 'Роль не вказана';

    try {
        await ctx.reply(
            'Отримали. Дякуємо що довірились. Якщо опублікуємо — побачиш на каналі.'
        );

        // Надсилаємо в модерацію мітку з роллю
        await ctx.telegram.sendMessage(
            MODERATION_CHAT_ID,
            `📩 Нова анонімка\n👤 Роль: ${role}`,
            Markup.inlineKeyboard([
                [Markup.button.callback('✅ Опублікувати як є', `approve_${ctx.message.message_id}`)],
                [Markup.button.callback('✏️ Відредагувати', `edit_${ctx.message.message_id}`)],
                [Markup.button.callback('🔍 Потрібна конкретика', `ask_more_${ctx.from.id}`)],
                [Markup.button.callback('❌ Не публікувати', `reject_${ctx.message.message_id}`)],
            ])
        );

        // Пересилаємо саме повідомлення
        await ctx.copyMessage(MODERATION_CHAT_ID);

    } catch (error) {
        console.error('Помилка при пересиланні:', error);
        ctx.reply('Щось пішло не так. Спробуй ще раз трохи пізніше.');
    }
});

// Редакційний фільтр — запит конкретики
bot.action(/^ask_more_(\d+)$/, async (ctx) => {
    const userId = ctx.match[1];
    await ctx.answerCbQuery('Запит відправлено автору');
    await ctx.telegram.sendMessage(
        userId,
        'Історія цікава, але не вистачає деталі яка дозволить читачу впізнати ситуацію. Спробуй додати конкретний момент: що саме сталось, яка реакція, що здивувало. Без імен — просто деталь.'
    );
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.telegram.sendMessage(MODERATION_CHAT_ID, '🔍 Автору надіслано запит на конкретику');
});

// Відхилення
bot.action(/^reject_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Не публікуємо');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.telegram.sendMessage(MODERATION_CHAT_ID, '❌ Анонімку відхилено');
});

// Підтвердження (заглушка — публікацію реалізуєш окремо через API каналу)
bot.action(/^approve_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Позначено до публікації');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.telegram.sendMessage(MODERATION_CHAT_ID, '✅ Позначено до публікації — копіюй у канал');
});

bot.action(/^edit_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.telegram.sendMessage(MODERATION_CHAT_ID, '✏️ Відредагуй текст і опублікуй вручну');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
});

bot.launch().then(() => console.log('Бот запущений'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));