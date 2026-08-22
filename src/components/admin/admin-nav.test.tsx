import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AdminNav } from "./admin-nav";

// The nav highlights the active entry via the current path; the tests below
// are about the counter, so a stable path is enough.
vi.mock("next/navigation", () => ({ usePathname: () => "/admin" }));

describe("AdminNav open-bookings counter (PROJ-39)", () => {
  it("shows the number of open bookings on the Buchungen entry", () => {
    render(<AdminNav openBookingsCount={3} />);
    expect(screen.getByLabelText("3 offene Buchungen")).toHaveTextContent("3");
  });

  // A "0" badge would be permanent visual noise and, worse, would read as
  // "something is waiting" when nothing is.
  it("shows no badge at all when nothing is open", () => {
    const { container } = render(<AdminNav openBookingsCount={0} />);
    expect(screen.queryByLabelText(/offene Buchungen/)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("0");
  });

  // Regression guard: `{count && ...}` renders a literal "0" in JSX instead of
  // nothing. That exact bug shipped once before (birthdate field), so it is
  // worth pinning down rather than trusting the current implementation.
  it("renders no stray zero when the count is omitted entirely", () => {
    const { container } = render(<AdminNav />);
    expect(container.textContent).not.toContain("0");
  });

  it("caps the badge at 99+ so a large number cannot break the layout", () => {
    render(<AdminNav openBookingsCount={150} />);
    expect(screen.getByLabelText("150 offene Buchungen")).toHaveTextContent("99+");
  });

  it("still shows an exact count at the 99 boundary", () => {
    render(<AdminNav openBookingsCount={99} />);
    expect(screen.getByLabelText("99 offene Buchungen")).toHaveTextContent("99");
  });

  it("attaches the badge only to Buchungen, not to any other menu entry", () => {
    render(<AdminNav openBookingsCount={5} />);
    const badge = screen.getByLabelText("5 offene Buchungen");
    expect(badge.closest("a")).toHaveAttribute("href", "/admin/buchungen");
    expect(screen.getAllByLabelText(/offene Buchungen/)).toHaveLength(1);
  });

  // Screen-reader users get the same information as sighted ones: a bare "3"
  // next to a link label is meaningless without it.
  it("describes the badge for screen readers", () => {
    render(<AdminNav openBookingsCount={2} />);
    expect(screen.getByLabelText("2 offene Buchungen")).toBeInTheDocument();
  });
});
