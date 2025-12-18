import Player from '../models/Player';
import WeeklyStat from '../models/WeeklyStat';
import { sleeperApi } from './sleeperApi';

export const syncService = {
  // Sync all players from Sleeper API
  async syncPlayers() {
    console.log('Starting player sync...');
    
    try {
      const playersData = await sleeperApi.getAllPlayers();
      
      const players = Object.entries(playersData).map(([id, data]: [string, any]) => ({
        player_id: id,
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        full_name: data.full_name || `${data.first_name} ${data.last_name}`,
        position: data.position || '',
        team: data.team || null,
        status: data.status || 'Inactive',
        fantasy_positions: data.fantasy_positions || [],
        updatedAt: new Date()
      }));

      // Bulk upsert
      const bulkOps = players.map(player => ({
        updateOne: {
          filter: { player_id: player.player_id },
          update: { $set: player },
          upsert: true
        }
      }));

      const result = await Player.bulkWrite(bulkOps);
      console.log(`Player sync complete: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
      
      return result;
    } catch (error) {
      console.error('Error syncing players:', error);
      throw error;
    }
  },

  // Sync weekly stats for a specific week
  async syncWeeklyStats(season: number, week: number) {
    console.log(`Starting stats sync for ${season} Week ${week}...`);
    
    try {
      const statsData = await sleeperApi.getStatsForWeek(season, week);
      
      const stats = Object.entries(statsData).map(([playerId, data]: [string, any]) => ({
        player_id: playerId,
        season,
        week,
        points: data.pts_ppr || data.pts_half_ppr || data.pts_std || 0,
        stats: data,
        updatedAt: new Date()
      }));

      const bulkOps = stats.map(stat => ({
        updateOne: {
          filter: { player_id: stat.player_id, season: stat.season, week: stat.week },
          update: { $set: stat },
          upsert: true
        }
      }));

      const result = await WeeklyStat.bulkWrite(bulkOps);
      console.log(`Stats sync complete: ${result.upsertedCount} new, ${result.modifiedCount} updated`);
      
      return result;
    } catch (error) {
      console.error(`Error syncing stats for week ${week}:`, error);
      throw error;
    }
  },

  // Sync multiple weeks at once
  async syncMultipleWeeks(season: number, startWeek: number, endWeek: number) {
    console.log(`Syncing weeks ${startWeek} to ${endWeek} for season ${season}`);
    
    for (let week = startWeek; week <= endWeek; week++) {
      await this.syncWeeklyStats(season, week);
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Multi-week sync complete');
  }
};