'use client';

import { useUser } from '@clerk/nextjs';
import { useMutation } from 'convex/react';
import { useEffect, useRef } from 'react';
import { api } from '../../convex/_generated/api';

export function useSyncUser() {
  const { user, isLoaded } = useUser();
  const upsertUser = useMutation(api.users.upsert);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!isLoaded || !user || hasSynced.current) {
      return;
    }

    const syncUser = async () => {
      try {
        await upsertUser({
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? '',
          name: user.fullName ?? user.firstName ?? 'Anonymous',
          imageUrl: user.imageUrl,
        });
        hasSynced.current = true;
      } catch (error) {
        console.error('Failed to sync user:', error);
      }
    };

    syncUser();
  }, [isLoaded, user, upsertUser]);
}
