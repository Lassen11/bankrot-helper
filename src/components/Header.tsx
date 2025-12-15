import { Scale, LogOut, User, History, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Link } from "react-router-dom";
export const Header = () => {
  const {
    user,
    signOut
  } = useAuth();
  const { isAdmin } = useUserRole();
  return <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div className="p-2 bg-primary rounded-lg">
              <Scale className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Спасение</h1>
              <p className="text-sm text-muted-foreground">
                Управление клиентами
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {user?.email}
            </span>
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/clients">
                    <Users className="h-4 w-4 mr-2" />
                    Клиенты
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/payment-history">
                    <History className="h-4 w-4 mr-2" />
                    История изменений
                  </Link>
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/profile">
                <User className="h-4 w-4 mr-2" />
                Профиль
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>
      </div>
    </header>;
};