import { Toast } from 'antd-mobile';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '../lib/queries';
import type {
  Nullable,
  RegisteredUserPayload,
  RegisteredUserResponse,
  RegistrationWithRelations,
} from '@app-types/core';

interface UseRegistrationResult {
  user: Nullable<RegisteredUserPayload>;
  registration: Nullable<RegistrationWithRelations>;
  stop_active: boolean;
  loading: boolean;
  error: Nullable<unknown>;
}

export function useRegistration(
  providerUid: Nullable<string>,
  serverErrorMessage?: string,
): UseRegistrationResult {
  const { data, error, isLoading } = useQuery<RegisteredUserResponse>({
    queryKey: ['registration', providerUid],
    queryFn: () =>
      fetchApi<RegisteredUserResponse>(
        `/api/v1/user-registration?provider=line&provider_uid=${encodeURIComponent(providerUid!)}`,
      ),
    enabled: !!providerUid,
  });

  useEffect(() => {
    if (error && serverErrorMessage) {
      Toast.show({ content: serverErrorMessage, icon: 'fail' });
    }
  }, [error, serverErrorMessage]);

  return {
    user: data?.user ?? null,
    registration: data?.registration ?? null,
    stop_active: data?.stop_active ?? true,
    loading: isLoading,
    error: error ?? null,
  };
}
