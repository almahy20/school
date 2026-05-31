import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
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

describe("Realtime Sync Conflict Resolution", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    // Re-setup mocks after clearAllMocks
    mockChannel.on.mockReturnThis();
    mockChannel.subscribe.mockImplementation((cb) => { cb("SUBSCRIBED"); return mockChannel; });
  });

  it("should subscribe to Supabase channel and call invalidateQueries on event", async () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // The hook signature: useRealtimeSync(tables, schoolId?)
    const { unmount } = renderHook(
      () => useRealtimeSync("test_table", "school-123"),
      { wrapper }
    );

    // Verify channel was created
    const { supabase } = await import("@/integrations/supabase/client");
    expect(supabase.channel).toHaveBeenCalledWith(
      expect.stringContaining("test_table")
    );

    // Verify .on() was registered for postgres_changes
    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ table: "test_table" }),
      expect.any(Function)
    );

    // Fire the realtime event callback
    const onCallback = vi.mocked(mockChannel.on).mock.calls[0][2] as Function;
    onCallback({ eventType: "UPDATE", new: { id: "1" }, old: { id: "1" } });

    // Wait for debounce (500ms) then check invalidateQueries was called
    await new Promise((r) => setTimeout(r, 600));
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["test_table"] })
    );

    unmount();
    expect(supabase.removeChannel).toHaveBeenCalled();
  });

  it("should NOT subscribe when tables list is empty", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    renderHook(() => useRealtimeSync([], "school-123"), { wrapper });

    // channel should not be created for empty tables
    // (the hook returns early when tableList is empty)
    // The channel mock may have been called but with no .on() registrations for tables
    expect(mockChannel.on).not.toHaveBeenCalled();
  });
});
