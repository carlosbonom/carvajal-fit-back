export class WeightEntryDto {
  id: string;
  weightKg: number;
  notes: string | null;
  recordedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class WeightProgressStatsDto {
  currentWeight: number | null;
  startingWeight: number | null;
  totalLoss: number | null;
  totalGain: number | null;
  entries: WeightEntryDto[];
}

