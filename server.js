const express = require('express');
const dotenv = require('dotenv').config();
const OpenAI = require('openai');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const { marked } = require('marked');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: 'https://ki.buron.de',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true // Allow credentials
}));


app.use(express.static('public'));
app.use(bodyParser.json());

// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET, // Use a strong secret key
  resave: false,
  saveUninitialized: true,
  cookie: { 
    sameSite: 'none',
    secure: true,
    httpOnly: true, // Prevents client-side JS from accessing the cookie
    maxAge: 24 * 60 * 60 * 1000 // Sets a max age for the session cookie (e.g., 1 day)
  } // Set secure to true if using HTTPS
}));

app.get('/', (req, res) => {
  res.send('Buron Bot is running!');
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Route to handle questions
app.post('/ask', async (req, res) => {
  console.log('Session ID:', req.sessionID);
  const { question } = req.body;

  try {
    const assistant = await openai.beta.assistants.retrieve('asst_MaxQ5GBsUv7U8FRHISngVC2x');
    
    // Use session to manage user's thread ID
    if (!req.session.threadId) {
      const thread = await openai.beta.threads.create();
      req.session.threadId = thread.id; // Store the new thread ID in the session
    }
    
    await openai.beta.threads.messages.create(req.session.threadId, {
      role: "user",
      content: question,
    });

    const run = await openai.beta.threads.runs.create(req.session.threadId, { assistant_id: assistant.id });

    let runStatus = await openai.beta.threads.runs.retrieve(req.session.threadId, run.id);
    while (runStatus.status !== "completed") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      runStatus = await openai.beta.threads.runs.retrieve(req.session.threadId, run.id);
    }

    const messages = await openai.beta.threads.messages.list(req.session.threadId);
    const lastMessageForRun = messages.data.filter(message => message.run_id === run.id && message.role === "assistant").pop();
    let lastMessageToConvert = lastMessageForRun.content[0].text.value;
    let markDownContent = marked(lastMessageToConvert);
    console.log(markDownContent);
    console.log(req.session.threadId);
    res.json({ answer: lastMessageForRun ? markDownContent : "Sorry, I couldn't find an answer." });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred.");
  }
});

app.listen(port, () => {
  console.log(`Server running at :${port}`);
});
