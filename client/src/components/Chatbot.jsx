import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Chatbot.css';
import { getPokemon } from '../services/pokemonApi';
import placeholderImage from '../assets/International_Pokémon_logo.svg.png';

// TODO: Refactor to use useState or useRef for better state management
// System prompt to be used when asking questions about data within Topics
const prompt = `You are a concise and accurate assistant that strictly cites information from the provided text. You are only allowed to use the information found within the text. Always include the name of the Pokemon in your response. If a URL is present in the text, restate it fully. Never reference information outside the provided text.

If the text does not contain the answer to the query, respond with: "I don't have any more information on this topic. Please try another topic/query!" and end the statement.

---

**Text Data:**
`;

const Chatbot = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { sender: 'system', text: 'Welcome! Please only list the name of the pokemon you want to learn more about. To change the current pokemon selection please type: RESET' }
  ]);
  // Current Pokemon Data
  const globalPokemonData = useRef(null);
  // Global state
  const state = useRef(0);
  const currentPokemon = useRef(null);
  // Current Topics to choose from
  const attributes = useRef(null);
  // Current Topic
  const topic = useRef(null);

  const [pokemonImage, setPokemonImage] = useState(null);
  const [selectedModel, setSelectedModel] = useState('llama3.2:1b');
  const [loadingModel, setLoadingModel] = useState(false);
  // Ref to track the initial render
  const isInitialMount = useRef(true);

  // Create a ref for the chatbox container
  const chatboxRef = useRef(null);

  // Scroll to the bottom whenever messages change
  useEffect(() => {
    if (chatboxRef.current) {
      chatboxRef.current.scrollTop = chatboxRef.current.scrollHeight;
    }
    if (isInitialMount.current) {
      handleModelChange(selectedModel);
      isInitialMount.current = false;
    }
  }, [messages]);

  // Function to reset Pokemon
  const handlePokemonReset = async () => {
    if (currentPokemon.current != null) {
      setPokemonImage(placeholderImage);
      const systemMessage = { sender: 'system', text: 'Your selection has been RESET! Please enter the name of another pokemon you want to explore.' };
      globalPokemonData.current = null;
      currentPokemon.current= null;
      attributes.current = null;
      topic.current = null;
      state.current = 0;
      try {
        await axios.post('http://localhost:5001/api/reset-model', {});
      } catch (error) {
        setMessages((prevMessages) => [...prevMessages, { sender: 'system', text: 'Error resetting the model' + error }]);
      }
      setMessages((prevMessages) => [...prevMessages, systemMessage]);
    }
  };

  // Function to reset Topic
  const handleTopicReset = async () => {
    if (state.current === 2) {
      const anotherSystemMessage = { sender: 'system', text: `Topic choice RESET. Please choose another topic to search: ${attributes.current.join(", ")}` };
      setMessages((prevMessages) => [...prevMessages, anotherSystemMessage]);
      topic.current = null;
      state.current = 1
    }
  };

  // Function to check and download the model
  const handleModelChange = async (e) => {
    const modelValue = typeof e === 'string' ? e : e.target.value;
    setSelectedModel(modelValue);
    setLoadingModel(true);
    setMessages((prevMessages) => [
      ...prevMessages,
      { sender: 'system', text: `Checking availability of model: ${modelValue}...` },
    ]);
  
    try {
      const checkStatus = async () => {
        const response = await axios.post('http://localhost:5001/api/check-model', { modelValue });
  
        if (response.data.status === 'available') {
          setMessages((prevMessages) => [
            ...prevMessages,
            { sender: 'system', text: `Model ${modelValue} is ready.` },
          ]);
          setLoadingModel(false);
        } else if (response.data.status === 'downloading') {
          setMessages((prevMessages) => {
            const lastMsg = prevMessages[prevMessages.length - 1]?.text;
            if (lastMsg !== response.data.message) {
              return [...prevMessages, { sender: 'system', text: response.data.message }];
            }
            return prevMessages;
          });
          // Poll the server again after 3 seconds
          setTimeout(checkStatus, 3000);
        }
      };
  
      // Initial status check
      await checkStatus();
    } catch (error) {
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: 'system', text: 'Error downloading the model. Please try again.' + error },
      ]);
      setLoadingModel(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;


    const userMessage = { sender: 'user', text: input };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput('');

    try {
      if (input === 'RESET') {
        handlePokemonReset();
      } else if (input == "TOPIC" & state.current != 1) {
        handleTopicReset();
      } else if (state.current === 0) {
        const data = await getPokemon(input.toLowerCase());
        const systemMessage = { sender: 'system', text: `We found your pokemon: ${input}!`  };
        setMessages((prevMessages) => [...prevMessages, systemMessage]);
        attributes.current = Object.keys(data)
        globalPokemonData.current = data;
        currentPokemon.current = input.toLowerCase();
        // Set the Pokemon image URL
        setPokemonImage(data.sprites.front_default);
        const anotherSystemMessage = { sender: 'system', text: `Please choose from these topics to search: ${attributes.current.join(", ")}` };
        setMessages((prevMessages) => [...prevMessages, anotherSystemMessage]);
        state.current = 1;
      } else if (state.current === 1){
        if (attributes.current.includes(input.toLowerCase())) {
          const systemMessage = { sender: 'system', text: `You have chosen: ${input}! Feel free to ask questions about that topic. To switch topic type: TOPIC` };
          setMessages((prevMessages) => [...prevMessages, systemMessage]);
          topic.current = input
          state.current = 2;
        } else {
          const systemMessage = { sender: 'system', text: `You have chosen: ${input}, this is invalid, please choose from: ${attributes.current.join(", ")}` };
          setMessages((prevMessages) => [...prevMessages, systemMessage]);
        }
      } else if (state.current === 2) {
        // Data that api returns for viewing purposes
        console.log(globalPokemonData)
        const additionalPrompt = `{"${topic.current}": ${JSON.stringify(globalPokemonData.current[topic.current])}}\n\n**Current Pokemon:** ${currentPokemon.current}\n\n**Query:** ${input}`
        const finalPrompt = prompt + additionalPrompt;
        // Prompt that feeds into model for viewing purposes
        console.log(finalPrompt)
        setLoadingModel(true);
        const response = await axios.post('http://localhost:5001/api/chat', {
          prompt: finalPrompt,
          model: selectedModel
        });
        setLoadingModel(false);
        const botMessage = { sender: 'bot', text: response.data.response };
        setMessages((prevMessages) => [...prevMessages, botMessage]);
      }
    } catch (error) {
      console.error(error)
      let errorText = ''
      if (error.message ===  'Error fetching data: Request failed with status code 404') {
        errorText = 'You selected an invalid pokemon, please try again!';
      } else {
        errorText = 'An error occurred. Please try again later.';
      }
      const errorMessage = { sender: 'bot', text: errorText};
      setMessages((prevMessages) => [...prevMessages, errorMessage]);
    }
  };

  return (
    <div className="chatbot-container">
      <h2 className="chatbot-header">Pokémon GPT (based on PokéAPI)</h2>
      <div className="pokemon-image-container">
        <img 
          src={pokemonImage || placeholderImage} 
          alt="Pokemon" 
          className="pokemon-image" 
        />
      </div>
        <select value={selectedModel} onChange={handleModelChange} className="model-selector" disabled={loadingModel}>
            <option value="mistral:7b">mistral 7B</option>
            <option value="llama3.1:8b">llama 3.1 8B</option>
            <option value="llama3.2:1b">llama 3.2 1B</option>
            <option value="llama3.2:3b">llama 3.2 3B</option>
        </select>
      <div className="chatbox" ref={chatboxRef}>
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.sender === 'user' ? 'user-message' : 'bot-message'}`}
          >
            {msg.text}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit} className="chatbot-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          className="chatbot-input"
          disabled={loadingModel}
        />
        <button type="submit" className="chatbot-button">
          Send
        </button>
      </form>
      <div className="pokemon-button-container" disabled={loadingModel}>
        <button onClick={handlePokemonReset} className="reset-button" disabled={loadingModel}>
          Reset Pokemon
        </button>
        <button onClick={handleTopicReset} className="reset-button" disabled={loadingModel}>
          Reset Topic
        </button>
      </div>
    </div>
  );
};

export default Chatbot;