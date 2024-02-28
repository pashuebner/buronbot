const express = require('express');
const dotenv = require('dotenv').config();
const OpenAI = require('openai');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const { marked } = require('marked');

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = ['https://bb-web.onrender.com/', 'https://bb-web.onrender.com', 'https://ki.buron.de', 'https://www.ki.buron.de', 'https://ki.buron.de/', 'https://www.ki.buron.de/'];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin 
    // (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));



app.use(express.static('public'));
app.use(bodyParser.json());


// Configure session middleware
app.use(session({
  secret: process.env.SESSION_SECRET, // Use a strong secret key
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: true,
    httpOnly: true, // Prevents client-side JS from accessing the cookie
    maxAge: 24 * 60 * 60 * 1000, // Sets a max age for the session cookie (e.g., 1 day)
    domain: '.onrender.com',
    sameSite: 'None',
  }
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
  const { question, threadId } = req.body; // Extract threadId from the request

  try {
    const assistant = await openai.beta.assistants.retrieve('asst_MaxQ5GBsUv7U8FRHISngVC2x');

    let currentThreadId = threadId;
    // Use provided threadId or create a new one
    if (!currentThreadId) {
      const thread = await openai.beta.threads.create();
      currentThreadId = thread.id; // Use the new thread ID
    }
    console.log(`Current Thread ID: ${currentThreadId}`);
    
    await openai.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: question,
    });

    const run = await openai.beta.threads.runs.create(currentThreadId, { assistant_id: assistant.id });

    let runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
    while (runStatus.status !== "completed") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
    }

    // Initialize variables for handling follow-ups
    let finalAnswer = '';
    let attempts = 0;
    const maxAttempts = 5; // Maximum number of follow-up checks

    do {
      // Fetch all messages in the thread
      const messages = await openai.beta.threads.messages.list(currentThreadId);
      const newMessages = messages.data.filter(message => message.run_id === run.id && message.role === "assistant");

      // Append new assistant messages to finalAnswer
      newMessages.forEach(message => {
        finalAnswer += marked(message.content[0].text.value) + "\n";
      });

      if (newMessages.length === 0 || attempts >= maxAttempts - 1) {
        // Exit loop if no new messages or max attempts reached
        break;
      } else {
        // Wait before next check for new messages
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
    } while (true);

    console.log(`Final Answer: ${finalAnswer}`);
    res.json({ answer: finalAnswer || "Entschuldigung, ich konnte nichts finden.", threadId: currentThreadId });
  } catch (error) {
    console.error(`An error occurred: ${error}`);
    res.status(500).send("An error occurred.");
  }
});

app.listen(port, () => {
  console.log(`Server running at :${port}`);
});
