import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'admin' | 'employee' | null;

export const useUserRole = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Ошибка получения роли пользователя:', error);
          setUserRole('employee'); // Default to employee if no role found
        } else {
          setUserRole(data?.role || 'employee');
        }
      } catch (error) {
        console.error('Ошибка при запросе роли:', error);
        setUserRole('employee');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  const isAdmin = userRole === 'admin';
  const isEmployee = userRole === 'employee';

  return {
    userRole,
    isAdmin,
    isEmployee,
    loading
  };
};