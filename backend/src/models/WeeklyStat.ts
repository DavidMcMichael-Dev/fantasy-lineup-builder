import mongoose, { Document, Schema } from 'mongoose';

export interface IWeeklyStat extends Document {
  player_id: string;
  season: number;
  week: number;
  points: number;
  stats: Record<string, any>;
  updatedAt: Date;
}

const WeeklyStatSchema = new Schema<IWeeklyStat>({
  player_id: { type: String, required: true },
  season: { type: Number, required: true },
  week: { type: Number, required: true },
  points: { type: Number, default: 0 },
  stats: { type: Schema.Types.Mixed },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index for efficient queries
WeeklyStatSchema.index({ player_id: 1, season: 1, week: 1 }, { unique: true });

export default mongoose.model<IWeeklyStat>('WeeklyStat', WeeklyStatSchema);