import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../components/ErrorBoundary";

// Komponente die immer einen Fehler wirft
function BrokenComponent(): never {
  throw new Error("Test-Komponentenfehler");
}

// console.error unterdrücken da React Fehler in Tests loggt
const originalError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});
afterAll(() => {
  console.error = originalError;
});

describe("ErrorBoundary", () => {
  it("zeigt Fehlermeldung wenn Kindkomponente crasht", () => {
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    expect(screen.getByText(/unerwarteter Fehler/i)).toBeInTheDocument();
    expect(screen.getByText("Test-Komponentenfehler")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /neu laden/i })).toBeInTheDocument();
  });

  it("rendert Kinder normal wenn kein Fehler auftritt", () => {
    render(
      <ErrorBoundary>
        <div>Alles in Ordnung</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Alles in Ordnung")).toBeInTheDocument();
  });

  it("Neu-laden-Button ruft window.location.reload auf", () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );

    fireEvent.click(screen.getByRole("button", { name: /neu laden/i }));
    expect(reloadMock).toHaveBeenCalledOnce();
  });
});
