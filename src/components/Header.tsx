import { Scale, Users } from "lucide-react";

export const Header = () => {
  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary rounded-lg">
              <Scale className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">
                Банкротство физлиц
              </h1>
              <p className="text-sm text-muted-foreground">
                Управление клиентами
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Личный кабинет</span>
          </div>
        </div>
      </div>
    </header>
  );
};