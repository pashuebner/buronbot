const express = require('express');
const dotenv = require('dotenv').config();
const OpenAI = require('openai');
const bodyParser = require('body-parser');
const cors = require('cors');
const { marked } = require('marked');
const axios = require('axios');
const cheerio = require('cheerio');

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

app.get('/', (req, res) => {
  res.send('Buron Bot is running!');
});

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Route to handle questions
app.post('/ask', async (req, res) => {
  const { question, threadId, cat } = req.body;
  let asking = question;
  try {
    const assistant = await openai.beta.assistants.retrieve('asst_MaxQ5GBsUv7U8FRHISngVC2x');
    let category = cat;
    let currentThreadId = threadId;
    if (!currentThreadId) {
      const thread = await openai.beta.threads.create();
      currentThreadId = thread.id;
    }
    if(category){
      asking = question+', Suche im Bereich: '+cat;
    }

    await openai.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: asking,
    });

    const run = await openai.beta.threads.runs.create(currentThreadId, { assistant_id: assistant.id });

    let runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
    while (runStatus.status !== "completed") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
    }

    const messages = await openai.beta.threads.messages.list(currentThreadId);
    const lastMessageForRun = messages.data.filter(message => message.run_id === run.id && message.role === "assistant").pop();

    if (!lastMessageForRun.content[0].text.annotations || lastMessageForRun.content[0].text.annotations.length === 0) {
      // Immediately send back the informational message
      let informationalMessage = lastMessageForRun.content[0].text.value;
      res.json({ infoMessage: informationalMessage, followUpNeeded: true, threadId: currentThreadId });
    } else {
      let markDownContent = marked(lastMessageForRun.content[0].text.value);
      res.json({ answer: markDownContent, followUpNeeded: false, threadId: currentThreadId });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred.");
  }
});

app.post('/scrape', async (req, res) => {
const url = req.body.question;
let sitetext;
  try {

    await axios.get(url)
      .then(response => {
        const html = response.data;
        const $ = cheerio.load(html);
        const targetElement = $('#ctl00_contentpane .content-block');
        sitetext = targetElement.text();
        console.log(sitetext);
      })
  .catch(console.error);

  let asking = "Verwende diesen HTML Abschnitt und erstelle eine Tabelle mit den hier enthaltenen Informationen: "+sitetext;
  console.log(asking);



    const assistant = await openai.beta.assistants.retrieve('asst_MaxQ5GBsUv7U8FRHISngVC2x');
    const thread = await openai.beta.threads.create();
    currentThreadId = thread.id;
    await openai.beta.threads.messages.create(currentThreadId, {
      role: "user",
      content: asking,
    });
    const run = await openai.beta.threads.runs.create(currentThreadId, { assistant_id: assistant.id });
    let runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
    while (runStatus.status !== "completed") {
      await new Promise(resolve => setTimeout(resolve, 2000));
      runStatus = await openai.beta.threads.runs.retrieve(currentThreadId, run.id);
    }
    const messages = await openai.beta.threads.messages.list(currentThreadId);
    const lastMessageForRun = messages.data.filter(message => message.run_id === run.id && message.role === "assistant").pop();
    if (!lastMessageForRun.content[0].text.annotations || lastMessageForRun.content[0].text.annotations.length === 0) {
      // Immediately send back the informational message
      let informationalMessage = lastMessageForRun.content[0].text.value;
      res.json({ infoMessage: informationalMessage, followUpNeeded: true, threadId: currentThreadId });
    } else {
      let markDownContent = marked(lastMessageForRun.content[0].text.value);
      res.json({ answer: markDownContent, followUpNeeded: false, threadId: currentThreadId });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred.");
  }



})


app.listen(port, () => {
  console.log(`Server running at :${port}`);
});
