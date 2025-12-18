import cron from 'node-cron';
import { syncService } from '../services/syncService';

export function startScheduler() {
  // Sync players every day at 3 AM
  cron.schedule('0 3 * * *', async () => {
    console.log('Running scheduled player sync...');
    try {
      await syncService.syncPlayers();
    } catch (error) {
      console.error('Scheduled player sync failed:', error);
    }
  });

  // Sync weekly stats every Tuesday at 4 AM (after Monday night games)
  cron.schedule('0 4 * * 2', async () => {
    console.log('Running scheduled weekly stats sync...');
    try {
      const currentSeason = new Date().getFullYear();
      const currentWeek = getCurrentWeek();
      await syncService.syncWeeklyStats(currentSeason, currentWeek);
    } catch (error) {
      console.error('Scheduled stats sync failed:', error);
    }
  });

  console.log('Schedulers started');
}

// Helper to determine current NFL week (simplified)
function getCurrentWeek(): number {
  const now = new Date();
  const seasonStart = new Date(now.getFullYear(), 8, 5); // Sept 5
  const diffTime = Math.abs(now.getTime() - seasonStart.getTime());
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  return Math.min(diffWeeks, 18); // Cap at week 18
}