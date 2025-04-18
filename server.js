const express = require("express");
const fetch = require("node-fetch");
const bodyParser = require("body-parser");
const fs = require("fs");

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GPT_MODEL = "gpt-4o-mini";
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const lectures = fs.readFileSync("lifshitz_lectures_node.txt", "utf8")
  .split("---")
  .map(s => s.trim())
  .filter(Boolean);

function generatePrompt(userInput) {
  const context = lectures.slice(0, 4).join("\n");
  return `Ты Михаил Лифшиц. Ответь на сообщение строго, с иронией, философски, используя следующие тезисы:\n${context}\n\nВопрос: ${userInput}`;
}

async function askOpenAI(prompt) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: GPT_MODEL,
      messages: [
        { role: "system", content: "Ты философ Михаил Лифшиц." },
        { role: "user", content: prompt }
      ]
    })
  });

  const data = await res.json();

  if (data.error) {
    console.error("❌ Ошибка от OpenAI:", data.error);
    return "Произошла ошибка на стороне ИИ.";
  }

  return data.choices?.[0]?.message?.content || "ИИ не дал ответ.";
}

app.post(`/webhook/${TELEGRAM_TOKEN}`, async (req, res) => {
  console.log("📩 Входящий запрос от Telegram:", JSON.stringify(req.body));

  const message = req.body.message;
  if (!message || !message.text) return res.sendStatus(200);

  const chatId = message.chat.id;
  const userText = message.text;

  try {
    const prompt = generatePrompt(userText);
    const reply = await askOpenAI(prompt);

    console.log("✍️ Ответ от ИИ:", reply);

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: reply })
    });

    console.log("✅ Ответ отправлен Telegram");

  } catch (err) {
    console.error("💥 Ошибка обработки сообщения:", err);
  }

  res.sendStatus(200);
});

app.get("/", (req, res) => res.send("Лифшиц в деле. Телеграм-бот готов."));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Lifshitz bot is live on port " + PORT));