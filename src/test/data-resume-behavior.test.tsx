import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
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
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("refetches queries on window focus when stale", async () => {
    let value = 0;
    const fetcher = vi.fn(async () => ++value);

    function TestComponent() {
      const { data, isFetching } = useQuery({
        queryKey: ["focus-refetch"],
        queryFn: fetcher,
        staleTime: 0,
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

    await screen.findByText("1");
    expect(fetcher).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("blur"));
      window.dispatchEvent(new Event("focus"));
    });

    await screen.findByText("2");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("persists cache to localStorage and hydrates on remount", async () => {
    let called = 0;
    const fetcher = vi.fn(async () => {
      called++;
      return { name: "cached" };
    });

    function TestComponent() {
      const { data } = useQuery({
        queryKey: ["persist-me"],
        queryFn: fetcher,
        staleTime: 60 * 1000,
      });
      return <div data-testid="name">{data?.name ?? "none"}</div>;
    }

    const client1 = createClient();
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: "rq-test-persist",
    });

    render(
      <PersistQueryClientProvider
        client={client1}
        persistOptions={{
          persister,
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

    cleanup();

    const client2 = createClient();
    render(
      <PersistQueryClientProvider
        client={client2}
        persistOptions={{
          persister,
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
  });

  it("pauses mutations offline and resumes when back online", async () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });

    const fn = vi.fn(async (x: number) => x * 2);
    function MutComponent() {
      const { mutate } = useMutation({ mutationFn: fn, networkMode: "offlineFirst" });
      return <button onClick={() => mutate(21)}>do</button>;
    }

    const client = createClient();
    render(
      <QueryClientProvider client={client}>
        <MutComponent />
      </QueryClientProvider>
    );

    await act(async () => {
      screen.getByText("do").click();
    });
    expect(fn).toHaveBeenCalledTimes(0);

    Object.defineProperty(window.navigator, "onLine", { value: true });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    expect(fn).toHaveBeenCalledTimes(1);
  });
});
