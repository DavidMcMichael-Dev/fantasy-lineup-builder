import mongoose, { Document, Schema } from 'mongoose';

export interface IGameSession extends Document {
  gameCode: string;
  season: number;
  week: number;
  players: {
    id: string;
    name: string;
   lineup: {
  playerId: string;
  points: number;
}[];
    ready: boolean;
    score?: number; // Add score field
  }[];
  pickedPlayers: string[];
  currentTurn: number;
  status: 'waiting' | 'active' | 'finished';
  createdAt: Date;
}

const GameSessionSchema = new Schema<IGameSession>({
  gameCode: { type: String, required: true, unique: true },
  season: { type: Number, required: true },
  week: { type: Number, required: true },
  players: [{
    id: String,
    name: String,
   lineup: [{
  playerId: { type: String, required: true },
  points: { type: Number, default: 0 }
}],
    ready: Boolean,
    score: Number // Add score field
  }],
  pickedPlayers: [String],
  currentTurn: { type: Number, default: 0 },
  status: { type: String, default: 'waiting' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IGameSession>('GameSession', GameSessionSchema);