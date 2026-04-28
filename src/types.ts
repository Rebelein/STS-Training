export interface TrainingTemplate {
  dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
  start_time: string;
  end_time: string;
  title: string;
}

export interface GroupSettings {
  templates: TrainingTemplate[];
}
