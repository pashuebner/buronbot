// server.js
const express = require('express');
const dotenv = require('dotenv').config();
const OpenAI = require('openai');
const bodyParser = require('body-parser');
const cors = require('cors');
const { marked } = require('marked');

const app = express();
const port = process.env.PORT || 10000;


app.use(cors({
  origin: 'https://buronbot.onrender.com', // Ersetzen Sie dies mit der tatsächlichen Domain Ihrer Webseite
  methods: ['GET', 'POST'], // Erlaubte Methoden
  allowedHeaders: ['Content-Type'], // Erlaubte Header
}));
app.use(express.static('public'));

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Route to handle questions
app.post('/ask', async (req, res) => {
  const { question } = req.body;

  try {
    const assistant = await openai.beta.assistants.retrieve('asst_MaxQ5GBsUv7U8FRHISngVC2x');
    const thread = await openai.beta.threads.create();

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: question,
    });

    const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistant.id });

    // Simplified for demonstration; consider implementing proper polling/waiting mechanism
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    while (runStatus.status !== "completed") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    }

    const messages = await openai.beta.threads.messages.list(thread.id);
    const lastMessageForRun = messages.data.filter(message => message.run_id === run.id && message.role === "assistant").pop();
    let lastMessageToConvert = lastMessageForRun.content[0].text.value;
    let markDownContent = marked(lastMessageToConvert);
    console.log(markDownContent);
    res.json({ answer: lastMessageForRun ? markDownContent : "Sorry, I couldn't find an answer." });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred.");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
