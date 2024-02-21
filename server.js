const express = require('express');
const session = require('express-session');
const dotenv = require('dotenv').config();
const OpenAI = require('openai');
const bodyParser = require('body-parser');
const cors = require('cors');
const { marked } = require('marked');

const app = express();
const port = process.env.PORT || 3000;

// Session configuration
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));

app.use(cors({
  origin: 'https://ki.buron.de',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.static('public'));
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Buron Bot is running!');
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/ask', async (req, res) => {
  const { question } = req.body;
  let threadId = req.session.threadId;

  try {
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      req.session.threadId = thread.id;
      threadId = thread.id;
    }

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: question,
    });

    const run = await openai.beta.threads.runs.create(threadId, { assistant_id: process.env.ASSISTANT_ID });

    // Simplified for demonstration; consider implementing proper polling/waiting mechanism
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    while (runStatus.status !== "completed") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }

    const messages = await openai.beta.threads.messages.list(threadId);
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
  console.log(`Server running at :${port}`);
});
