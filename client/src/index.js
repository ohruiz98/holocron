import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { exec } from 'child_process';

const app = express();
const PORT = 5001;
let modelName = 'llama3.2:1b';
let modelIsRunning = 0;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());

// Route to handle chat requests
app.post('/api/chat', async (req, res) => {
  const { prompt, model } = req.body;
  modelIsRunning = 1;
  modelName = model;
  try {
    // For validation purposes
    console.log(`Running model ${modelName}`)
    // Make a POST request to the Ollama server
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: modelName,
      prompt: prompt,
    });

    // Extract the response text from Ollama's response
    const generatedText = response.data.split('\n')
    .filter((element) => element !== '')
    .map((jsonStr) => JSON.parse(jsonStr))
    .map((json) => json.response)
    .join('');
    //combinedResponses;

    res.json({ response: generatedText });
  } catch (error) {
    console.error('Error communicating with Ollama:', error.message);
    res.status(500).json({ error: 'An error occurred while communicating with Ollama.' });
  }
});

// Reset Ollama model endpoint
app.post('/api/reset-model', async (req, res) => {
  try {
    if (modelIsRunning === 1) {
      await axios.post('http://localhost:11434/api/generate', {
        model: modelName,
        prompt: '',
        keep_alive: 0 // Unload the model immediately
      });
      res.json({ message: `Model ${modelName} has been reset and unloaded.` });
    } else {
      res.json({ message: `Model ${modelName} is not running.` });
    }
  } catch (error) {
    console.error('Error resetting the model:', error);
    res.status(500).json({ error: 'An error occurred while resetting the Ollama model.' });
  }
});

// Endpoint to check and download the model if it's missing
app.post('/api/check-model', (req, res) => {
  const modelName = req.body.modelValue;
  modelIsRunning = 1;

  // Command to list available models
  exec('ollama list', (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: 'Error listing models ' + stderr});
    }

    if (stdout.includes(modelName)) {
      return res.json({ status: 'available', message: `Model ${modelName} is already available.` });
    }

    exec(`ollama pull ${modelName}`, (pullErr) => {
      if (pullErr) {
        return res.status(500).json({ error: 'Error downloading model'});
      }
    });

    res.json({ status: 'downloading', message: `Downloading model ${modelName}...` });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});