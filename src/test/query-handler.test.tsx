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
    // Check that it's NOT disabled and parent doesn't have pointer-events-none
    expect(button).not.toBeDisabled();
    
    // The fixed indicator should have pointer-events-none, but NOT the container
    const container = button.closest('div.relative');
    expect(container).not.toHaveClass('pointer-events-none');
  });

  it("should show loading spinner ONLY when loading is true and isRefetching is false", () => {
    const onRetry = vi.fn();
    const { rerender } = render(
      <QueryStateHandler 
        loading={true} 
        error={null} 
        data={null} 
        onRetry={onRetry} 
        isRefetching={false}
      >
        <div data-testid="content">Content</div>
      </QueryStateHandler>
    );

    // Should show loading message, not content
    expect(screen.getByText("جاري التحميل...")).toBeInTheDocument();
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();

    // Rerender with data and isRefetching=true
    rerender(
      <QueryStateHandler 
        loading={false} 
        error={null} 
        data={{ id: 1 }} 
        onRetry={onRetry} 
        isRefetching={true}
      >
        <div data-testid="content">Content</div>
      </QueryStateHandler>
    );

    // Should show content, NOT full page loading spinner
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.queryByText("جاري التحميل...")).not.toBeInTheDocument();
  });
});
