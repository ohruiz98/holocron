import axios from 'axios';

const BASE_URL = 'https://pokeapi.co/api/v2';

// Fetch a specific Pokémon by name or ID
export const getPokemon = async (nameOrId) => {
  try {
    const response = await axios.get(`${BASE_URL}/pokemon/${nameOrId}`);
    return response.data;
  } catch (error) {
    throw new Error(`Error fetching data: ${error.message}`);
  }
};
