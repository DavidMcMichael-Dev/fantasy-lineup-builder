import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { startScheduler } from './jobs/scheduler';
import { syncService } from './services/syncService';
import Player from './models/Player';
import WeeklyStat from './models/WeeklyStat';
import cors from 'cors';

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Database connection
mongoose
  .connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('Connected to MongoDB');
    startScheduler();
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });


// Update CORS to allow your frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Use Railway's PORT or default to 5000
const PORT = process.env.PORT || 5000;

// API Routes
app.get('/api/players', async (req, res) => {
  try {
    const { position, team, search } = req.query;
    const filter: any = {};
    
    // Only include fantasy-relevant positions
    filter.position = { 
      $in: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] 
    };
    
    if (position) filter.position = position;
    if (team) filter.team = team;
    if (search) {
      filter.full_name = { $regex: search, $options: 'i' };
    }
    
    // Sort: Active first (ascending puts Active before Inactive), then alphabetically by name
    const players = await Player.find(filter).sort({ status: 1, full_name: 1 });
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Check if stats exist for a week
app.get('/api/stats/exists/:season/:week', async (req, res) => {
  try {
    const { season, week } = req.params;
    const count = await WeeklyStat.countDocuments({
      season: parseInt(season),
      week: parseInt(week)
    });
    res.json({ exists: count > 0, count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check stats' });
  }
});

app.get('/', async (req, res) => {
  res.send('Lineup Builder API is running');
});

app.get('/api/stats/:playerId/:season/:week', async (req, res) => {
  try {
    const { playerId, season, week } = req.params;
    const stats = await WeeklyStat.findOne({
      player_id: playerId,
      season: parseInt(season),
      week: parseInt(week)
    });
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get stats for multiple players in a single week
app.post('/api/lineup/calculate', async (req, res) => {
  try {
    const { playerIds, season, week } = req.body;
    
    const stats = await WeeklyStat.find({
      player_id: { $in: playerIds },
      season,
      week
    });
    
    const totalPoints = stats.reduce((sum, stat) => sum + stat.points, 0);
    
    res.json({
      stats,
      totalPoints,
      playerCount: stats.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate lineup' });
  }
});

// Manual sync endpoints
app.post('/api/sync/players', async (req, res) => {
  try {
    const result = await syncService.syncPlayers();
    res.json({ message: 'Players synced successfully', result });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

app.post('/api/sync/stats/:season/:week', async (req, res) => {
  try {
    const { season, week } = req.params;
    const result = await syncService.syncWeeklyStats(
      parseInt(season),
      parseInt(week)
    );
    res.json({ message: 'Stats synced successfully', result });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Get player counts
app.get('/api/players/count', async (req, res) => {
  try {
    const total = await Player.countDocuments();
    const active = await Player.countDocuments({ status: 'Active' });
    res.json({ total, active });
  } catch (error) {
    res.status(500).json({ error: 'Failed to count players' });
  }
});

app.get('/api/players/search/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const players = await Player.find({
      full_name: { $regex: name, $options: 'i' }
    });
    res.json(players);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

app.get('/api/players/defenses', async (req, res) => {
  try {
    const defs = await Player.find({ position: 'DEF' });
    res.json({ count: defs.length, defenses: defs });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/api/test/team/:team', async (req, res) => {
  try {
    const { team } = req.params;
    const players = await Player.find({ team: team });
    res.json({ count: players.length, players: players.slice(0, 5) });
  } catch (error) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});