import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UserAvatar } from "@/components/user-avatar";

describe("UserAvatar", () => {
  it("renders an avatar root element", () => {
    const { container } = render(
      <UserAvatar imageUrl="/foo.png" name="홍길동" />,
    );
    const root = container.firstChild as HTMLElement;
    // Radix Avatar 의 root span 이 렌더되어야 한다.
    expect(root).toBeInTheDocument();
    expect(root.tagName).toBe("SPAN");
  });

  it("applies size variant classes", () => {
    const { container } = render(
      <UserAvatar imageUrl="/foo.png" name="user" size="xl" />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/h-\[160px\]/);
    expect(root.className).toMatch(/w-\[160px\]/);
  });

  it("merges custom className with size variant", () => {
    const { container } = render(
      <UserAvatar
        imageUrl="/foo.png"
        name="user"
        size="sm"
        className="ring-2"
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/ring-2/);
    expect(root.className).toMatch(/h-6/);
  });

  it("calls onClick when clicked", async () => {
    const onClick = vi.fn();
    const { container } = render(
      <UserAvatar imageUrl="/foo.png" name="user" onClick={onClick} />,
    );
    const root = container.firstChild as HTMLElement;
    await userEvent.click(root);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
