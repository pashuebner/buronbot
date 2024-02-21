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
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if the origin ends with 'buron.de'
    if (origin.endsWith('.buron.de')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'], // Allowed methods
  allowedHeaders: ['Content-Type'], // Allowed headers
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
let existingThread;
// Route to handle questions
app.post('/ask', async (req, res) => {
  const { question } = req.body;

  try {
    const assistant = await openai.beta.assistants.retrieve('asst_MaxQ5GBsUv7U8FRHISngVC2x');
    let thread;
    if(!existingThread){
     thread = await openai.beta.threads.create(); 
     existingThread = thread.id;
    }
    
    await openai.beta.threads.messages.create(existingThread, {
      role: "user",
      content: question,
    });

    const run = await openai.beta.threads.runs.create(existingThread, { assistant_id: assistant.id });

    // Simplified for demonstration; consider implementing proper polling/waiting mechanism
    let runStatus = await openai.beta.threads.runs.retrieve(existingThread, run.id);
    while (runStatus.status !== "completed") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      runStatus = await openai.beta.threads.runs.retrieve(existingThread, run.id);
    }

    const messages = await openai.beta.threads.messages.list(existingThread);
    const lastMessageForRun = messages.data.filter(message => message.run_id === run.id && message.role === "assistant").pop();
    let lastMessageToConvert = lastMessageForRun.content[0].text.value;
    let markDownContent = marked(lastMessageToConvert);
    console.log(markDownContent);
    console.log(existingThread);
    res.json({ answer: lastMessageForRun ? markDownContent : "Sorry, I couldn't find an answer." });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred.");
  }
});

app.listen(port, () => {
  console.log(`Server running at :${port}`);
});
