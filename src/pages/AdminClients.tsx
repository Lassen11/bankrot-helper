import { Header } from "@/components/Header";
import { AdminClientsList } from "@/components/AdminClientsList";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";

const AdminClients = () => {
  const { isAdmin, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Загрузка...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-primary mb-6">Все клиенты</h1>
        <AdminClientsList />
      </main>
    </div>
  );
};

export default AdminClients;
