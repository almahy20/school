import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryStateHandler } from "../components/QueryStateHandler";
import React from "react";

describe("QueryStateHandler", () => {
  it("should keep children interactive when isRefetching is true", () => {
    const onRetry = vi.fn();
    render(
      <QueryStateHandler 
        loading={false} 
        error={null} 
        data={{ id: 1 }} 
        onRetry={onRetry} 
        isRefetching={true}
      >
        <button data-testid="test-button">Interactive Button</button>
      </QueryStateHandler>
    );

    const button = screen.getByTestId("test-button");
    // Check that it's NOT disabled
    expect(button).not.toBeDisabled();
    expect(button).toBeInTheDocument();
  });

  it("should show skeleton ONLY when loading is true and isRefetching is false (no data)", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <QueryStateHandler 
        loading={true} 
        error={null} 
        data={null} 
        onRetry={onRetry} 
        isRefetching={false}
        skeleton={<div data-testid="custom-skeleton">Loading Skeleton</div>}
      >
        <div data-testid="content">Content</div>
      </QueryStateHandler>
    );

    // Should show skeleton, not content (new skeleton-based loading UX)
    expect(screen.getByTestId("custom-skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();

    // Rerender with data and isRefetching=true
    rerender(
      <QueryStateHandler 
        loading={false} 
        error={null} 
        data={{ id: 1 }} 
        onRetry={onRetry} 
        isRefetching={true}
        skeleton={<div data-testid="custom-skeleton">Loading Skeleton</div>}
      >
        <div data-testid="content">Content</div>
      </QueryStateHandler>
    );

    // Should show content, NOT skeleton (background refetch shows content)
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.queryByTestId("custom-skeleton")).not.toBeInTheDocument();
  });
});
