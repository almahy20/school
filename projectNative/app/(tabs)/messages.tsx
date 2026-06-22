import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import ParentMessages from '@/components/messages/ParentMessages';
import AdminBroadcast from '@/components/messages/AdminBroadcast';

export default function MessagesScreen() {
  const { user } = useAuth();
  if (user?.role === 'parent') return <ParentMessages />;
  return <AdminBroadcast />;
}
