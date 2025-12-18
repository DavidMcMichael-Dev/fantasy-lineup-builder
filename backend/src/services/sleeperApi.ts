import axios from 'axios';

const SLEEPER_BASE_URL = 'https://api.sleeper.app/v1';

export const sleeperApi = {
  // Get all NFL players
  async getAllPlayers() {
    const response = await axios.get(`${SLEEPER_BASE_URL}/players/nfl`);
    return response.data;
  },

  // Get stats for a specific week
  async getStatsForWeek(season: number, week: number) {
    const response = await axios.get(
      `${SLEEPER_BASE_URL}/stats/nfl/regular/${season}/${week}`
    );
    return response.data;
  },

  // Get projections for a week (optional)
  async getProjectionsForWeek(season: number, week: number) {
    const response = await axios.get(
      `${SLEEPER_BASE_URL}/projections/nfl/regular/${season}/${week}`
    );
    return response.data;
  }
};