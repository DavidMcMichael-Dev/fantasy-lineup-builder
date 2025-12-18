import mongoose, { Document, Schema } from 'mongoose';

export interface IPlayer extends Document {
  player_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  position: string;
  team: string | null;
  status: string;
  fantasy_positions: string[];
  updatedAt: Date;
}

const PlayerSchema = new Schema<IPlayer>({
  player_id: { type: String, required: true, unique: true },
  first_name: { type: String },
  last_name: { type: String },
  full_name: { type: String },
  position: { type: String },
  team: { type: String, default: null },
  status: { type: String },
  fantasy_positions: [{ type: String }],
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IPlayer>('Player', PlayerSchema);