import { UserProfile } from "@/components/UserProfile";
import { Header } from "@/components/Header";

const Profile = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <UserProfile />
      </main>
    </div>
  );
};

export default Profile;