import { render, screen } from "@testing-library/react";
import { ResultBadge } from "./result-badge";

describe("ResultBadge", () => {
  it("renders the result text", () => {
    render(<ResultBadge result="pass" />);
    expect(screen.getByText("pass")).toBeInTheDocument();
  });

  it("includes sr-only accessibility text", () => {
    render(<ResultBadge result="fail" />);
    expect(screen.getByText("result")).toHaveClass("sr-only");
  });

  it("applies pass styling classes", () => {
    render(<ResultBadge result="pass" />);
    const badge = screen.getByText("pass").closest("[data-slot='badge']");
    expect(badge).toHaveClass("capitalize");
  });

  it("renders unknown result without crashing", () => {
    render(<ResultBadge result="unknown" />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
