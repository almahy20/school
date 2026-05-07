import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { GlobalSyncIndicator } from "../components/GlobalSyncIndicator";
import { QueryClient, QueryClientProvider, useIsFetching } from "@tanstack/react-query";
import React from "react";

// Mock useIsFetching
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useIsFetching: vi.fn(),
  };
});

describe("GlobalSyncIndicator", () => {
  it("should show indicator after delay when queries are fetching", async () => {
    vi.useFakeTimers();
    vi.mocked(useIsFetching).mockReturnValue(1); // 1 query fetching

    render(<GlobalSyncIndicator />);

    // Initially hidden (due to delay)
    expect(screen.queryByText("مزامنة فورية")).not.toBeInTheDocument();

    // Fast forward 800ms
    act(() => {
      vi.advanceTimersByTime(801);
    });

    expect(screen.getByText("مزامنة فورية")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("should hide indicator when no queries are fetching", async () => {
    vi.mocked(useIsFetching).mockReturnValue(0); // 0 queries fetching
    render(<GlobalSyncIndicator />);
    expect(screen.queryByText("مزامنة فورية")).not.toBeInTheDocument();
  });
});
