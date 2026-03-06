import { Check, Circle, Clock, Download, FileIcon } from "lucide-react";
import React from "react";
import { Button } from "@/components/ui/button";

interface StageFile {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
}

interface Stage {
  id: string;
  stage_number: number;
  title: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
  files?: StageFile[];
}

function Linkify({ children }: { children: string }) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = children.split(urlRegex);
  return (
    <>
      {parts.map((part, i) =>
        urlRegex.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

interface BankruptcyTimelineProps {
  stages: Stage[];
}

export function BankruptcyTimeline({ stages }: BankruptcyTimelineProps) {
  const currentStageIndex = stages.findIndex((s) => !s.is_completed);

  return (
    <div className="relative space-y-0">
      {stages.map((stage, index) => {
        const isCompleted = stage.is_completed;
        const isCurrent = index === currentStageIndex;
        const isFuture = !isCompleted && !isCurrent;

        return (
          <div key={stage.id} className="relative flex gap-3 sm:gap-4">
            {/* Vertical line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 z-10 ${
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
            <div className={`pb-6 pt-1 flex-1 min-w-0 ${isFuture ? "opacity-50" : ""}`}>
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
                className={`font-semibold text-sm sm:text-base ${
                  isCurrent ? "text-primary" : ""
                }`}
              >
                {stage.title}
              </h3>
              {stage.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  <Linkify>{stage.description}</Linkify>
                </p>
              )}

              {/* Stage files for client download */}
              {stage.files && stage.files.length > 0 && (
                <div className="mt-2 space-y-1">
                  {stage.files.map((file) => (
                    <a
                      key={file.id}
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5 hover:bg-muted transition-colors"
                    >
                      <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate flex-1 text-foreground">{file.file_name}</span>
                      <span className="text-muted-foreground shrink-0">
                        {formatFileSize(file.file_size)}
                      </span>
                      <Download className="h-3 w-3 shrink-0 text-primary" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
