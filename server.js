// server.js
const express = require('express');
const dotenv = require('dotenv').config();
const OpenAI = require('openai');
const bodyParser = require('body-parser');
const cors = require('cors');
const { marked } = require('marked');

const app = express();
const port = process.env.PORT || 3000;


app.use(cors({
  origin: 'https://ki.buron.de', // Ersetzen Sie dies mit der tatsächlichen Domain Ihrer Webseite
  methods: ['GET', 'POST'], // Erlaubte Methoden
  allowedHeaders: ['Content-Type'], // Erlaubte Header
}));
app.use(express.static('public'));

// Middleware to parse JSON bodies
app.use(bodyParser.json());

app.get('/', (req, res) => {
  res.send('Buron Bot is running!');
});
// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Route to handle questions
app.post('/ask', async (req, res) => {
  const { question, threadId: clientThreadId } = req.body;
  let threadId = clientThreadId;

  try {
    if (!threadId) {
      // If no threadId is provided, create a new thread
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
    }

    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: question,
    });

    const run = await openai.beta.threads.runs.create(threadId, { assistant_id: process.env.ASSISTANT_ID });

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
    res.json({ answer: markDownContent, threadId }); // Return the used or new threadId to the client
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred.");
  }
});

app.listen(port, () => {
  console.log(`Server running at :${port}`);
});