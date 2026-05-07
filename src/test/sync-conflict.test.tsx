import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useRealtimeSync } from "../hooks/useRealtimeSync";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock Supabase
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn((cb) => cb("SUBSCRIBED")),
  topic: "realtime:test-channel"
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: vi.fn(() => mockChannel),
    removeChannel: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("Realtime Sync Conflict Resolution", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    vi.clearAllMocks();
  });

  it("should resolve conflicts using Last-Write-Wins (updated_at)", async () => {
    const queryKey = ["test-data"];
    const initialData = [
      { id: "1", name: "Old Name", updated_at: "2026-01-01T10:00:00Z" }
    ];
    
    queryClient.setQueryData(queryKey, initialData);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useRealtimeSync("test_table", queryKey), { wrapper });

    // Simulate incoming OLDER update
    const olderPayload = {
      eventType: "UPDATE",
      new: { id: "1", name: "Stale Name", updated_at: "2025-12-31T23:59:59Z" },
      old: { id: "1" }
    };

    // Extract the callback passed to .on()
    const onCallback = vi.mocked(mockChannel.on).mock.calls[0][2];
    onCallback(olderPayload);

    // Data should NOT change
    expect(queryClient.getQueryData(queryKey)).toEqual(initialData);

    // Simulate incoming NEWER update
    const newerPayload = {
      eventType: "UPDATE",
      new: { id: "1", name: "Fresh Name", updated_at: "2026-01-01T11:00:00Z" },
      old: { id: "1" }
    };

    onCallback(newerPayload);

    // Data SHOULD change
    expect((queryClient.getQueryData(queryKey) as any)[0].name).toBe("Fresh Name");
  });
});
