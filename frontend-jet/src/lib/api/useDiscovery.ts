import { useQuery } from "@tanstack/react-query";
import { searchDiscovery } from "@/lib/api/endpoints";
import { ApiError } from "@/lib/api/client";
import type { DiscoveryResponse } from "@/lib/api/types";

/** Discovery query, keyed by normalized postcode. */
export function useDiscovery(postcode: string | null) {
  return useQuery<DiscoveryResponse, ApiError>({
    queryKey: ["discovery", postcode],
    queryFn: ({ signal }) => searchDiscovery(postcode as string, signal),
    enabled: !!postcode,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
}
