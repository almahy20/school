import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act, cleanup, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

function createClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "offlineFirst",
        staleTime: 0,
        gcTime: 24 * 60 * 60 * 1000,
        retry: false,
      },
      mutations: { networkMode: "offlineFirst", retry: false },
    },
  });
}

describe("React Query resume & persistence behavior", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset managers to defaults before each test
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
  });

  it("refetches queries on window focus when stale", async () => {
    let value = 0;
    const fetcher = vi.fn(async () => ++value);

    function TestComponent() {
      const { data, isFetching } = useQuery({
        queryKey: ["focus-refetch"],
        queryFn: fetcher,
        staleTime: 0,
        refetchOnWindowFocus: true,
      });
      return (
        <div>
          <span data-testid="val">{data ?? "none"}</span>
          <span data-testid="fetching">{isFetching ? "1" : "0"}</span>
        </div>
      );
    }

    const client = createClient();
    render(
      <QueryClientProvider client={client}>
        <TestComponent />
      </QueryClientProvider>
    );

    // Wait for initial fetch
    await screen.findByText("1");
    expect(fetcher).toHaveBeenCalledTimes(1);

    // Simulate losing focus, then regaining it — React Query uses focusManager internally
    await act(async () => {
      focusManager.setFocused(false);
    });

    await act(async () => {
      focusManager.setFocused(true);
    });

    // Wait for refetch to complete
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2), {
      timeout: 2000,
    });
    await screen.findByText("2");
  });

  it("persists cache to localStorage and hydrates on remount without refetching", async () => {
    let called = 0;
    const fetcher = vi.fn(async () => {
      called++;
      return { name: "cached" };
    });

    // Use a very long staleTime so hydrated data is treated as fresh
    const STALE_TIME = 5 * 60 * 1000; // 5 minutes

    function TestComponent() {
      const { data } = useQuery({
        queryKey: ["persist-me"],
        queryFn: fetcher,
        staleTime: STALE_TIME,
      });
      return <div data-testid="name">{data?.name ?? "none"}</div>;
    }

    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "rq-test-persist",
    });

    // --- First mount: fetch and populate cache ---
    const client1 = new QueryClient({
      defaultOptions: {
        queries: {
          networkMode: "offlineFirst",
          staleTime: STALE_TIME,
          gcTime: 24 * 60 * 60 * 1000,
          retry: false,
        },
      },
    });

    render(
      <PersistQueryClientProvider
        client={client1}
        persistOptions={{
          persister,
          maxAge: 24 * 60 * 60 * 1000,
          dehydrateOptions: {
            shouldDehydrateQuery: (q) => q.state.status === "success",
          },
        }}
      >
        <TestComponent />
      </PersistQueryClientProvider>
    );

    await screen.findByText("cached");
    expect(called).toBe(1);

    // Wait for PersistQueryClientProvider to write asynchronously to localStorage
    await waitFor(() => {
      expect(localStorage.getItem("rq-test-persist")).not.toBeNull();
    }, { timeout: 3000 });

    cleanup();

    // --- Second mount: hydrate from localStorage, should NOT refetch ---
    const client2 = new QueryClient({
      defaultOptions: {
        queries: {
          networkMode: "offlineFirst",
          staleTime: STALE_TIME, // same staleTime keeps hydrated data "fresh"
          gcTime: 24 * 60 * 60 * 1000,
          retry: false,
        },
      },
    });

    render(
      <PersistQueryClientProvider
        client={client2}
        persistOptions={{
          persister,
          maxAge: 24 * 60 * 60 * 1000,
          dehydrateOptions: {
            shouldDehydrateQuery: (q) => q.state.status === "success",
          },
        }}
      >
        <TestComponent />
      </PersistQueryClientProvider>
    );

    await screen.findByText("cached");
    // fetcher should NOT have been called again — data came from persisted localStorage
    expect(called).toBe(1);
  });

  it("pauses mutations when offline and resumes when back online", async () => {
    const fn = vi.fn(async (x: number) => x * 2);

    function MutComponent() {
      // networkMode: "online" causes React Query to pause the mutation when offline
      const { mutate } = useMutation({
        mutationFn: fn,
        networkMode: "online",
      });
      return <button onClick={() => mutate(21)}>do</button>;
    }

    // Set offline BEFORE rendering
    onlineManager.setOnline(false);

    const client = new QueryClient({
      defaultOptions: {
        mutations: { networkMode: "online", retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MutComponent />
      </QueryClientProvider>
    );

    await act(async () => {
      screen.getByText("do").click();
    });

    // Mutation should be paused (not executed) while offline
    expect(fn).toHaveBeenCalledTimes(0);

    // Go back online using React Query's onlineManager
    await act(async () => {
      onlineManager.setOnline(true);
    });

    // Wait for the resumed mutation to execute
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1), {
      timeout: 2000,
    });
  });
});
