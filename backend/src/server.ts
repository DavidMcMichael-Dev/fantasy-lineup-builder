import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { startScheduler } from './jobs/scheduler';
import { syncService } from './services/syncService';
import Player from './models/Player';
import WeeklyStat from './models/WeeklyStat';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import GameSession from './models/GameSession';



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

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
  }
});

// Game session endpoints
app.post('/api/game/create', async (req, res) => {
  try {
    const { playerName } = req.body;
    
    const gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const playerId = Date.now().toString();
    
    // Random week between 2023 Week 1 and 2024 Week 18 (2025 season hasn't happened yet)
    const seasons = [2023, 2024, 2025];
    const randomSeason = seasons[Math.floor(Math.random() * seasons.length)];
    const maxWeek = randomSeason === 2025 ? 14 : 18; // Current week for 2024, full season for 2023
    const randomWeek = Math.floor(Math.random() * maxWeek) + 1;
    
    const session = await GameSession.create({
      gameCode,
      season: randomSeason,
      week: randomWeek,
      players: [{
        id: playerId,
        name: playerName,
        lineup: [],
        ready: false
      }],
      pickedPlayers: [],
      status: 'waiting'
    });
    
    res.json({ gameCode, playerId, season: randomSeason, week: randomWeek });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create game' });
  }
});

app.post('/api/game/join', async (req, res) => {
  try {
    const { gameCode, playerName } = req.body;
    
    const session = await GameSession.findOne({ gameCode });
    
    if (!session) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    if (session.players.length >= 2) {
      return res.status(400).json({ error: 'Game is full' });
    }
    
    if (session.status !== 'waiting') {
      return res.status(400).json({ error: 'Game already started' });
    }
    
    const playerId = Date.now().toString();
    
    session.players.push({
      id: playerId,
      name: playerName,
      lineup: [],
      ready: false
    });
    
    await session.save();
    
    res.json({ success: true, playerId }); // Return playerId
  } catch (error) {
    res.status(500).json({ error: 'Failed to join game' });
  }
});

app.get('/api/game/:gameCode', async (req, res) => {
  try {
    const session = await GameSession.findOne({ gameCode: req.params.gameCode });
    if (!session) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Socket.io game logic
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join-game', async (data) => {
    const { gameCode, playerId } = data;
    socket.join(gameCode);
    
    const session = await GameSession.findOne({ gameCode });
    io.to(gameCode).emit('game-update', session);
  });
  
  socket.on('player-ready', async (data) => {
    const { gameCode, playerId } = data;
    const session = await GameSession.findOne({ gameCode });
    
    if (session) {
      const player = session.players.find(p => p.id === playerId);
      if (player) player.ready = true;
      
      // Start game if both players ready
      if (session.players.every(p => p.ready)) {
        session.status = 'active';
      }
      
      await session.save();
      io.to(gameCode).emit('game-update', session);
    }
  });
  
socket.on('pick-player', async (data) => {
  const { gameCode, playerId, pickedPlayerId } = data;
  const session = await GameSession.findOne({ gameCode });
  
  if (!session || session.status !== 'active') return;
  
  const currentPlayer = session.players[session.currentTurn];
  if (currentPlayer.id !== playerId) {
    socket.emit('error', { message: 'Not your turn!' });
    return;
  }
  
  if (session.pickedPlayers.includes(pickedPlayerId)) {
    socket.emit('error', { message: 'Player already picked!' });
    return;
  }
  
  // Add to player's lineup
currentPlayer.lineup.push({
  playerId: pickedPlayerId,
  points: 0
});
  session.pickedPlayers.push(pickedPlayerId);
  
  // Check if lineup is full (9 players)
if (session.players.every(p => p.lineup.length >= 9)) {
  session.status = 'finished';
      
      // Calculate scores for both players
        const allPickedIds = session.players.flatMap(p =>
    p.lineup.map(l => l.playerId)
  );
       const stats = await WeeklyStat.find({
    player_id: { $in: allPickedIds },
    season: session.season,
    week: session.week
  });
      
      console.log('Stats found:', stats.length);
      
      // Add scores to each player
   for (const player of session.players) {
    let totalPoints = 0;

    player.lineup = player.lineup.map(slot => {
      const stat = stats.find(s => s.player_id === slot.playerId);
      const points = stat?.points ?? 0;
      totalPoints += points;

      return {
        playerId: slot.playerId,
        points
      };
    });

    player.score = totalPoints;
  }
    }
  
  // Switch turn
  session.currentTurn = (session.currentTurn + 1) % session.players.length;
  
  await session.save();
  io.to(gameCode).emit('game-update', session);
});
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});