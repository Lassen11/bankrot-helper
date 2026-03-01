import { Check, Circle, Clock } from "lucide-react";

interface Stage {
  id: string;
  stage_number: number;
  title: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
}

interface BankruptcyTimelineProps {
  stages: Stage[];
}

export function BankruptcyTimeline({ stages }: BankruptcyTimelineProps) {
  // Find the first incomplete stage as "current"
  const currentStageIndex = stages.findIndex((s) => !s.is_completed);

  return (
    <div className="relative space-y-0">
      {stages.map((stage, index) => {
        const isCompleted = stage.is_completed;
        const isCurrent = index === currentStageIndex;
        const isFuture = !isCompleted && !isCurrent;

        return (
          <div key={stage.id} className="relative flex gap-4">
            {/* Vertical line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isCurrent
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent ? (
                  <Clock className="h-4 w-4" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              {index < stages.length - 1 && (
                <div
                  className={`w-0.5 flex-1 min-h-[2rem] ${
                    isCompleted ? "bg-green-500" : "bg-muted"
                  }`}
                />
              )}
            </div>

            {/* Content */}
            <div className={`pb-6 pt-1 ${isFuture ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Этап {stage.stage_number}
                </span>
                {isCompleted && stage.completed_at && (
                  <span className="text-xs text-green-600">
                    {new Date(stage.completed_at).toLocaleDateString("ru-RU")}
                  </span>
                )}
              </div>
              <h3
                className={`font-semibold ${
                  isCurrent ? "text-primary" : ""
                }`}
              >
                {stage.title}
              </h3>
              {stage.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {stage.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
