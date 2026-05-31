require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.BOT_TOKEN);
const MODERATION_CHAT_ID = process.env.MODERATION_CHAT_ID;
const PORT = process.env.PORT || 3000;
const URL = process.env.RENDER_EXTERNAL_URL; // Render видає це автоматично

// Збереження ролей у файл (щоб дані не зникали, коли Render засинає)
const ROLES_FILE = path.join(__dirname, 'roles.json');

function saveRole(userId, role) {
    let data = {};
    if (fs.existsSync(ROLES_FILE)) {
        try { data = JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8')); } catch (e) { data = {}; }
    }
    data[userId] = role;
    fs.writeFileSync(ROLES_FILE, JSON.stringify(data, null, 2));
}

function getRole(userId) {
    if (!fs.existsSync(ROLES_FILE)) return 'Роль не вказана';
    try {
        const data = JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8'));
        return data[userId] || 'Роль не вказана';
    } catch (e) {
        return 'Роль не вказана';
    }
}

// Привітання
bot.start((ctx) => {
    ctx.reply(
        `Привіт. Тут можна виговоритись.\n\nЄ що розповісти про акселератор, інвестора, партнера або власний факап? Надсилай — це анонімно. Імена компаній, міста та будь-які деталі що можуть тебе ідентифікувати — прибираємо перед публікацією, якщо сам не попросиш залишити.\n\nСпочатку скажи хто ти:`,
        Markup.inlineKeyboard([
            [Markup.button.callback('Фаундер', 'r_founder')],
            [Markup.button.callback('Менеджер акселератора / хабу', 'r_acc')],
            [Markup.button.callback('Інвестор', 'r_investor')],
        ])
    );
});

// Обробка вибору ролі
bot.action(/^r_(.+)$/, async (ctx) => {
    const role = ctx.match[1];
    const labels = {
        founder: 'Фаундер',
        acc: 'Менеджер акселератора / хабу',
        investor: 'Інвестор',
    };

    saveRole(ctx.from.id, labels[role]);

    await ctx.answerCbQuery();
    await ctx.reply('Добре. Тепер напиши історію або надішли скріншот 👇');
});

// Обробка повідомлень
bot.on(['text', 'photo', 'video', 'animation'], async (ctx) => {
    const text = ctx.message.text || ctx.message.caption || '';
    if (text.startsWith('/')) return;

    const role = getRole(ctx.from.id);

    try {
        await ctx.reply('Отримали. Дякуємо що довірились. Якщо опублікуємо — побачиш на каналі.');

        await ctx.telegram.sendMessage(
            MODERATION_CHAT_ID,
            `📩 *Нова анонімка*\n👤 *Роль:* ${role}`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('✅ Опублікувати як є', `ok_${ctx.message.message_id}`)],
                    [Markup.button.callback('✏️ Відредагувати', `ed_${ctx.message.message_id}`)],
                    [Markup.button.callback('🔍 Потрібна конкретика', `ask_${ctx.from.id}`)],
                    [Markup.button.callback('❌ Не публікувати', `no_${ctx.message.message_id}`)],
                ])
            }
        );

        await ctx.copyMessage(MODERATION_CHAT_ID);

    } catch (error) {
        console.error('Помилка при пересиланні:', error);
        ctx.reply('Щось пішло не так. Спробуй ще раз трохи пізніше.');
    }
});

// Кнопки модерації
bot.action(/^ask_(\d+)$/, async (ctx) => {
    const userId = ctx.match[1];
    try {
        await ctx.telegram.sendMessage(
            userId,
            'Історія цікава, але не вистачає деталей, які дозволят читачу впізнати ситуацію. Спробуй додати конкретний момент: що саме сталось, яка реакція, що здивувало. Без імен — просто деталь.'
        );
        await ctx.answerCbQuery('Запит відправлено автору');
        await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
        await ctx.telegram.sendMessage(MODERATION_CHAT_ID, '🔍 Автору надіслано запит на конкретику');
    } catch (err) {
        await ctx.answerCbQuery('Не вдалося надіслати (бот заблоковано)');
    }
});

bot.action(/^no_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Не публікуємо');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.telegram.sendMessage(MODERATION_CHAT_ID, '❌ Анонімку відхилено');
});

bot.action(/^ok_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery('Позначено до публікації');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.telegram.sendMessage(MODERATION_CHAT_ID, '✅ Позначено до публікації — копіюй у канал');
});

bot.action(/^ed_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
    await ctx.telegram.sendMessage(MODERATION_CHAT_ID, '✏️ Відредагуй текст і опублікуй вручну');
});

// --- НАЛАШТУВАННЯ EXPRESS ДЛЯ WEBHOOKS ---
const app = express();
app.use(express.json()); // Обов'язково для парсингу JSON від Telegram

// Створюємо роут, куди Telegram штовхатиме оновлення
app.use(bot.webhookCallback(`/bot${process.env.BOT_TOKEN}`));

app.listen(PORT, async () => {
    console.log(`Сервер працює на порту ${PORT}`);

    // Встановлюємо Webhook у Telegram (працює тільки коли задеплоєно на Render)
    if (URL) {
        try {
            await bot.telegram.setWebhook(`${URL}/bot${process.env.BOT_TOKEN}`);
            console.log('Webhook успішно зареєстровано в Telegram!');
        } catch (e) {
            console.error('Не вдалося встановити Webhook:', e);
        }
    } else {
        console.log('RENDER_EXTERNAL_URL не знайдено. Локальний запуск (використовуй Polling для тесту)');
        // Якщо запускаєш локально для тесту, можна розкоментувати рядок нижче:
        // bot.launch();
    }
});

// М'яке завершення роботи
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));